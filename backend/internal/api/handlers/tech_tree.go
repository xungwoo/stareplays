package handlers

import (
	"fmt"
	"strings"

	"github.com/xungwoo/stareplays/ent"
	"github.com/xungwoo/stareplays/ent/schema"
)

const framesPerSecond = 23.81

type TechTreeDTO struct {
	Source  string                 `json:"source"`
	Players []TechTreePlayerDTO    `json:"players"`
	Events  []TechTreeEventDTO     `json:"events"`
	Summary []TechTreeSummaryDTO   `json:"summary"`
	Meta    map[string]interface{} `json:"meta,omitempty"`
}

type TechTreePlayerDTO struct {
	Name     string `json:"name"`
	Race     string `json:"race,omitempty"`
	Team     uint8  `json:"team"`
	IsWinner bool   `json:"is_winner"`
	Result   string `json:"result,omitempty"`
}

type TechTreeEventDTO struct {
	PlayerName      string  `json:"player_name"`
	Frame           int     `json:"frame"`
	Second          float64 `json:"second"`
	EndFrame        int     `json:"end_frame,omitempty"`
	EndSecond       float64 `json:"end_second,omitempty"`
	Count           int     `json:"count"`
	Kind            string  `json:"kind"` // tech / upgrade / tech_cancel / upgrade_cancel / prereq_building
	Name            string  `json:"name"`
	NodeKey         string  `json:"node_key"`
	Status          string  `json:"status"` // started / canceled / inefficient
	Quality         string  `json:"quality"`
	IneffKind       string  `json:"ineff_kind,omitempty"`
	SourceEventType string  `json:"source_event_type"`
}

type TechTreeSummaryDTO struct {
	PlayerName       string `json:"player_name"`
	TechCount        int    `json:"tech_count"`
	UpgradeCount     int    `json:"upgrade_count"`
	PrereqBuildCount int    `json:"prereq_build_count"`
	CancelCount      int    `json:"cancel_count"`
	IneffCount       int    `json:"ineff_count"`
}

func buildTechTreeDTO(g *ent.Game, detail *ent.GameDetail) *TechTreeDTO {
	if detail == nil {
		return nil
	}

	orders := detail.CompressedBuildOrders
	source := "compressed_build_orders"
	if len(orders) == 0 {
		orders = detail.BuildOrders
		source = "build_orders"
	}

	playerMeta := make(map[string]*ent.Player)
	players := make([]TechTreePlayerDTO, 0, len(g.Edges.Players))
	for _, p := range g.Edges.Players {
		playerMeta[strings.ToLower(strings.TrimSpace(p.Name))] = p
		players = append(players, TechTreePlayerDTO{
			Name:     p.Name,
			Race:     p.Race,
			Team:     p.Team,
			IsWinner: p.IsWinner,
			Result:   p.Result,
		})
	}

	events := make([]TechTreeEventDTO, 0, 64)
	summaryMap := make(map[string]*TechTreeSummaryDTO)
	for _, order := range orders {
		playerName := strings.TrimSpace(order.PlayerName)
		if playerName == "" {
			continue
		}
		sum := ensureSummary(summaryMap, playerName)
		for _, ev := range order.Events {
			kind, name, ok := classifyTechTreeEvent(ev)
			if !ok {
				continue
			}

			status := "started"
			if strings.HasPrefix(kind, "tech_cancel") || strings.HasPrefix(kind, "upgrade_cancel") {
				status = "canceled"
			} else if !ev.IsEffective {
				status = "inefficient"
			}

			quality := "effective"
			if !ev.IsEffective {
				quality = ev.IneffKind
				if strings.TrimSpace(quality) == "" {
					quality = "ineffective"
				}
			}

			cnt := ev.Count
			if cnt <= 0 {
				cnt = 1
			}
			item := TechTreeEventDTO{
				PlayerName:      playerName,
				Frame:           ev.Frame,
				Second:          frameToSecond(ev.Frame),
				EndFrame:        ev.EndFrame,
				EndSecond:       frameToSecond(ev.EndFrame),
				Count:           cnt,
				Kind:            kind,
				Name:            name,
				NodeKey:         normalizeNodeKey(name),
				Status:          status,
				Quality:         quality,
				IneffKind:       ev.IneffKind,
				SourceEventType: ev.EventType,
			}
			events = append(events, item)
			applySummary(sum, item)
		}
	}

	summaries := make([]TechTreeSummaryDTO, 0, len(summaryMap))
	for _, p := range players {
		if s, ok := summaryMap[p.Name]; ok {
			summaries = append(summaries, *s)
		} else {
			summaries = append(summaries, TechTreeSummaryDTO{PlayerName: p.Name})
		}
	}

	for _, order := range orders {
		name := strings.TrimSpace(order.PlayerName)
		if name == "" {
			continue
		}
		if _, ok := playerMeta[strings.ToLower(name)]; ok {
			continue
		}
		players = append(players, TechTreePlayerDTO{Name: name})
		if _, ok := summaryMap[name]; ok {
			summaries = append(summaries, *summaryMap[name])
		}
	}

	return &TechTreeDTO{
		Source:  source,
		Players: players,
		Events:  events,
		Summary: summaries,
		Meta: map[string]interface{}{
			"event_count":  len(events),
			"player_count": len(players),
		},
	}
}

