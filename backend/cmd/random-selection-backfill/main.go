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
	"github.com/xungwoo/stareplays/ent/player"
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
			WithPlayers(func(query *ent.PlayerQuery) {
				query.Order(ent.Asc(player.FieldTeam), ent.Asc(player.FieldID))
			}).
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
		playerChanged := 0
		for index := 0; index < matched; index++ {
			playerSelections := randomSelectionsForGame(records, index, len(games[index].Edges.Players), forcedRandom)

			players := games[index].Edges.Players
			playerMatched := min(len(playerSelections), len(players))
			for playerIndex := 0; playerIndex < playerMatched; playerIndex++ {
				nextPlayerRandom := playerSelections[playerIndex]
				if players[playerIndex].IsRandomSelected == nextPlayerRandom {
					continue
				}
				playerChanged++
				if apply {
					if _, err := client.Player.UpdateOneID(players[playerIndex].ID).
						SetIsRandomSelected(nextPlayerRandom).
						Save(ctx); err != nil {
						return fmt.Errorf("update player %d: %w", players[playerIndex].ID, err)
					}
				}
			}
			if len(playerSelections) != len(players) {
				log.Printf("warn %s game_id=%d: csv/db player count mismatch; csv_players=%d db_players=%d", label, games[index].ID, len(playerSelections), len(players))
			}
		}

		totalMatched += matched
		totalChanged += playerChanged
		mode := "dry-run"
		if apply {
			mode = "applied"
		}
		log.Printf("%s %s: csv_games=%d db_games=%d matched=%d player_changed=%d forced_random=%t", mode, label, len(records), len(games), matched, playerChanged, forcedRandom)
		if !forcedRandom && len(records) != len(games) {
			log.Printf("warn %s: csv/db game count mismatch; extra rows are left unchanged", label)
		}
	}

	log.Printf("random selection backfill complete: matched=%d changed=%d apply=%t", totalMatched, totalChanged, apply)
	return nil
}

func randomSelectionsForGame(records []randomselect.GameRecord, index int, playerCount int, forcedRandom bool) []bool {
	if forcedRandom {
		selections := make([]bool, playerCount)
		for playerIndex := range selections {
			selections[playerIndex] = true
		}
		return selections
	}
	if index >= len(records) {
		return nil
	}
	return records[index].PlayerRandomSelections
}
