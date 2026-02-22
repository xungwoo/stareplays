package migration

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/lib/pq"
)

const (
	DefaultMaxSeconds         = 120
	DefaultMigrationJobLockID = int64(330055)
)

var ErrJobAlreadyRunning = errors.New("migration job already running")

type Result struct {
	MaxSeconds     int
	TargetGames    int
	UpdatedGames   int
	UpdatedPlayers int
	ComputedAt     time.Time
}

func ParseMaxSeconds(v string) int {
	raw := strings.TrimSpace(v)
	if raw == "" {
		return DefaultMaxSeconds
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return DefaultMaxSeconds
	}
	return n
}

func ParseBool(v string) bool {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "1", "true", "t", "yes", "y", "on":
		return true
	default:
		return false
	}
}

func NormalizeShortGames(ctx context.Context, maxSeconds int) (*Result, error) {
	if maxSeconds <= 0 {
		maxSeconds = DefaultMaxSeconds
	}

	db, err := openSQLDBFromEnv()
	if err != nil {
		return nil, err
	}
	defer db.Close()

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("start tx: %w", err)
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	locked, err := tryTxAdvisoryLock(ctx, tx, DefaultMigrationJobLockID)
	if err != nil {
		return nil, err
	}
	if !locked {
		return nil, ErrJobAlreadyRunning
	}

	gameIDs, err := loadTargetGameIDs(ctx, tx, maxSeconds)
	if err != nil {
		return nil, err
	}

	updatedGames := 0
	updatedPlayers := 0
	if len(gameIDs) > 0 {
		updatedGames, err = updateGames(ctx, tx, gameIDs)
		if err != nil {
			return nil, err
		}
		updatedPlayers, err = updatePlayers(ctx, tx, gameIDs)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit migration tx: %w", err)
	}
	committed = true

	return &Result{
		MaxSeconds:     maxSeconds,
		TargetGames:    len(gameIDs),
		UpdatedGames:   updatedGames,
		UpdatedPlayers: updatedPlayers,
		ComputedAt:     time.Now(),
	}, nil
}

func loadTargetGameIDs(ctx context.Context, tx *sql.Tx, maxSeconds int) ([]int, error) {
	rows, err := tx.QueryContext(ctx, `
		SELECT id
		FROM games
		WHERE COALESCE(game_length, 0) > 0
		  AND game_length <= $1
		ORDER BY id ASC`, maxSeconds)
	if err != nil {
		return nil, fmt.Errorf("query target games: %w", err)
	}
	defer rows.Close()

	out := make([]int, 0, 64)
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scan target game id: %w", err)
		}
		out = append(out, id)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate target games: %w", err)
	}
	return out, nil
}

func updateGames(ctx context.Context, tx *sql.Tx, gameIDs []int) (int, error) {
	res, err := tx.ExecContext(ctx, `
		UPDATE games
		SET winner_team = 0,
		    updated_at = NOW()
		WHERE id = ANY($1)
		  AND winner_team <> 0`, pq.Array(gameIDs))
	if err != nil {
		return 0, fmt.Errorf("update games winner_team: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("rows affected (games): %w", err)
	}
	return int(n), nil
}

func updatePlayers(ctx context.Context, tx *sql.Tx, gameIDs []int) (int, error) {
	res, err := tx.ExecContext(ctx, `
		UPDATE players
		SET is_winner = FALSE,
		    result = 'draw'
		WHERE game_players = ANY($1)
		  AND (is_winner = TRUE OR lower(COALESCE(result, '')) <> 'draw')`, pq.Array(gameIDs))
	if err != nil {
		return 0, fmt.Errorf("update players result/is_winner: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("rows affected (players): %w", err)
	}
	return int(n), nil
}

func tryTxAdvisoryLock(ctx context.Context, tx *sql.Tx, lockID int64) (bool, error) {
	var locked bool
	rows, err := tx.QueryContext(ctx, "SELECT pg_try_advisory_xact_lock($1)", lockID)
	if err != nil {
		return false, fmt.Errorf("acquire advisory lock: %w", err)
	}
	defer rows.Close()
	if rows.Next() {
		if err := rows.Scan(&locked); err != nil {
			return false, fmt.Errorf("scan advisory lock result: %w", err)
		}
	}
	return locked, nil
}

func openSQLDBFromEnv() (*sql.DB, error) {
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
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sql db: %w", err)
	}
	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping sql db: %w", err)
	}
	return db, nil
}
