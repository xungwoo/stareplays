package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"sort"
	"strings"

	_ "github.com/lib/pq"
	"github.com/xungwoo/stareplays/ent"
	"github.com/xungwoo/stareplays/ent/game"
	"github.com/xungwoo/stareplays/internal/randomselect"
)

func main() {
	csvPath := flag.String("csv", "", "path to 총시즌_전적.csv")
	dsn := flag.String("database-url", strings.TrimSpace(os.Getenv("DATABASE_URL")), "Postgres database URL")
	apply := flag.Bool("apply", false, "apply updates; default is dry-run")
	flag.Parse()

	if strings.TrimSpace(*csvPath) == "" {
		log.Fatal("--csv is required")
	}
	if strings.TrimSpace(*dsn) == "" {
		log.Fatal("--database-url or DATABASE_URL is required")
	}

	file, err := os.Open(*csvPath)
	if err != nil {
		log.Fatalf("open csv: %v", err)
	}
	defer file.Close()

	records, err := randomselect.ParseCSV(file)
	if err != nil {
		log.Fatalf("parse csv: %v", err)
	}

	client, err := ent.Open("postgres", *dsn)
	if err != nil {
		log.Fatalf("connect database: %v", err)
	}
	defer client.Close()

	if err := backfill(context.Background(), client, randomselect.BySeason(records), *apply); err != nil {
		log.Fatal(err)
	}
}

func backfill(ctx context.Context, client *ent.Client, bySeason map[string][]randomselect.GameRecord, apply bool) error {
	labels := make([]string, 0, len(bySeason))
	for label := range bySeason {
		labels = append(labels, label)
	}
	for _, label := range []string{"시즌7", "시즌8"} {
		if _, ok := bySeason[label]; !ok {
			labels = append(labels, label)
		}
	}
	sort.Strings(labels)

	totalMatched := 0
	totalChanged := 0
	for _, label := range labels {
		records := bySeason[label]
		games, err := client.Game.Query().
			Where(game.SeasonLabelEQ(label)).
			Order(ent.Asc(game.FieldStartTime), ent.Asc(game.FieldCreatedAt), ent.Asc(game.FieldID)).
			All(ctx)
		if err != nil {
			return fmt.Errorf("query %s games: %w", label, err)
		}

		forcedRandom := randomselect.IsForcedRandomSeasonLabel(label)
		matched := min(len(records), len(games))
		if forcedRandom {
			matched = len(games)
		}
		changed := 0
		for index := 0; index < matched; index++ {
			next := forcedRandom || records[index].IsRandomSelected
			if games[index].IsRandomSelected == next {
				continue
			}
			changed++
			if apply {
				if _, err := client.Game.UpdateOneID(games[index].ID).
					SetIsRandomSelected(next).
					Save(ctx); err != nil {
					return fmt.Errorf("update game %d: %w", games[index].ID, err)
				}
			}
		}

		totalMatched += matched
		totalChanged += changed
		mode := "dry-run"
		if apply {
			mode = "applied"
		}
		log.Printf("%s %s: csv_games=%d db_games=%d matched=%d changed=%d forced_random=%t", mode, label, len(records), len(games), matched, changed, forcedRandom)
		if !forcedRandom && len(records) != len(games) {
			log.Printf("warn %s: csv/db game count mismatch; extra rows are left unchanged", label)
		}
	}

	log.Printf("random selection backfill complete: matched=%d changed=%d apply=%t", totalMatched, totalChanged, apply)
	return nil
}
