package parser

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/icza/screp/rep"
	"github.com/icza/screp/rep/repcmd"
	"github.com/icza/screp/repparser"
	"github.com/xungwoo/stareplays/ent/schema"
)

// ParsedGame holds all parsed data from a replay file.
type ParsedGame struct {
	Filename    string
	FileHash    string
	Host        string
	StartTime   time.Time
	MapName     string
	MapWidth    uint16
	MapHeight   uint16
	GameLength  int // in seconds
	GameType    string
	GameSpeed   string
	Title       string
	WinnerTeam  byte
	PlayerCount int
	Players     []ParsedPlayer
	Detail      *ParsedGameDetail
}

// ParsedPlayer holds parsed player data.
type ParsedPlayer struct {
	Name           string
	Race           string
	Color          string
	Result         string // win/loss/draw/unknown
	Team           byte
	PlayerID       byte
	APM            int32
	EAPM           int32
	CmdCount       uint32
	EffCmdCount    uint32
	StartX         uint16
	StartY         uint16
	StartDirection int32
	Redundancy     int
	IsWinner       bool
}

// ParsedGameDetail holds detailed game data for visualization.
type ParsedGameDetail struct {
	APMTimeline           []schema.PlayerAPMTimeline
	BuildOrders           []schema.PlayerBuildOrder
	CompressedBuildOrders []schema.PlayerBuildOrder
	ChatMessages          []schema.ChatMessage
}

// ParseReplayFile parses a StarCraft replay file and returns structured data.
func ParseReplayFile(filePath string) (*ParsedGame, error) {
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return nil, fmt.Errorf("replay file not found: %s", filePath)
	}

	repData, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read replay file: %w", err)
	}

	return ParseReplayData(filepath.Base(filePath), repData)
}

// ParseReplayData parses replay data bytes and returns structured data.
func ParseReplayData(filename string, repData []byte) (*ParsedGame, error) {
	replay, err := repparser.Parse(repData)
	if err != nil {
		return nil, fmt.Errorf("failed to parse replay: %w", err)
	}
	replay.Compute()

	fileHash := calculateFileHashFromBytes(repData)

	header := replay.Header
	computed := replay.Computed

	game := &ParsedGame{
		Filename:  filename,
		FileHash:  fileHash,
		Host:      header.Host,
		StartTime: header.StartTime,
		MapName:   header.Map,
		MapWidth:  header.MapWidth,
		MapHeight: header.MapHeight,
		// Frames / 23.81 for Fastest speed
		GameLength: int(float64(header.Frames) / 23.81),
	}

	if header.Type != nil {
		game.GameType = header.Type.Name
	}
	if header.Speed != nil {
		game.GameSpeed = header.Speed.Name
	}
	game.Title = header.Title

	if computed != nil {
		game.WinnerTeam = computed.WinnerTeam
	}

	// Extract non-observer players
	game.Players = extractPlayers(header, computed)
	game.PlayerCount = len(game.Players)

	// Extract game detail
	game.Detail = extractGameDetail(replay)

	return game, nil
}

// extractPlayers extracts all non-observer players from the replay.
func extractPlayers(header *rep.Header, computed *rep.Computed) []ParsedPlayer {
	var players []ParsedPlayer

	for _, p := range header.Players {
		if p.Observer {
			continue
		}

		pp := ParsedPlayer{
			Name:     p.Name,
			Team:     p.Team,
			PlayerID: p.ID,
		}

		if p.Race != nil {
			pp.Race = p.Race.Name
		}
		if p.Color != nil {
			pp.Color = p.Color.Name
		}

		// Match player desc for APM/EAPM stats
		if computed != nil {
			if pd, ok := computed.PIDPlayerDescs[p.ID]; ok {
				pp.APM = pd.APM
				pp.EAPM = pd.EAPM
				pp.CmdCount = pd.CmdCount
				pp.EffCmdCount = pd.EffectiveCmdCount
				pp.StartDirection = pd.StartDirection
				pp.Redundancy = pd.Redundancy()
				if pd.StartLocation != nil {
					pp.StartX = pd.StartLocation.X
					pp.StartY = pd.StartLocation.Y
				}
			}

			// Determine result
			if computed.WinnerTeam > 0 {
				if p.Team == computed.WinnerTeam {
					pp.IsWinner = true
					pp.Result = "win"
				} else {
					pp.Result = "loss"
				}
			} else {
				pp.Result = "unknown"
			}
		} else {
			pp.Result = "unknown"
		}

		players = append(players, pp)
	}

	return players
}

