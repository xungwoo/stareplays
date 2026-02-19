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
	"github.com/xungwoo/stareplays/internal/services/analyzer"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	if err := database.Connect(); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer func() {
		if err := database.Close(); err != nil {
			log.Printf("Failed to close database: %v", err)
		}
	}()

	mode := strings.ToLower(strings.TrimSpace(os.Getenv("ANALYZER_JOB_MODE")))
	if mode == "" {
		mode = "once"
	}
	interval := analyzer.ParseInterval(os.Getenv("ANALYZER_JOB_INTERVAL"))
	log.Printf("Analyzer job started (mode=%s, interval=%s)", mode, interval)

	switch mode {
	case "daemon":
		runDaemon(interval)
	default:
		runOnce()
	}
}

func runOnce() {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()

	result, err := analyzer.BuildAndStoreSnapshot(ctx)
	if err != nil {
		if err == analyzer.ErrJobAlreadyRunning {
			log.Printf("Analyzer job skipped: %v", err)
			return
		}
		log.Fatalf("Analyzer job failed: %v", err)
	}
	log.Printf("Analyzer snapshot completed: rows=%d, qualified_games=%d, computed_at=%s",
		result.Rows, result.QualifiedGames, result.ComputedAt.Format(time.RFC3339))
}

func runDaemon(interval time.Duration) {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	runTick := func() {
		jobCtx, cancel := context.WithTimeout(ctx, 15*time.Minute)
		defer cancel()

		result, err := analyzer.BuildAndStoreSnapshot(jobCtx)
		if err != nil {
			if err == analyzer.ErrJobAlreadyRunning {
				log.Printf("Analyzer job skipped: %v", err)
				return
			}
			log.Printf("Analyzer job failed: %v", err)
			return
		}
		log.Printf("Analyzer snapshot completed: rows=%d, qualified_games=%d, computed_at=%s",
			result.Rows, result.QualifiedGames, result.ComputedAt.Format(time.RFC3339))
	}

	runTick()
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("Analyzer daemon stopped")
			return
		case <-ticker.C:
			runTick()
		}
	}
}
