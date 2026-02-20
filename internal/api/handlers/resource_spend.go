package handlers

import (
	"sort"
	"strings"

	"github.com/xungwoo/stareplays/ent"
	"github.com/xungwoo/stareplays/ent/schema"
)

const resourceSpendWindowFrames = 238 // ~10 seconds

type ResourceSpendDTO struct {
	Source    string                     `json:"source"`
	Players   []ResourceSpendPlayerDTO   `json:"players"`
	Summaries []ResourceSpendSummaryDTO  `json:"summaries"`
	Timelines []ResourceSpendTimelineDTO `json:"timelines"`
	Meta      map[string]interface{}     `json:"meta,omitempty"`
}

type ResourceSpendPlayerDTO struct {
	Name     string `json:"name"`
	Race     string `json:"race,omitempty"`
	Team     uint8  `json:"team"`
	IsWinner bool   `json:"is_winner"`
	Result   string `json:"result,omitempty"`
}

type ResourceSpendSummaryDTO struct {
	PlayerName    string                     `json:"player_name"`
	TotalMineral  int                        `json:"total_mineral"`
	TotalGas      int                        `json:"total_gas"`
	TotalSpend    int                        `json:"total_spend"`
	ByCategory    []ResourceSpendCategoryDTO `json:"by_category"`
	UnknownCostCt int                        `json:"unknown_cost_count"`
}

type ResourceSpendCategoryDTO struct {
	Category string `json:"category"` // production/build/tech/upgrade
	Mineral  int    `json:"mineral"`
	Gas      int    `json:"gas"`
	Total    int    `json:"total"`
}

type ResourceSpendTimelineDTO struct {
	PlayerName string                      `json:"player_name"`
	DataPoints []ResourceSpendDataPointDTO `json:"data_points"`
}

type ResourceSpendDataPointDTO struct {
	Frame   int     `json:"frame"`
	Second  float64 `json:"second"`
	Mineral int     `json:"mineral"`
	Gas     int     `json:"gas"`
	Total   int     `json:"total"`
}

func buildResourceSpendDTO(detail *ent.GameDetail, players []*ent.Player) *ResourceSpendDTO {
	if detail == nil {
		return nil
	}

	orders := detail.CompressedBuildOrders
	source := "compressed_build_orders"
	if len(orders) == 0 {
		orders = detail.BuildOrders
		source = "build_orders"
	}

	playerRows := make([]ResourceSpendPlayerDTO, 0, len(players))
	summaryMap := make(map[string]*ResourceSpendSummaryDTO, len(players))
	for _, p := range players {
		playerRows = append(playerRows, ResourceSpendPlayerDTO{
			Name:     p.Name,
			Race:     p.Race,
			Team:     p.Team,
			IsWinner: p.IsWinner,
			Result:   p.Result,
		})
		summaryMap[p.Name] = &ResourceSpendSummaryDTO{
			PlayerName: p.Name,
			ByCategory: defaultSpendCategories(),
		}
	}

	type spendBucket struct {
		Mineral int
		Gas     int
	}
	timelineBuckets := make(map[string]map[int]*spendBucket)
	totalEvents := 0
	unknownCostEvents := 0

	for _, order := range orders {
		name := strings.TrimSpace(order.PlayerName)
		if name == "" {
			continue
		}
		if _, ok := summaryMap[name]; !ok {
			playerRows = append(playerRows, ResourceSpendPlayerDTO{Name: name})
			summaryMap[name] = &ResourceSpendSummaryDTO{
				PlayerName: name,
				ByCategory: defaultSpendCategories(),
			}
		}
		if _, ok := timelineBuckets[name]; !ok {
			timelineBuckets[name] = make(map[int]*spendBucket)
		}

		for _, ev := range order.Events {
			category, mineral, gas, ok := classifySpendEvent(ev)
			if !ok {
				continue
			}
			totalEvents++
			if mineral == 0 && gas == 0 {
				summaryMap[name].UnknownCostCt++
				unknownCostEvents++
			}

			sum := summaryMap[name]
			sum.TotalMineral += mineral
			sum.TotalGas += gas
			sum.TotalSpend += mineral + gas
			addCategorySpend(sum.ByCategory, category, mineral, gas)

			window := int(ev.Frame) / resourceSpendWindowFrames
			if _, ok := timelineBuckets[name][window]; !ok {
				timelineBuckets[name][window] = &spendBucket{}
			}
			timelineBuckets[name][window].Mineral += mineral
			timelineBuckets[name][window].Gas += gas
		}
	}

	timelines := make([]ResourceSpendTimelineDTO, 0, len(playerRows))
	for _, p := range playerRows {
		buckets := timelineBuckets[p.Name]
		if len(buckets) == 0 {
			timelines = append(timelines, ResourceSpendTimelineDTO{
				PlayerName: p.Name,
				DataPoints: []ResourceSpendDataPointDTO{},
			})
			continue
		}
		maxW := 0
		for w := range buckets {
			if w > maxW {
				maxW = w
			}
		}
		points := make([]ResourceSpendDataPointDTO, 0, maxW+1)
		for w := 0; w <= maxW; w++ {
			frame := w * resourceSpendWindowFrames
			b := buckets[w]
			m := 0
			g := 0
			if b != nil {
				m = b.Mineral
				g = b.Gas
			}
			points = append(points, ResourceSpendDataPointDTO{
				Frame:   frame,
				Second:  frameToSecond(frame),
				Mineral: m,
				Gas:     g,
				Total:   m + g,
			})
		}
		timelines = append(timelines, ResourceSpendTimelineDTO{
			PlayerName: p.Name,
			DataPoints: points,
		})
	}

	summaries := make([]ResourceSpendSummaryDTO, 0, len(playerRows))
	for _, p := range playerRows {
		s := summaryMap[p.Name]
		sort.SliceStable(s.ByCategory, func(i, j int) bool {
			return s.ByCategory[i].Category < s.ByCategory[j].Category
		})
		summaries = append(summaries, *s)
	}

	return &ResourceSpendDTO{
		Source:    source,
		Players:   playerRows,
		Summaries: summaries,
		Timelines: timelines,
		Meta: map[string]interface{}{
			"event_count":         totalEvents,
			"unknown_cost_events": unknownCostEvents,
			"player_count":        len(playerRows),
		},
	}
}

