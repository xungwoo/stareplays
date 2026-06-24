package database

import (
	"strings"
	"testing"
)

func TestPerformanceIndexStatementsCoverGamesAndPlayerLookup(t *testing.T) {
	statements := performanceIndexStatements()
	joined := strings.Join(statements, "\n")

	if !strings.Contains(joined, "games_start_time_created_at_idx") {
		t.Fatalf("performance indexes = %q, want games latest-order index", joined)
	}
	if !strings.Contains(joined, "players_lower_name_idx") {
		t.Fatalf("performance indexes = %q, want case-insensitive player lookup index", joined)
	}
	if !strings.Contains(joined, "lower(name)") {
		t.Fatalf("performance indexes = %q, want functional lower(name) index", joined)
	}
}
