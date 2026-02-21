package ranking

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"os"
	"strings"
	"time"

	entsql "entgo.io/ent/dialect/sql"
	"github.com/lib/pq"
	"github.com/xungwoo/stareplays/ent"
	"github.com/xungwoo/stareplays/ent/ranking3v3"
)

const (
	DefaultMinGames         = 20
	LocalDefaultMinGames    = 1
	DefaultDaemonInterval   = 10 * time.Minute
	DefaultPageSize         = 20
	MaxPageSize             = 100
	DefaultRankingJobLockID = int64(330033)
	MinValidGameLengthSec   = 120
)

var ErrJobAlreadyRunning = errors.New("ranking job already running")

type SnapshotRow struct {
	Rank       int
	Name       string
	Games      int
	Wins       int
	Losses     int
	Draws      int
	WinRate    float64
	AvgAPM     float64
	AvgEAPM    float64
	MinGames   int
	ComputedAt time.Time
}

type BuildResult struct {
	Rows           int
	QualifiedGames int
	MinGames       int
	ComputedAt     time.Time
}

type SortOptions struct {
	SortBy  string
	SortDir string
}

type ListOptions struct {
	Page     int
	PageSize int
	MinGames int
	Sort     SortOptions
}

type ListResult struct {
	Items           []*ent.Ranking3v3
	TotalCount      int
	Page            int
	PageSize        int
	TotalPages      int
	AppliedSort     string
	AppliedMinGames int
}

