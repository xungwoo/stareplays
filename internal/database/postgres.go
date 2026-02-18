package database

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/xungwoo/stareps/ent"
	_ "github.com/lib/pq"
)

var Client *ent.Client

func Connect() error {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
		os.Getenv("DB_SSLMODE"),
	)

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

	log.Println("Schema migration completed")
	return nil
}

func Close() error {
	if Client != nil {
		return Client.Close()
	}
	return nil
}
