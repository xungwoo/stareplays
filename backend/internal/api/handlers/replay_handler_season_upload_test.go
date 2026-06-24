package handlers

import (
	"strings"
	"testing"
	"time"

	"github.com/xungwoo/stareplays/ent"
	"github.com/xungwoo/stareplays/internal/parser"
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
					{Name: "3x3_GG", Race: "P", Team: 1},
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