// extractGameDetail extracts detailed game data for visualization.
func extractGameDetail(replay *rep.Replay) *ParsedGameDetail {
	detail := &ParsedGameDetail{}

	header := replay.Header

	// Build a slot ID → player name map for chat messages
	slotPlayerName := make(map[byte]string)
	for _, p := range header.Slots {
		if p != nil {
			slotPlayerName[byte(p.SlotID)] = p.Name
		}
	}

	// Build a player ID → player name map
	pidPlayerName := make(map[byte]string)
	for _, p := range header.Players {
		if !p.Observer {
			pidPlayerName[p.ID] = p.Name
		}
	}

	// APM timeline
	if replay.Commands != nil {
		detail.APMTimeline = buildAPMTimeline(replay, pidPlayerName)
		detail.BuildOrders = extractBuildOrders(replay.Commands, pidPlayerName)
		detail.CompressedBuildOrders = compressBuildOrders(detail.BuildOrders)
	}

	// Chat messages
	if replay.Computed != nil && len(replay.Computed.ChatCmds) > 0 {
		detail.ChatMessages = extractChatMessages(replay.Computed.ChatCmds, slotPlayerName)
	}

	return detail
}

// buildAPMTimeline builds per-player APM timeline with ~10 second windows (~238 frames).
func buildAPMTimeline(replay *rep.Replay, pidPlayerName map[byte]string) []schema.PlayerAPMTimeline {
	const windowFrames = 238 // ~10 seconds at Fastest speed

	if replay.Commands == nil || len(replay.Commands.Cmds) == 0 {
		return nil
	}

	totalFrames := int(replay.Header.Frames)
	if totalFrames == 0 {
		return nil
	}

	// Count commands per player per window
	type windowKey struct {
		playerID byte
		window   int
	}
	cmdCounts := make(map[windowKey]int)
	playerIDs := make(map[byte]bool)

	for _, cmd := range replay.Commands.Cmds {
		base := cmd.BaseCmd()
		pid := base.PlayerID
		if _, ok := pidPlayerName[pid]; !ok {
			continue // skip observers
		}
		w := int(base.Frame) / windowFrames
		cmdCounts[windowKey{pid, w}]++
		playerIDs[pid] = true
	}

	numWindows := totalFrames/windowFrames + 1

	var timelines []schema.PlayerAPMTimeline
	for pid := range playerIDs {
		name := pidPlayerName[pid]
		tl := schema.PlayerAPMTimeline{PlayerName: name}

		for w := 0; w < numWindows; w++ {
			count := cmdCounts[windowKey{pid, w}]
			// APM = count * (60 / windowSeconds)
			apm := float64(count) * 6.0 // 60/10 = 6
			tl.DataPoints = append(tl.DataPoints, schema.APMDataPoint{
				Frame: w * windowFrames,
				APM:   apm,
			})
		}
		timelines = append(timelines, tl)
	}

	return timelines
}

// extractBuildOrders extracts per-player raw command events used for build-order analysis.
func extractBuildOrders(commands *rep.Commands, pidPlayerName map[byte]string) []schema.PlayerBuildOrder {
	playerBuilds := make(map[byte][]schema.BuildEvent)

	for _, cmd := range commands.Cmds {
		base := cmd.BaseCmd()
		pid := base.PlayerID
		if _, ok := pidPlayerName[pid]; !ok {
			continue
		}

		ev, ok := commandToBuildEvent(cmd)
		if !ok {
			continue
		}
		ev.IsEffective = base.IneffKind.Effective()
		ev.IneffKind = base.IneffKind.String()
		playerBuilds[pid] = append(playerBuilds[pid], ev)
	}

	var orders []schema.PlayerBuildOrder
	for pid, events := range playerBuilds {
		sort.SliceStable(events, func(i, j int) bool {
			return events[i].Frame < events[j].Frame
		})
		orders = append(orders, schema.PlayerBuildOrder{
			PlayerName: pidPlayerName[pid],
			Events:     events,
		})
	}
	sort.SliceStable(orders, func(i, j int) bool {
		return orders[i].PlayerName < orders[j].PlayerName
	})

	return orders
}