func defaultSpendCategories() []ResourceSpendCategoryDTO {
	return []ResourceSpendCategoryDTO{
		{Category: "build"},
		{Category: "production"},
		{Category: "tech"},
		{Category: "upgrade"},
	}
}

func addCategorySpend(cats []ResourceSpendCategoryDTO, category string, mineral, gas int) {
	for i := range cats {
		if cats[i].Category == category {
			cats[i].Mineral += mineral
			cats[i].Gas += gas
			cats[i].Total += mineral + gas
			return
		}
	}
}

func classifySpendEvent(ev schema.BuildEvent) (category string, mineral int, gas int, ok bool) {
	if isCancelEventTypeForUnitProd(ev.EventType) {
		return "", 0, 0, false
	}

	unit := strings.TrimSpace(ev.Unit)
	tech := strings.TrimSpace(ev.Tech)
	upgrade := strings.TrimSpace(ev.Upgrade)
	cnt := ev.Count
	if cnt <= 0 {
		cnt = 1
	}

	switch ev.EventType {
	case "build", "building_morph", "land":
		m, g := costByUnit(unit)
		return "build", m * cnt, g * cnt, true
	case "train", "unit_morph":
		m, g := costByUnit(unit)
		return "production", m * cnt, g * cnt, true
	case "tech":
		m, g := costByTech(tech)
		return "tech", m * cnt, g * cnt, true
	case "upgrade":
		m, g := costByUpgrade(upgrade)
		return "upgrade", m * cnt, g * cnt, true
	case "":
		// Backward-compatibility for old rows with missing event_type.
		if tech != "" {
			m, g := costByTech(tech)
			return "tech", m * cnt, g * cnt, true
		}
		if upgrade != "" {
			m, g := costByUpgrade(upgrade)
			return "upgrade", m * cnt, g * cnt, true
		}
		if unit != "" {
			m, g := costByUnit(unit)
			if isLikelyBuildingName(unit) {
				return "build", m * cnt, g * cnt, true
			}
			return "production", m * cnt, g * cnt, true
		}
		return "", 0, 0, false
	default:
		return "", 0, 0, false
	}
}

func costByUnit(name string) (int, int) {
	if c, ok := unitCostTable[strings.ToLower(strings.TrimSpace(name))]; ok {
		return c[0], c[1]
	}
	return 0, 0
}

func costByTech(name string) (int, int) {
	if c, ok := techCostTable[strings.ToLower(strings.TrimSpace(name))]; ok {
		return c[0], c[1]
	}
	return 0, 0
}

func costByUpgrade(name string) (int, int) {
	if c, ok := upgradeCostTable[strings.ToLower(strings.TrimSpace(name))]; ok {
		return c[0], c[1]
	}
	return 0, 0
}

