package handlers

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/xungwoo/stareplays/ent"
	"github.com/xungwoo/stareplays/ent/enttest"
	"github.com/xungwoo/stareplays/ent/schema"
	"github.com/xungwoo/stareplays/internal/database"
	"github.com/xungwoo/stareplays/internal/parser"

	_ "github.com/mattn/go-sqlite3"
)

func TestProcessParsedReplayRejectsNonThreeVsThreePlayersBeforeDBWrite(t *testing.T) {
	parsed := minimalParsedGame([]string{"3x3_GG", "outsider", "3x3_mh", "3x3_smwoo", "3x3_pil", "3x3_syntax"})

	status, payload := processParsedReplayResult(t.Context(), parsed, uploadOptions{}, nil)

	if status != 400 {
		t.Fatalf("status = %d, want 400", status)
	}
	if got := payload["error"]; got != "replay contains non-3x3 players" {
		t.Fatalf("error = %v", got)
	}
	nonPlayers, ok := payload["non_players"].([]string)
	if !ok {
		t.Fatalf("non_players has type %T", payload["non_players"])
	}
	if len(nonPlayers) != 1 || nonPlayers[0] != "outsider" {
		t.Fatalf("non_players = %v, want [outsider]", nonPlayers)
	}
}

func TestBuildSeasonSummariesOmitsGameDataByDefault(t *testing.T) {
	seasonLabel := "시즌8"
	seasonNo := 8
	games := []*ent.Game{
		{
			ID:          101,
			StartTime:   time.Date(2026, 6, 23, 21, 0, 0, 0, time.UTC),
			SeasonLabel: &seasonLabel,
			SeasonNo:    &seasonNo,
			WinnerTeam:  1,
		},
	}

	summaries := buildSeasonSummaries(games, false)

	if len(summaries) != 1 {
		t.Fatalf("len(summaries) = %d, want 1", len(summaries))
	}
	if summaries[0].GamesData != nil {
		t.Fatalf("GamesData = %#v, want nil for lightweight season response", summaries[0].GamesData)
	}
	if len(summaries[0].GameIDs) != 1 || summaries[0].GameIDs[0] != 101 {
		t.Fatalf("GameIDs = %v, want [101]", summaries[0].GameIDs)
	}
}

func TestBuildSeasonSummariesIncludesGameDataWhenRequested(t *testing.T) {
	seasonLabel := "시즌8"
	seasonNo := 8
	games := []*ent.Game{
		{
			ID:          101,
			MapName:     "Team Arena",
			StartTime:   time.Date(2026, 6, 23, 21, 0, 0, 0, time.UTC),
			SeasonLabel: &seasonLabel,
			SeasonNo:    &seasonNo,
			WinnerTeam:  1,
			Edges: ent.GameEdges{
				Players: []*ent.Player{
					{Name: "3x3_GG", Race: "P", Team: 1, IsRandomSelected: true},
				},
			},
		},
	}

	summaries := buildSeasonSummaries(games, true)

	if len(summaries) != 1 {
		t.Fatalf("len(summaries) = %d, want 1", len(summaries))
	}
	if len(summaries[0].GamesData) != 1 {
		t.Fatalf("len(GamesData) = %d, want 1", len(summaries[0].GamesData))
	}
	if got := summaries[0].GamesData[0].Edges.Players[0].Name; got != "3x3_GG" {
		t.Fatalf("GamesData[0].Edges.Players[0].Name = %q, want 3x3_GG", got)
	}
	if !summaries[0].GamesData[0].Edges.Players[0].IsRandomSelected {
		t.Fatalf("GamesData[0].Edges.Players[0].IsRandomSelected = false, want true")
	}
}