func BuildAndStore3v3Snapshot(ctx context.Context, minGames int) (*BuildResult, error) {
	if minGames <= 0 {
		minGames = DefaultMinGames
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

	locked, err := tryTxAdvisoryLock(ctx, tx, DefaultRankingJobLockID)
	if err != nil {
		return nil, err
	}
	if !locked {
		return nil, ErrJobAlreadyRunning
	}

	rows, qualifiedGames, err := compute3v3Rows(ctx, tx, minGames)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	for i := range rows {
		rows[i].Rank = i + 1
		rows[i].ComputedAt = now
		rows[i].MinGames = minGames
	}

	if _, err := tx.ExecContext(ctx, "DELETE FROM ranking_3v3"); err != nil {
		return nil, fmt.Errorf("delete previous ranking snapshot: %w", err)
	}

	if len(rows) > 0 {
		stmt, err := tx.PrepareContext(ctx, `
			INSERT INTO ranking_3v3
				(name, rank, games, wins, losses, draws, win_rate, avg_apm, avg_eapm, min_games, computed_at, created_at, updated_at)
			VALUES
				($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`)
		if err != nil {
			return nil, fmt.Errorf("prepare ranking insert: %w", err)
		}
		defer stmt.Close()

		for _, r := range rows {
			if _, err := stmt.ExecContext(
				ctx,
				r.Name,
				r.Rank,
				r.Games,
				r.Wins,
				r.Losses,
				r.Draws,
				r.WinRate,
				r.AvgAPM,
				r.AvgEAPM,
				r.MinGames,
				r.ComputedAt,
				now,
				now,
			); err != nil {
				return nil, fmt.Errorf("insert ranking snapshot row: %w", err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit ranking snapshot tx: %w", err)
	}
	committed = true
	return &BuildResult{
		Rows:           len(rows),
		QualifiedGames: qualifiedGames,
		MinGames:       minGames,
		ComputedAt:     now,
	}, nil
}

func List3v3Snapshot(ctx context.Context, client *ent.Client, opts ListOptions) (*ListResult, error) {
	if client == nil {
		return nil, errors.New("nil ent client")
	}
	page := opts.Page
	if page <= 0 {
		page = 1
	}
	pageSize := opts.PageSize
	if pageSize <= 0 {
		pageSize = DefaultPageSize
	}
	if pageSize > MaxPageSize {
		pageSize = MaxPageSize
	}
	minGames := opts.MinGames
	if minGames < 0 {
		minGames = 0
	}

	q := client.Ranking3v3.Query()
	if minGames > 0 {
		q = q.Where(ranking3v3.GamesGTE(minGames))
	}
	totalCount, err := q.Clone().Count(ctx)
	if err != nil {
		return nil, fmt.Errorf("count rankings: %w", err)
	}

	sortBy, sortDir, orderFns := resolveRankingOrder(opts.Sort)
	offset := (page - 1) * pageSize
	items, err := q.
		Order(orderFns...).
		Offset(offset).
		Limit(pageSize).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetch rankings: %w", err)
	}

	totalPages := 0
	if totalCount > 0 {
		totalPages = int(math.Ceil(float64(totalCount) / float64(pageSize)))
	}
	return &ListResult{
		Items:           items,
		TotalCount:      totalCount,
		Page:            page,
		PageSize:        pageSize,
		TotalPages:      totalPages,
		AppliedSort:     sortBy + "_" + sortDir,
		AppliedMinGames: minGames,
	}, nil
}

func resolveRankingOrder(sort SortOptions) (string, string, []ranking3v3.OrderOption) {
	sortBy := strings.ToLower(strings.TrimSpace(sort.SortBy))
	sortDir := strings.ToLower(strings.TrimSpace(sort.SortDir))
	if sortDir != "asc" {
		sortDir = "desc"
	}
	if sortBy == "" {
		sortBy = "win_rate"
	}

	desc := sortDir == "desc"
	switch sortBy {
	case "avg_apm":
		if desc {
			return sortBy, sortDir, []ranking3v3.OrderOption{
				ranking3v3.ByAvgApm(entsql.OrderDesc()),
				ranking3v3.ByWins(entsql.OrderDesc()),
				ranking3v3.ByGames(entsql.OrderDesc()),
				ranking3v3.ByName(),
			}
		}
		return sortBy, sortDir, []ranking3v3.OrderOption{
			ranking3v3.ByAvgApm(),
			ranking3v3.ByName(),
		}
	case "avg_eapm":
		if desc {
			return sortBy, sortDir, []ranking3v3.OrderOption{
				ranking3v3.ByAvgEapm(entsql.OrderDesc()),
				ranking3v3.ByWins(entsql.OrderDesc()),
				ranking3v3.ByGames(entsql.OrderDesc()),
				ranking3v3.ByName(),
			}
		}
		return sortBy, sortDir, []ranking3v3.OrderOption{
			ranking3v3.ByAvgEapm(),
			ranking3v3.ByName(),
		}
	case "wins":
		if desc {
			return sortBy, sortDir, []ranking3v3.OrderOption{
				ranking3v3.ByWins(entsql.OrderDesc()),
				ranking3v3.ByWinRate(entsql.OrderDesc()),
				ranking3v3.ByGames(entsql.OrderDesc()),
				ranking3v3.ByName(),
			}
		}
		return sortBy, sortDir, []ranking3v3.OrderOption{
			ranking3v3.ByWins(),
			ranking3v3.ByName(),
		}
	case "games":
		if desc {
			return sortBy, sortDir, []ranking3v3.OrderOption{
				ranking3v3.ByGames(entsql.OrderDesc()),
				ranking3v3.ByWinRate(entsql.OrderDesc()),
				ranking3v3.ByWins(entsql.OrderDesc()),
				ranking3v3.ByName(),
			}
		}
		return sortBy, sortDir, []ranking3v3.OrderOption{
			ranking3v3.ByGames(),
			ranking3v3.ByName(),
		}
	case "name":
		if desc {
			return sortBy, sortDir, []ranking3v3.OrderOption{
				ranking3v3.ByName(entsql.OrderDesc()),
			}
		}
		return sortBy, sortDir, []ranking3v3.OrderOption{
			ranking3v3.ByName(),
		}
	case "win_rate":
		fallthrough
	default:
		if desc {
			return "win_rate", sortDir, []ranking3v3.OrderOption{
				ranking3v3.ByWinRate(entsql.OrderDesc()),
				ranking3v3.ByWins(entsql.OrderDesc()),
				ranking3v3.ByGames(entsql.OrderDesc()),
				ranking3v3.ByName(),
			}
		}
		return "win_rate", sortDir, []ranking3v3.OrderOption{
			ranking3v3.ByWinRate(),
			ranking3v3.ByName(),
		}
	}
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

func compute3v3Rows(ctx context.Context, tx *sql.Tx, minGames int) ([]SnapshotRow, int, error) {
	const aggregateSQL = `
WITH team_counts AS (
  SELECT p.game_players AS game_id, p.team, COUNT(*) AS cnt
  FROM players p
  GROUP BY p.game_players, p.team
),
valid_games AS (
  SELECT tc.game_id
  FROM team_counts tc
  JOIN games g ON g.id = tc.game_id
  WHERE g.player_count = 6
    AND COALESCE(g.game_length, 0) > $2
  GROUP BY tc.game_id
  HAVING COUNT(*) = 2 AND MIN(tc.cnt) = 3 AND MAX(tc.cnt) = 3
),
agg AS (
  SELECT
    LOWER(TRIM(p.name)) AS key_name,
    MIN(TRIM(p.name)) AS display_name,
    COUNT(*)::int AS games,
    SUM(CASE WHEN LOWER(TRIM(p.result)) = 'win' OR (LOWER(TRIM(p.result)) = 'unknown' AND p.is_winner = TRUE) THEN 1 ELSE 0 END)::int AS wins,
    SUM(CASE WHEN LOWER(TRIM(p.result)) = 'loss' OR (LOWER(TRIM(p.result)) = 'unknown' AND p.is_winner = FALSE AND g.winner_team > 0) THEN 1 ELSE 0 END)::int AS losses,
    SUM(CASE WHEN LOWER(TRIM(p.result)) = 'draw' THEN 1 ELSE 0 END)::int AS draws,
    COALESCE(
      percentile_cont(0.95) WITHIN GROUP (
        ORDER BY CASE
          WHEN p.apm IS NOT NULL AND p.apm BETWEEN 0 AND 1000 THEN p.apm::float8
          ELSE NULL
        END
      ),
      0
    )::float8 AS avg_apm,
    COALESCE(
      percentile_cont(0.95) WITHIN GROUP (
        ORDER BY CASE
          WHEN p.eapm IS NOT NULL AND p.eapm BETWEEN 0 AND 1000 THEN p.eapm::float8
          ELSE NULL
        END
      ),
      0
    )::float8 AS avg_eapm
  FROM players p
  JOIN games g ON g.id = p.game_players
  JOIN valid_games vg ON vg.game_id = p.game_players
  GROUP BY LOWER(TRIM(p.name))
  HAVING COUNT(*) >= $1
)
SELECT display_name, games, wins, losses, draws,
       ROUND((wins::numeric / NULLIF(games, 0)) * 100, 1)::float8 AS win_rate,
       ROUND(avg_apm::numeric, 1)::float8 AS avg_apm,
       ROUND(avg_eapm::numeric, 1)::float8 AS avg_eapm
FROM agg
ORDER BY win_rate DESC, wins DESC, games DESC, display_name ASC`

	rows, err := tx.QueryContext(ctx, aggregateSQL, minGames, MinValidGameLengthSec)
	if err != nil {
		return nil, 0, fmt.Errorf("aggregate 3v3 rankings: %w", err)
	}
	defer rows.Close()

	out := make([]SnapshotRow, 0)
	for rows.Next() {
		var r SnapshotRow
		if err := rows.Scan(&r.Name, &r.Games, &r.Wins, &r.Losses, &r.Draws, &r.WinRate, &r.AvgAPM, &r.AvgEAPM); err != nil {
			return nil, 0, fmt.Errorf("scan aggregated row: %w", err)
		}
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate aggregated rows: %w", err)
	}

	qualifiedGames, err := countQualified3v3Games(ctx, tx)
	if err != nil {
		return nil, 0, err
	}
	return out, qualifiedGames, nil
}

func countQualified3v3Games(ctx context.Context, tx *sql.Tx) (int, error) {
	const countSQL = `
WITH team_counts AS (
  SELECT p.game_players AS game_id, p.team, COUNT(*) AS cnt
  FROM players p
  GROUP BY p.game_players, p.team
)
SELECT COUNT(*)::int
FROM (
  SELECT tc.game_id
  FROM team_counts tc
  JOIN games g ON g.id = tc.game_id
  WHERE g.player_count = 6
    AND COALESCE(g.game_length, 0) > $1
  GROUP BY tc.game_id
  HAVING COUNT(*) = 2 AND MIN(tc.cnt) = 3 AND MAX(tc.cnt) = 3
) q`

	rows, err := tx.QueryContext(ctx, countSQL, MinValidGameLengthSec)
	if err != nil {
		return 0, fmt.Errorf("count qualified 3v3 games: %w", err)
	}
	defer rows.Close()
	total := 0
	if rows.Next() {
		if err := rows.Scan(&total); err != nil {
			return 0, fmt.Errorf("scan qualified 3v3 game count: %w", err)
		}
	}
	return total, nil
}

func ParseMinGames(v string) int {
	n := strings.TrimSpace(v)
	if n == "" {
		return defaultMinGamesByEnv()
	}
	var parsed int
	if _, err := fmt.Sscanf(n, "%d", &parsed); err != nil || parsed <= 0 {
		return defaultMinGamesByEnv()
	}
	return parsed
}

func ParseInterval(v string) time.Duration {
	raw := strings.TrimSpace(v)
	if raw == "" {
		return DefaultDaemonInterval
	}
	d, err := time.ParseDuration(raw)
	if err != nil || d <= 0 {
		return DefaultDaemonInterval
	}
	return d
}

func IsPQUndefinedTable(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "42P01"
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

func defaultMinGamesByEnv() int {
	env := strings.ToLower(strings.TrimSpace(os.Getenv("ENV")))
	if env == "" {
		env = strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	}
	switch env {
	case "production", "prod":
		return DefaultMinGames
	default:
		return LocalDefaultMinGames
	}
}
