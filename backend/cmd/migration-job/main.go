package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"
	"github.com/xungwoo/stareplays/internal/services/analyzer"
	"github.com/xungwoo/stareplays/internal/services/migration"
	"github.com/xungwoo/stareplays/internal/services/ranking"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	maxSeconds := migration.ParseMaxSeconds(os.Getenv("MIGRATION_SHORT_GAME_MAX_SECONDS"))
	refreshSnapshots := migration.ParseBool(os.Getenv("MIGRATION_REFRESH_SNAPSHOTS"))
	if os.Getenv("MIGRATION_REFRESH_SNAPSHOTS") == "" {
		refreshSnapshots = true
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()

	log.Printf("Migration job started (max_seconds=%d, refresh_snapshots=%t)", maxSeconds, refreshSnapshots)
	result, err := migration.NormalizeShortGames(ctx, maxSeconds)
	if err != nil {
		if err == migration.ErrJobAlreadyRunning {
			log.Printf("Migration job skipped: %v", err)
			return
		}
		log.Fatalf("Migration job failed: %v", err)
	}

	log.Printf(
		"Migration completed: target_games=%d, updated_games=%d, updated_players=%d, computed_at=%s",
		result.TargetGames,
		result.UpdatedGames,
		result.UpdatedPlayers,
		result.ComputedAt.Format(time.RFC3339),
	)

	if !refreshSnapshots {
		return
	}

	rankRes, err := ranking.BuildAndStore3v3Snapshot(ctx, ranking.ParseMinGames(os.Getenv("RANKING_MIN_GAMES")))
	if err != nil {
		if err == ranking.ErrJobAlreadyRunning {
			log.Printf("Ranking snapshot skipped: %v", err)
		} else {
			log.Fatalf("Ranking snapshot refresh failed: %v", err)
		}
	} else {
		log.Printf("Ranking snapshot refreshed: rows=%d, qualified_games=%d", rankRes.Rows, rankRes.QualifiedGames)
	}

	anRes, err := analyzer.BuildAndStoreSnapshot(ctx)
	if err != nil {
		if err == analyzer.ErrJobAlreadyRunning {
			log.Printf("Analyzer snapshot skipped: %v", err)
		} else {
			log.Fatalf("Analyzer snapshot refresh failed: %v", err)
		}
	} else {
		log.Printf("Analyzer snapshot refreshed: rows=%d, qualified_games=%d", anRes.Rows, anRes.QualifiedGames)
	}
}