func TestListGamesIncludesDetailDerivedSeasonAnalysis(t *testing.T) {
	ctx := t.Context()
	previousClient := database.Client
	client := enttest.Open(t, "sqlite3", "file:list_games_season_analysis?mode=memory&cache=shared&_fk=1")
	t.Cleanup(func() {
		database.Client = previousClient
		_ = client.Close()
	})
	database.Client = client

	g := client.Game.Create().
		SetHost("3x3_GG").
		SetStartTime(time.Date(2026, 6, 27, 12, 0, 0, 0, time.UTC)).
		SetMapName("Team Circuit").
		SetGameLength(600).
		SetPlayerCount(6).
		SetWinnerTeam(1).
		SaveX(ctx)
	client.Player.Create().
		SetGame(g).
		SetName("3x3_GG").
		SetRace("Protoss").
		SetTeam(1).
		SetPlayerID(0).
		SaveX(ctx)
	client.GameDetail.Create().
		SetGame(g).
		SetCompressedBuildOrders([]schema.PlayerBuildOrder{
			{
				PlayerName: "3x3_GG",
				Events: []schema.BuildEvent{
					{Frame: 120, EventType: "train", Unit: "Zealot", Count: 2, IsEffective: true},
					{Frame: 240, EventType: "build", Unit: "Gateway", Count: 1, IsEffective: true},
				},
			},
		}).
		SaveX(ctx)

	app := fiber.New()
	app.Get("/games", ListGames)
	req := httptest.NewRequest("GET", "/games?limit=1", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	var body struct {
		Games []gameResponseDTO `json:"games"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(body.Games) != 1 {
		t.Fatalf("len(games) = %d, want 1", len(body.Games))
	}
	analysis := body.Games[0].SeasonAnalysis
	if analysis == nil {
		t.Fatalf("season_analysis is nil, want detail-derived metrics")
	}
	if body.Games[0].Edges.GameDetail != nil {
		t.Fatalf("edges.game_detail is present, want list responses to omit heavy raw detail payload")
	}
	player := analysis.Players["3x3_GG"]
	if player.Production != 2 {
		t.Fatalf("production = %v, want 2", player.Production)
	}
	if player.ResourceSpend != 350 {
		t.Fatalf("resource_spend = %v, want 350", player.ResourceSpend)
	}
}

func TestWindowedTotalUsesLookaheadWithoutExactCount(t *testing.T) {
	total := windowedTotal(12, 12, true)

	if total != 25 {
		t.Fatalf("total = %d, want 25", total)
	}
}

func TestWindowedTotalStopsAtLastPage(t *testing.T) {
	total := windowedTotal(24, 3, false)

	if total != 27 {
		t.Fatalf("total = %d, want 27", total)
	}
}

func TestIsRandomSelectedSeasonOnlyForSeasonSevenAndEight(t *testing.T) {
	season6 := 6
	season7 := 7
	season8 := 8

	if isRandomSelectedSeason(&season6) {
		t.Fatalf("season6 should not be forced random")
	}
	if !isRandomSelectedSeason(&season7) {
		t.Fatalf("season7 should be forced random")
	}
	if !isRandomSelectedSeason(&season8) {
		t.Fatalf("season8 should be forced random")
	}
	if isRandomSelectedSeason(nil) {
		t.Fatalf("nil season should not be forced random")
	}
}

func minimalParsedGame(names []string) *parser.ParsedGame {
	players := make([]parser.ParsedPlayer, 0, len(names))
	for index, name := range names {
		team := byte(1)
		if index >= 3 {
			team = 2
		}
		players = append(players, parser.ParsedPlayer{
			Name:     strings.TrimSpace(name),
			Race:     "Protoss",
			Team:     team,
			PlayerID: byte(index),
			Result:   "loss",
		})
	}
	return &parser.ParsedGame{
		Filename:    "minimal.rep",
		FileHash:    "minimal-hash",
		Host:        "3x3_GG",
		StartTime:   time.Date(2026, 6, 23, 12, 0, 0, 0, time.UTC),
		MapName:     "테스트맵",
		GameLength:  900,
		GameType:    "Top vs Bottom",
		GameSpeed:   "Fastest",
		WinnerTeam:  1,
		PlayerCount: len(players),
		Players:     players,
	}
}
