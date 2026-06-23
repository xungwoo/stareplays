package handlers

import (
	"strings"
	"testing"
	"time"

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