func commandToBuildEvent(cmd repcmd.Cmd) (schema.BuildEvent, bool) {
	base := cmd.BaseCmd()
	switch c := cmd.(type) {
	case *repcmd.BuildCmd:
		if c.Unit == nil {
			return schema.BuildEvent{}, false
		}
		ev := schema.BuildEvent{
			Frame:     int(base.Frame),
			EventType: "build",
			Unit:      c.Unit.Name,
			X:         int(c.Pos.X),
			Y:         int(c.Pos.Y),
		}
		if c.Order != nil {
			ev.Order = c.Order.Name
		}
		return ev, true
	case *repcmd.LandCmd:
		if c.Unit == nil {
			return schema.BuildEvent{}, false
		}
		ev := schema.BuildEvent{
			Frame:     int(base.Frame),
			EventType: "land",
			Unit:      c.Unit.Name,
			X:         int(c.Pos.X),
			Y:         int(c.Pos.Y),
		}
		if c.Order != nil {
			ev.Order = c.Order.Name
		}
		return ev, true
	case *repcmd.TrainCmd:
		if c.Unit == nil {
			return schema.BuildEvent{}, false
		}
		evType := "train"
		if base.Type != nil && base.Type.ID == repcmd.TypeIDUnitMorph {
			evType = "unit_morph"
		}
		return schema.BuildEvent{
			Frame:     int(base.Frame),
			EventType: evType,
			Unit:      c.Unit.Name,
			IsMorph:   evType == "unit_morph",
		}, true
	case *repcmd.BuildingMorphCmd:
		if c.Unit == nil {
			return schema.BuildEvent{}, false
		}
		return schema.BuildEvent{
			Frame:     int(base.Frame),
			EventType: "building_morph",
			Unit:      c.Unit.Name,
			IsMorph:   true,
		}, true
	case *repcmd.TechCmd:
		if c.Tech == nil {
			return schema.BuildEvent{}, false
		}
		return schema.BuildEvent{
			Frame:     int(base.Frame),
			EventType: "tech",
			Tech:      c.Tech.Name,
		}, true
	case *repcmd.UpgradeCmd:
		if c.Upgrade == nil {
			return schema.BuildEvent{}, false
		}
		return schema.BuildEvent{
			Frame:     int(base.Frame),
			EventType: "upgrade",
			Upgrade:   c.Upgrade.Name,
		}, true
	case *repcmd.QueueableCmd:
		// Queueable commands are not build-order milestones.
		return schema.BuildEvent{}, false
	case *repcmd.TargetedOrderCmd:
		// Targeted orders are high-frequency control and are excluded.
		return schema.BuildEvent{}, false
	case *repcmd.CancelTrainCmd:
		return schema.BuildEvent{
			Frame:     int(base.Frame),
			EventType: "cancel_train",
		}, true
	default:
		// Some no-payload command types are represented by *repcmd.Base.
		if base.Type == nil {
			return schema.BuildEvent{}, false
		}
		switch base.Type.ID {
		case repcmd.TypeIDCancelBuild:
			return schema.BuildEvent{Frame: int(base.Frame), EventType: "cancel_build"}, true
		case repcmd.TypeIDCancelMorph:
			return schema.BuildEvent{Frame: int(base.Frame), EventType: "cancel_morph"}, true
		case repcmd.TypeIDCancelTech:
			return schema.BuildEvent{Frame: int(base.Frame), EventType: "cancel_tech"}, true
		case repcmd.TypeIDCancelUpgrade:
			return schema.BuildEvent{Frame: int(base.Frame), EventType: "cancel_upgrade"}, true
		}
		return schema.BuildEvent{}, false
	}
}

func compressBuildOrders(raw []schema.PlayerBuildOrder) []schema.PlayerBuildOrder {
	result := make([]schema.PlayerBuildOrder, 0, len(raw))
	for _, pbo := range raw {
		events := filterEffectiveEvents(pbo.Events)
		events = dedupShortBurstEvents(events)
		events = reconcileCancelPairs(events)
		events = aggregateWorkerTrainRuns(events)
		result = append(result, schema.PlayerBuildOrder{
			PlayerName: pbo.PlayerName,
			Events:     events,
		})
	}
	return result
}

func filterEffectiveEvents(events []schema.BuildEvent) []schema.BuildEvent {
	out := make([]schema.BuildEvent, 0, len(events))
	for _, ev := range events {
		if isCancelEventType(ev.EventType) {
			out = append(out, ev)
			continue
		}
		if ev.IsEffective {
			out = append(out, ev)
		}
	}
	return out
}

func dedupShortBurstEvents(events []schema.BuildEvent) []schema.BuildEvent {
	type dedupKey struct {
		eventType string
		payload   string
	}
	lastFrame := map[dedupKey]int{}
	out := make([]schema.BuildEvent, 0, len(events))
	for _, ev := range events {
		if isCancelEventType(ev.EventType) {
			out = append(out, ev)
			continue
		}
		key := dedupKey{eventType: ev.EventType, payload: eventPayloadKey(ev)}
		window := dedupWindow(ev)
		if prev, ok := lastFrame[key]; ok && ev.Frame-prev <= window {
			continue
		}
		lastFrame[key] = ev.Frame
		out = append(out, ev)
	}
	return out
}