var unitCostTable = map[string][2]int{
	"scv":                    {50, 0},
	"probe":                  {50, 0},
	"drone":                  {50, 0},
	"marine":                 {50, 0},
	"medic":                  {50, 25},
	"firebat":                {50, 25},
	"ghost":                  {25, 75},
	"vulture":                {75, 0},
	"siege tank (tank mode)": {150, 100},
	"goliath":                {100, 50},
	"wraith":                 {150, 100},
	"dropship":               {100, 100},
	"science vessel":         {100, 225},
	"battlecruiser":          {400, 300},
	"valkyrie":               {250, 125},
	"zealot":                 {100, 0},
	"dragoon":                {125, 50},
	"high templar":           {50, 150},
	"dark templar":           {125, 100},
	"archon":                 {0, 0},
	"shuttle":                {200, 200},
	"reaver":                 {200, 100},
	"observer":               {25, 75},
	"corsair":                {150, 100},
	"carrier":                {350, 250},
	"zergling":               {50, 0},
	"hydralisk":              {75, 25},
	"lurker":                 {50, 100},
	"mutalisk":               {100, 100},
	"guardian":               {50, 100},
	"devourer":               {150, 50},
	"ultralisk":              {200, 200},
	"defiler":                {50, 150},
	"queen":                  {100, 100},
	"overlord":               {100, 0},
	"command center":         {400, 0},
	"supply depot":           {100, 0},
	"refinery":               {100, 0},
	"barracks":               {150, 0},
	"academy":                {150, 0},
	"factory":                {200, 100},
	"starport":               {150, 100},
	"science facility":       {100, 150},
	"engineering bay":        {125, 0},
	"armory":                 {100, 50},
	"missile turret":         {75, 0},
	"bunker":                 {100, 0},
	"machine shop":           {50, 50},
	"control tower":          {50, 50},
	"covert ops":             {50, 50},
	"physics lab":            {50, 50},
	"nuclear silo":           {100, 100},
	"comsat":                 {50, 50},
	"nexus":                  {400, 0},
	"pylon":                  {100, 0},
	"assimilator":            {100, 0},
	"gateway":                {150, 0},
	"forge":                  {150, 0},
	"photon cannon":          {150, 0},
	"cybernetics core":       {200, 0},
	"shield battery":         {100, 0},
	"robotics facility":      {200, 200},
	"stargate":               {150, 150},
	"citadel of adun":        {150, 100},
	"robotics support bay":   {150, 100},
	"fleet beacon":           {300, 200},
	"templar archives":       {150, 200},
	"observatory":            {50, 100},
	"arbiter tribunal":       {200, 150},
	"hatchery":               {300, 0},
	"lair":                   {150, 100},
	"hive":                   {200, 150},
	"extractor":              {50, 0},
	"spawning pool":          {200, 0},
	"evolution chamber":      {75, 0},
	"hydralisk den":          {100, 50},
	"spire":                  {200, 150},
	"greater spire":          {100, 150},
	"queen's nest":           {150, 100},
	"ultralisk cavern":       {150, 200},
	"defiler mound":          {100, 100},
	"nydus canal":            {150, 0},
	"creep colony":           {75, 0},
	"sunken colony":          {50, 0},
	"spore colony":           {50, 0},
}

var techCostTable = map[string][2]int{
	"stim packs":       {100, 100},
	"u-238 shells":     {150, 150},
	"spider mines":     {100, 100},
	"siege mode":       {150, 150},
	"cloak":            {150, 150},
	"yamato gun":       {100, 100},
	"emp shockwave":    {200, 200},
	"irradiate":        {200, 200},
	"lockdown":         {200, 200},
	"psionic storm":    {200, 200},
	"hallucination":    {150, 150},
	"mind control":     {200, 200},
	"maelstrom":        {100, 100},
	"recall":           {150, 150},
	"stasis field":     {150, 150},
	"dark swarm":       {100, 100},
	"plague":           {200, 200},
	"consume":          {100, 100},
	"ensnare":          {100, 100},
	"spawn broodlings": {100, 100},
	"lurker aspect":    {200, 200},
}

var upgradeCostTable = map[string][2]int{
	"terran infantry armor":   {100, 100},
	"terran infantry weapons": {100, 100},
	"terran vehicle plating":  {100, 100},
	"terran vehicle weapons":  {100, 100},
	"terran ship plating":     {150, 150},
	"terran ship weapons":     {100, 100},
	"protoss ground armor":    {100, 100},
	"protoss ground weapons":  {100, 100},
	"protoss plasma shields":  {200, 200},
	"protoss air armor":       {150, 150},
	"protoss air weapons":     {100, 100},
	"zerg carapace":           {150, 150},
	"zerg melee attacks":      {100, 100},
	"zerg missile attacks":    {100, 100},
	"zerg flyer carapace":     {150, 150},
	"zerg flyer attacks":      {100, 100},
	"muscular augments":       {150, 150},
	"grooved spines":          {150, 150},
	"metabolic boost":         {100, 100},
	"adrenal glands":          {200, 200},
	"singularity charge":      {150, 150},
	"leg enhancements":        {150, 150},
	"carrier capacity":        {100, 100},
	"khaydarin amulet":        {150, 150},
}