func frameToSecond(frame int) float64 {
	if frame <= 0 {
		return 0
	}
	return float64(frame) / framesPerSecond
}

func classifyTechTreeEvent(ev schema.BuildEvent) (kind string, name string, ok bool) {
	// Backward compatibility:
	// older stored build_orders may miss event_type but still contain unit/tech/upgrade payload.
	if strings.TrimSpace(ev.Tech) != "" {
		return "tech", strings.TrimSpace(ev.Tech), true
	}
	if strings.TrimSpace(ev.Upgrade) != "" {
		return "upgrade", strings.TrimSpace(ev.Upgrade), true
	}
	if isLikelyTechBuilding(ev.Unit) {
		return "prereq_building", strings.TrimSpace(ev.Unit), true
	}

	switch ev.EventType {
	case "tech":
		return "tech", strings.TrimSpace(ev.Tech), strings.TrimSpace(ev.Tech) != ""
	case "upgrade":
		return "upgrade", strings.TrimSpace(ev.Upgrade), strings.TrimSpace(ev.Upgrade) != ""
	case "cancel_tech":
		return "tech_cancel", "Cancel Tech", true
	case "cancel_upgrade":
		return "upgrade_cancel", "Cancel Upgrade", true
	case "build", "building_morph", "land":
		if isLikelyTechBuilding(ev.Unit) {
			return "prereq_building", strings.TrimSpace(ev.Unit), true
		}
	}
	return "", "", false
}

func isLikelyTechBuilding(unit string) bool {
	u := strings.ToLower(strings.TrimSpace(unit))
	if u == "" {
		return false
	}
	switch u {
	case "academy", "engineering bay", "armory", "science facility", "control tower",
		"covert ops", "physics lab", "machine shop",
		"cybernetics core", "citadel of adun", "templar archives", "forge", "observatory",
		"fleet beacon", "arbiter tribunal", "robotics support bay",
		"hydralisk den", "spire", "greater spire", "queens nest", "ultralisk cavern", "defiler mound", "evolution chamber":
		return true
	default:
		return strings.Contains(u, "archives") || strings.Contains(u, "tribunal") || strings.Contains(u, "cavern")
	}
}

func ensureSummary(m map[string]*TechTreeSummaryDTO, playerName string) *TechTreeSummaryDTO {
	if s, ok := m[playerName]; ok {
		return s
	}
	s := &TechTreeSummaryDTO{PlayerName: playerName}
	m[playerName] = s
	return s
}

func applySummary(s *TechTreeSummaryDTO, ev TechTreeEventDTO) {
	switch ev.Kind {
	case "tech":
		s.TechCount += ev.Count
	case "upgrade":
		s.UpgradeCount += ev.Count
	case "prereq_building":
		s.PrereqBuildCount += ev.Count
	case "tech_cancel", "upgrade_cancel":
		s.CancelCount += ev.Count
	}
	if ev.Status == "inefficient" {
		s.IneffCount += ev.Count
	}
}

func normalizeNodeKey(name string) string {
	n := strings.ToLower(strings.TrimSpace(name))
	n = strings.ReplaceAll(n, " ", "_")
	n = strings.ReplaceAll(n, "-", "_")
	n = strings.ReplaceAll(n, "__", "_")
	if n == "" {
		return "unknown"
	}
	return fmt.Sprintf("node_%s", n)
}