func reconcileCancelPairs(events []schema.BuildEvent) []schema.BuildEvent {
	out := make([]schema.BuildEvent, 0, len(events))
	for _, ev := range events {
		if !isCancelEventType(ev.EventType) {
			out = append(out, ev)
			continue
		}
		if idx := findCancelableEvent(out, ev); idx >= 0 {
			out = append(out[:idx], out[idx+1:]...)
		}
		// cancel event 자체는 결과 build order에서 제거
	}
	return out
}

func findCancelableEvent(events []schema.BuildEvent, cancel schema.BuildEvent) int {
	matchWindow := 48
	for i := len(events) - 1; i >= 0; i-- {
		ev := events[i]
		if cancel.Frame-ev.Frame > matchWindow {
			break
		}
		switch cancel.EventType {
		case "cancel_train":
			if ev.EventType == "train" || ev.EventType == "unit_morph" {
				return i
			}
		case "cancel_build":
			if ev.EventType == "build" || ev.EventType == "land" {
				return i
			}
		case "cancel_morph":
			if ev.EventType == "building_morph" || ev.EventType == "unit_morph" {
				return i
			}
		case "cancel_tech":
			if ev.EventType == "tech" {
				return i
			}
		case "cancel_upgrade":
			if ev.EventType == "upgrade" {
				return i
			}
		}
	}
	return -1
}

func aggregateWorkerTrainRuns(events []schema.BuildEvent) []schema.BuildEvent {
	out := make([]schema.BuildEvent, 0, len(events))
	for _, ev := range events {
		if ev.EventType == "train" && isWorkerUnit(ev.Unit) {
			if len(out) > 0 {
				last := &out[len(out)-1]
				if last.EventType == ev.EventType &&
					strings.EqualFold(last.Unit, ev.Unit) &&
					ev.Frame-last.Frame <= 120 {
					if last.Count == 0 {
						last.Count = 1
					}
					last.Count++
					last.EndFrame = ev.Frame
					continue
				}
			}
		}
		if ev.Count == 0 {
			ev.Count = 1
		}
		out = append(out, ev)
	}
	return out
}

func dedupWindow(ev schema.BuildEvent) int {
	switch ev.EventType {
	case "train", "unit_morph", "building_morph":
		return 8
	case "tech", "upgrade":
		return 48
	case "build", "land":
		return 24
	default:
		return 12
	}
}

func eventPayloadKey(ev schema.BuildEvent) string {
	switch ev.EventType {
	case "tech":
		return strings.ToLower(ev.Tech)
	case "upgrade":
		return strings.ToLower(ev.Upgrade)
	default:
		if ev.X != 0 || ev.Y != 0 {
			return fmt.Sprintf("%s|%d|%d|%s", strings.ToLower(ev.Unit), ev.X, ev.Y, strings.ToLower(ev.Order))
		}
		return fmt.Sprintf("%s|%s", strings.ToLower(ev.Unit), strings.ToLower(ev.Order))
	}
}

func isCancelEventType(t string) bool {
	switch t {
	case "cancel_build", "cancel_train", "cancel_morph", "cancel_tech", "cancel_upgrade":
		return true
	default:
		return false
	}
}

func isWorkerUnit(unit string) bool {
	switch strings.ToLower(strings.TrimSpace(unit)) {
	case "scv", "probe", "drone":
		return true
	default:
		return false
	}
}

// extractChatMessages extracts chat messages from computed data.
func extractChatMessages(chatCmds []*repcmd.ChatCmd, slotPlayerName map[byte]string) []schema.ChatMessage {
	var messages []schema.ChatMessage
	for _, chat := range chatCmds {
		senderName := slotPlayerName[chat.SenderSlotID]
		if senderName == "" {
			senderName = fmt.Sprintf("Player %d", chat.SenderSlotID)
		}
		messages = append(messages, schema.ChatMessage{
			Frame:      int(chat.Base.Frame),
			SenderName: senderName,
			Message:    chat.Message,
		})
	}
	return messages
}

// calculateFileHashFromBytes calculates SHA256 hash of replay bytes.
func calculateFileHashFromBytes(repData []byte) string {
	hash := sha256.New()
	hash.Write(repData)
	return hex.EncodeToString(hash.Sum(nil))
}
