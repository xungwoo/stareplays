package database

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"

	_ "github.com/lib/pq"
	"github.com/xungwoo/stareplays/ent"
)

var Client *ent.Client

func Connect() error {
	dsn := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dsn == "" {
		dsn = fmt.Sprintf(
			"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
			os.Getenv("DB_HOST"),
			os.Getenv("DB_PORT"),
			os.Getenv("DB_USER"),
			os.Getenv("DB_PASSWORD"),
			os.Getenv("DB_NAME"),
			os.Getenv("DB_SSLMODE"),
		)
	}

	client, err := ent.Open("postgres", dsn)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	Client = client
	log.Println("Database connected successfully")

	// Run auto-migration
	ctx := context.Background()
	if err := Client.Schema.Create(ctx); err != nil {
		return fmt.Errorf("failed to create schema: %w", err)
	}
	if err := ensurePerformanceIndexes(ctx, dsn); err != nil {
		return fmt.Errorf("failed to ensure performance indexes: %w", err)
	}

	log.Println("Schema migration completed")
	return nil
}

func performanceIndexStatements() []string {
	return []string{
		`CREATE INDEX IF NOT EXISTS games_start_time_created_at_idx ON games (start_time DESC, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS players_name_game_idx ON players (name, game_players)`,
		`CREATE INDEX IF NOT EXISTS players_lower_name_idx ON players (lower(name))`,
	}
}

func ensurePerformanceIndexes(ctx context.Context, dsn string) error {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return err
	}
	defer db.Close()

	for _, statement := range performanceIndexStatements() {
		if _, err := db.ExecContext(ctx, statement); err != nil {
			return err
		}
	}
	return nil
}

func Close() error {
	if Client != nil {
		return Client.Close()
	}
	return nil
}
