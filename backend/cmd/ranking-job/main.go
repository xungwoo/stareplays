package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/xungwoo/stareplays/internal/database"
	"github.com/xungwoo/stareplays/internal/services/ranking"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	if err := database.Connect(); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer func() {
		err := database.Close()
		if err != nil {
			log.Fatalf("database.Close fail: %v", err)
		}
	}()

	mode := strings.ToLower(strings.TrimSpace(os.Getenv("RANKING_JOB_MODE")))
	if mode == "" {
		mode = "once"
	}
	minGames := ranking.ParseMinGames(os.Getenv("RANKING_MIN_GAMES"))
	interval := ranking.ParseInterval(os.Getenv("RANKING_JOB_INTERVAL"))

	log.Printf("Ranking job started (mode=%s, min_games=%d, interval=%s)", mode, minGames, interval)

	switch mode {
	case "daemon":
		runDaemon(minGames, interval)
	default:
		runOnce(minGames)
	}
}

func runOnce(minGames int) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()

	result, err := ranking.BuildAndStore3v3Snapshot(ctx, minGames)
	if err != nil {
		if err == ranking.ErrJobAlreadyRunning {
			log.Printf("Ranking job skipped: %v", err)
			return
		}
		log.Fatalf("Ranking job failed: %v", err)
	}
	log.Printf("Ranking snapshot completed: rows=%d, qualified_games=%d, min_games=%d, computed_at=%s",
		result.Rows, result.QualifiedGames, result.MinGames, result.ComputedAt.Format(time.RFC3339))
}

func runDaemon(minGames int, interval time.Duration) {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	runTick := func() {
		jobCtx, cancel := context.WithTimeout(ctx, 15*time.Minute)
		defer cancel()

		result, err := ranking.BuildAndStore3v3Snapshot(jobCtx, minGames)
		if err != nil {
			if err == ranking.ErrJobAlreadyRunning {
				log.Printf("Ranking job skipped: %v", err)
				return
			}
			log.Printf("Ranking job failed: %v", err)
			return
		}
		log.Printf("Ranking snapshot completed: rows=%d, qualified_games=%d, min_games=%d, computed_at=%s",
			result.Rows, result.QualifiedGames, result.MinGames, result.ComputedAt.Format(time.RFC3339))
	}

	runTick()
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("Ranking daemon stopped")
			return
		case <-ticker.C:
			runTick()
		}
	}
}
