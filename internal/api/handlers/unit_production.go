package handlers

import (
	"sort"
	"strings"

	"github.com/xungwoo/stareplays/ent"
	"github.com/xungwoo/stareplays/ent/schema"
)

const unitProdWindowFrames = 238 // ~10 seconds

type UnitProductionDTO struct {
	Source    string                      `json:"source"`
	Version   string                      `json:"version,omitempty"`
	Players   []UnitProductionPlayerDTO   `json:"players"`
	Summaries []UnitProductionSummaryDTO  `json:"summaries"`
	Timelines []UnitProductionTimelineDTO `json:"timelines"`
	Meta      map[string]interface{}      `json:"meta,omitempty"`
}

type UnitProductionVersionsDTO struct {
	DefaultVersion  string             `json:"default_version"`
	V1CommandBased  *UnitProductionDTO `json:"v1_command_based,omitempty"`
	V2EffectiveOnly *UnitProductionDTO `json:"v2_effective_only,omitempty"`
}

type unitProductionMode string

const (
	unitProductionModeCommandBased  unitProductionMode = "v1_command_based"
	unitProductionModeEffectiveOnly unitProductionMode = "v2_effective_only"
)

type UnitProductionPlayerDTO struct {
	Name     string `json:"name"`
	Race     string `json:"race,omitempty"`
	Team     uint8  `json:"team"`
	IsWinner bool   `json:"is_winner"`
	Result   string `json:"result,omitempty"`
}

type UnitProductionSummaryDTO struct {
	PlayerName string         `json:"player_name"`
	Total      int            `json:"total"`
	Worker     int            `json:"worker"`
	Army       int            `json:"army"`
	TechUnit   int            `json:"tech_unit"`
	ByUnit     []UnitCountDTO `json:"by_unit"`
}

type UnitCountDTO struct {
	Unit  string `json:"unit"`
	Count int    `json:"count"`
}

type UnitProductionTimelineDTO struct {
	PlayerName string                       `json:"player_name"`
	DataPoints []UnitProductionDataPointDTO `json:"data_points"`
}

type UnitProductionDataPointDTO struct {
	Frame  int     `json:"frame"`
	Second float64 `json:"second"`
	Count  int     `json:"count"`
}

func buildUnitProductionDTO(detail *ent.GameDetail, players []*ent.Player) *UnitProductionDTO {
	return buildUnitProductionDTOWithMode(detail, players, unitProductionModeEffectiveOnly)
}

func buildUnitProductionVersionsDTO(detail *ent.GameDetail, players []*ent.Player) *UnitProductionVersionsDTO {
	v1 := buildUnitProductionDTOWithMode(detail, players, unitProductionModeCommandBased)
	v2 := buildUnitProductionDTOWithMode(detail, players, unitProductionModeEffectiveOnly)
	if v1 == nil && v2 == nil {
		return nil
	}
	return &UnitProductionVersionsDTO{
		DefaultVersion:  string(unitProductionModeEffectiveOnly),
		V1CommandBased:  v1,
		V2EffectiveOnly: v2,
	}
}

func buildUnitProductionDTOWithMode(detail *ent.GameDetail, players []*ent.Player, mode unitProductionMode) *UnitProductionDTO {
	if detail == nil {
		return nil
	}

	var orders []schema.PlayerBuildOrder
	source := ""
	switch mode {
	case unitProductionModeCommandBased:
		orders = detail.BuildOrders
		source = "build_orders"
		if len(orders) == 0 {
			orders = detail.CompressedBuildOrders
			source = "compressed_build_orders"
		}
	default:
		orders = detail.CompressedBuildOrders
		source = "compressed_build_orders"
		if len(orders) == 0 {
			orders = detail.BuildOrders
			source = "build_orders"
		}
	}

	playerRows := make([]UnitProductionPlayerDTO, 0, len(players))
	playerSummary := make(map[string]*UnitProductionSummaryDTO, len(players))
	for _, p := range players {
		playerRows = append(playerRows, UnitProductionPlayerDTO{
			Name:     p.Name,
			Race:     p.Race,
			Team:     p.Team,
			IsWinner: p.IsWinner,
			Result:   p.Result,
		})
		playerSummary[p.Name] = &UnitProductionSummaryDTO{
			PlayerName: p.Name,
		}
	}

	timelineBuckets := make(map[string]map[int]int)
	totalEvents := 0
	rejectedEvents := 0

	for _, order := range orders {
		name := strings.TrimSpace(order.PlayerName)
		if name == "" {
			continue
		}
		if _, ok := playerSummary[name]; !ok {
			playerRows = append(playerRows, UnitProductionPlayerDTO{Name: name})
			playerSummary[name] = &UnitProductionSummaryDTO{PlayerName: name}
		}
		if _, ok := timelineBuckets[name]; !ok {
			timelineBuckets[name] = make(map[int]int)
		}

		for _, ev := range order.Events {
			unit, count, ok := classifyProductionEvent(ev, mode)
			if !ok {
				rejectedEvents++
				continue
			}
			sum := playerSummary[name]
			sum.Total += count
			if isWorkerUnitForUnitProd(unit) {
				sum.Worker += count
			} else if isTechUnit(unit) {
				sum.TechUnit += count
			} else {
				sum.Army += count
			}
			appendUnitCount(sum, unit, count)

			window := int(ev.Frame) / unitProdWindowFrames
			timelineBuckets[name][window] += count
			totalEvents += count
		}
	}

	timelines := make([]UnitProductionTimelineDTO, 0, len(playerRows))
	for _, p := range playerRows {
		buckets := timelineBuckets[p.Name]
		if len(buckets) == 0 {
			timelines = append(timelines, UnitProductionTimelineDTO{
				PlayerName: p.Name,
				DataPoints: []UnitProductionDataPointDTO{},
			})
			continue
		}
		maxW := 0
		for w := range buckets {
			if w > maxW {
				maxW = w
			}
		}
		points := make([]UnitProductionDataPointDTO, 0, maxW+1)
		for w := 0; w <= maxW; w++ {
			frame := w * unitProdWindowFrames
			points = append(points, UnitProductionDataPointDTO{
				Frame:  frame,
				Second: frameToSecond(frame),
				Count:  buckets[w],
			})
		}
		timelines = append(timelines, UnitProductionTimelineDTO{
			PlayerName: p.Name,
			DataPoints: points,
		})
	}

	summaries := make([]UnitProductionSummaryDTO, 0, len(playerRows))
	for _, p := range playerRows {
		s := playerSummary[p.Name]
		sort.SliceStable(s.ByUnit, func(i, j int) bool {
			if s.ByUnit[i].Count != s.ByUnit[j].Count {
				return s.ByUnit[i].Count > s.ByUnit[j].Count
			}
			return s.ByUnit[i].Unit < s.ByUnit[j].Unit
		})
		summaries = append(summaries, *s)
	}

	return &UnitProductionDTO{
		Source:    source,
		Version:   string(mode),
		Players:   playerRows,
		Summaries: summaries,
		Timelines: timelines,
		Meta: map[string]interface{}{
			"event_count":        totalEvents,
			"rejected_events":    rejectedEvents,
			"player_count":       len(playerRows),
			"filter_policy":      unitProductionFilterPolicy(mode),
			"aggregation_window": unitProdWindowFrames,
		},
	}
}

func appendUnitCount(s *UnitProductionSummaryDTO, unit string, count int) {
	u := strings.TrimSpace(unit)
	if u == "" || count <= 0 {
		return
	}
	for i := range s.ByUnit {
		if strings.EqualFold(s.ByUnit[i].Unit, u) {
			s.ByUnit[i].Count += count
			return
		}
	}
	s.ByUnit = append(s.ByUnit, UnitCountDTO{Unit: u, Count: count})
}

func classifyProductionEvent(ev schema.BuildEvent, mode unitProductionMode) (unit string, count int, ok bool) {
	if isCancelEventTypeForUnitProd(ev.EventType) {
		return "", 0, false
	}
	if mode == unitProductionModeEffectiveOnly {
		if !ev.IsEffective {
			return "", 0, false
		}
		kind := strings.TrimSpace(strings.ToLower(ev.IneffKind))
		if kind != "" && kind != "effective" {
			return "", 0, false
		}
	}

	u := strings.TrimSpace(ev.Unit)
	if u == "" {
		return "", 0, false
	}
	if isLikelyBuildingName(u) {
		return "", 0, false
	}

	switch ev.EventType {
	case "", "train", "unit_morph", "building_morph":
		// backward-compatible for old rows with empty event_type
	default:
		return "", 0, false
	}

	c := ev.Count
	if c <= 0 {
		c = 1
	}
	return u, c, true
}

func unitProductionFilterPolicy(mode unitProductionMode) string {
	switch mode {
	case unitProductionModeEffectiveOnly:
		return "event_type in [train,unit_morph,building_morph], non-building unit, is_effective=true, non-cancel"
	default:
		return "event_type in [train,unit_morph,building_morph], non-building unit, non-cancel"
	}
}

func isCancelEventTypeForUnitProd(t string) bool {
	switch t {
	case "cancel_build", "cancel_train", "cancel_morph", "cancel_tech", "cancel_upgrade":
		return true
	default:
		return false
	}
}

func isWorkerUnitForUnitProd(unit string) bool {
	switch strings.ToLower(strings.TrimSpace(unit)) {
	case "scv", "probe", "drone":
		return true
	default:
		return false
	}
}

func isLikelyBuildingName(unit string) bool {
	u := strings.ToLower(strings.TrimSpace(unit))
	if u == "" {
		return false
	}
	buildingKeywords := []string{
		"command center", "comsat", "nuclear silo", "supply depot", "refinery", "barracks", "academy",
		"factory", "starport", "science facility", "engineering bay", "armory", "missile turret", "bunker",
		"machine shop", "control tower", "covert ops", "physics lab",
		"nexus", "pylon", "assimilator", "gateway", "forge", "photon cannon", "cybernetics core",
		"shield battery", "robotics facility", "stargate", "citadel of adun", "robotics support bay",
		"fleet beacon", "templar archives", "observatory", "arbiter tribunal",
		"hatchery", "lair", "hive", "extractor", "spawning pool", "evolution chamber", "hydralisk den",
		"spire", "greater spire", "queen's nest", "ultralisk cavern", "defiler mound", "nydus canal",
		"creep colony", "sunken colony", "spore colony",
	}
	for _, kw := range buildingKeywords {
		if strings.Contains(u, kw) {
			return true
		}
	}
	return false
}

func isTechUnit(unit string) bool {
	u := strings.ToLower(strings.TrimSpace(unit))
	if u == "" {
		return false
	}
	techUnits := []string{
		"ghost", "science vessel", "battlecruiser", "valkyrie",
		"high templar", "dark templar", "arbiter", "carrier", "reaver", "observer", "corsair",
		"queen", "defiler", "ultralisk", "lurker", "guardian", "devourer",
	}
	for _, k := range techUnits {
		if strings.Contains(u, k) {
			return true
		}
	}
	return false
}
