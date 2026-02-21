package analyzer

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
	"github.com/xungwoo/stareplays/ent/analyzerracematchup"
)

const (
	DefaultAnalyzerInterval  = 10 * time.Minute
	DefaultAnalyzerPageSize  = 50
	MaxAnalyzerPageSize      = 500
	DefaultAnalyzerJobLockID = int64(330044)
	MinValidGameLengthSec    = 120
)

var ErrJobAlreadyRunning = errors.New("analyzer job already running")

type SnapshotRow struct {
	TeamSize     int
	TeamA        string
	TeamB        string
	MatchupKey   string
	Games        int
	TeamAWins    int
	TeamBWins    int
	TeamAWinRate float64
	TeamBWinRate float64
	ComputedAt   time.Time
}

type BuildResult struct {
	Rows           int
	QualifiedGames int
	ComputedAt     time.Time
}

type SortOptions struct {
	SortBy  string
	SortDir string
}

type ListOptions struct {
	TeamSize int
	Page     int
	PageSize int
	Limit    int
	Sort     SortOptions
}

type ListResult struct {
	Items          []*ent.AnalyzerRaceMatchup
	TotalCount     int
	Page           int
	PageSize       int
	TotalPages     int
	AppliedSort    string
	TeamSize       int
	QualifiedGames int
}

func BuildAndStoreSnapshot(ctx context.Context) (*BuildResult, error) {
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

	locked, err := tryTxAdvisoryLock(ctx, tx, DefaultAnalyzerJobLockID)
	if err != nil {
		return nil, err
	}
	if !locked {
		return nil, ErrJobAlreadyRunning
	}

	rows, qualifiedGames, err := computeRows(ctx, tx)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	for i := range rows {
		rows[i].ComputedAt = now
	}

	if _, err := tx.ExecContext(ctx, "DELETE FROM analyzer_race_matchups"); err != nil {
		return nil, fmt.Errorf("delete previous analyzer snapshot: %w", err)
	}

	if len(rows) > 0 {
		stmt, err := tx.PrepareContext(ctx, `
			INSERT INTO analyzer_race_matchups
				(team_size, team_a, team_b, matchup_key, games, team_a_wins, team_b_wins, team_a_win_rate, team_b_win_rate, computed_at, created_at, updated_at)
			VALUES
				($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`)
		if err != nil {
			return nil, fmt.Errorf("prepare analyzer snapshot insert: %w", err)
		}
		defer stmt.Close()

		for _, r := range rows {
			if _, err := stmt.ExecContext(
				ctx,
				r.TeamSize,
				r.TeamA,
				r.TeamB,
				r.MatchupKey,
				r.Games,
				r.TeamAWins,
				r.TeamBWins,
				r.TeamAWinRate,
				r.TeamBWinRate,
				r.ComputedAt,
				now,
				now,
			); err != nil {
				return nil, fmt.Errorf("insert analyzer snapshot row: %w", err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit analyzer snapshot tx: %w", err)
	}
	committed = true
	return &BuildResult{
		Rows:           len(rows),
		QualifiedGames: qualifiedGames,
		ComputedAt:     now,
	}, nil
}

func ListSnapshot(ctx context.Context, client *ent.Client, opts ListOptions) (*ListResult, error) {
	if client == nil {
		return nil, errors.New("nil ent client")
	}
	teamSize := opts.TeamSize
	if teamSize < 0 {
		teamSize = 0
	}
	page := opts.Page
	if page <= 0 {
		page = 1
	}
	pageSize := opts.PageSize
	if pageSize <= 0 {
		pageSize = DefaultAnalyzerPageSize
	}
	if opts.Limit > 0 {
		pageSize = opts.Limit
		page = 1
	}
	if pageSize > MaxAnalyzerPageSize {
		pageSize = MaxAnalyzerPageSize
	}

	q := client.AnalyzerRaceMatchup.Query()
	if teamSize > 0 {
		q = q.Where(analyzerracematchup.TeamSizeEQ(teamSize))
	}
	totalCount, err := q.Clone().Count(ctx)
	if err != nil {
		return nil, fmt.Errorf("count analyzer snapshot: %w", err)
	}

	sortBy, sortDir, orderFns := resolveOrder(opts.Sort)
	offset := (page - 1) * pageSize
	items, err := q.Order(orderFns...).Offset(offset).Limit(pageSize).All(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetch analyzer snapshot: %w", err)
	}

	totalPages := 0
	if totalCount > 0 {
		totalPages = int(math.Ceil(float64(totalCount) / float64(pageSize)))
	}
	qualifiedGames := 0
	if totalCount > 0 {
		qualifiedGames, err = countQualifiedGames(ctx, client, teamSize)
		if err != nil {
			return nil, err
		}
	}

	return &ListResult{
		Items:          items,
		TotalCount:     totalCount,
		Page:           page,
		PageSize:       pageSize,
		TotalPages:     totalPages,
		AppliedSort:    sortBy + "_" + sortDir,
		TeamSize:       teamSize,
		QualifiedGames: qualifiedGames,
	}, nil
}

func resolveOrder(sort SortOptions) (string, string, []analyzerracematchup.OrderOption) {
	sortBy := strings.ToLower(strings.TrimSpace(sort.SortBy))
	sortDir := strings.ToLower(strings.TrimSpace(sort.SortDir))
	if sortDir != "asc" {
		sortDir = "desc"
	}
	if sortBy == "" {
		sortBy = "games"
	}
	desc := sortDir == "desc"

	switch sortBy {
	case "team_a_win_rate":
		if desc {
			return sortBy, sortDir, []analyzerracematchup.OrderOption{
				analyzerracematchup.ByTeamAWinRate(entsql.OrderDesc()),
				analyzerracematchup.ByGames(entsql.OrderDesc()),
				analyzerracematchup.ByMatchupKey(),
			}
		}
		return sortBy, sortDir, []analyzerracematchup.OrderOption{
			analyzerracematchup.ByTeamAWinRate(),
			analyzerracematchup.ByMatchupKey(),
		}
	case "team_b_win_rate":
		if desc {
			return sortBy, sortDir, []analyzerracematchup.OrderOption{
				analyzerracematchup.ByTeamBWinRate(entsql.OrderDesc()),
				analyzerracematchup.ByGames(entsql.OrderDesc()),
				analyzerracematchup.ByMatchupKey(),
			}
		}
		return sortBy, sortDir, []analyzerracematchup.OrderOption{
			analyzerracematchup.ByTeamBWinRate(),
			analyzerracematchup.ByMatchupKey(),
		}
	case "matchup":
		if desc {
			return sortBy, sortDir, []analyzerracematchup.OrderOption{
				analyzerracematchup.ByMatchupKey(entsql.OrderDesc()),
			}
		}
		return sortBy, sortDir, []analyzerracematchup.OrderOption{
			analyzerracematchup.ByMatchupKey(),
		}
	case "games":
		fallthrough
	default:
		if desc {
			return "games", sortDir, []analyzerracematchup.OrderOption{
				analyzerracematchup.ByGames(entsql.OrderDesc()),
				analyzerracematchup.ByTeamAWinRate(entsql.OrderDesc()),
				analyzerracematchup.ByMatchupKey(),
			}
		}
		return "games", sortDir, []analyzerracematchup.OrderOption{
			analyzerracematchup.ByGames(),
			analyzerracematchup.ByMatchupKey(),
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

func computeRows(ctx context.Context, tx *sql.Tx) ([]SnapshotRow, int, error) {
	const aggregateSQL = `
WITH team_counts AS (
  SELECT p.game_players AS game_id, p.team, COUNT(*) AS cnt
  FROM players p
  GROUP BY p.game_players, p.team
),
valid_games AS (
  SELECT tc.game_id, MIN(tc.cnt)::int AS team_size
  FROM team_counts tc
  GROUP BY tc.game_id
  HAVING COUNT(*) = 2 AND MIN(tc.cnt) = MAX(tc.cnt) AND MIN(tc.cnt) > 0
),
team_comp AS (
  SELECT
    p.game_players AS game_id,
    p.team,
    vg.team_size,
    string_agg(
      CASE
        WHEN lower(trim(p.race)) LIKE 'terran%%' THEN 'T'
        WHEN lower(trim(p.race)) LIKE 'zerg%%' THEN 'Z'
        WHEN lower(trim(p.race)) LIKE 'protoss%%' THEN 'P'
        ELSE 'U'
      END, '' ORDER BY
      CASE
        WHEN lower(trim(p.race)) LIKE 'protoss%%' THEN 1
        WHEN lower(trim(p.race)) LIKE 'terran%%' THEN 2
        WHEN lower(trim(p.race)) LIKE 'zerg%%' THEN 3
        ELSE 9
      END
    ) AS comp
  FROM players p
  JOIN valid_games vg ON vg.game_id = p.game_players
  GROUP BY p.game_players, p.team, vg.team_size
),
paired AS (
  SELECT
    a.game_id,
    a.team_size,
    a.team AS team1_id,
    a.comp AS team1_comp,
    b.team AS team2_id,
    b.comp AS team2_comp,
    g.winner_team
  FROM team_comp a
  JOIN team_comp b ON b.game_id = a.game_id AND b.team > a.team
  JOIN games g ON g.id = a.game_id
  WHERE g.winner_team > 0
    AND g.player_count = (a.team_size * 2)
    AND COALESCE(g.game_length, 0) > $1
),
canon AS (
  SELECT
    game_id,
    team_size,
    CASE WHEN team1_comp <= team2_comp THEN team1_comp ELSE team2_comp END AS team_a,
    CASE WHEN team1_comp <= team2_comp THEN team2_comp ELSE team1_comp END AS team_b,
    CASE WHEN team1_comp <= team2_comp THEN team1_id ELSE team2_id END AS team_a_id,
    CASE WHEN team1_comp <= team2_comp THEN team2_id ELSE team1_id END AS team_b_id,
    winner_team
  FROM paired
),
agg AS (
  SELECT
    team_size,
    team_a,
    team_b,
    COUNT(*)::int AS games,
    SUM(CASE WHEN winner_team = team_a_id THEN 1 ELSE 0 END)::int AS team_a_wins,
    SUM(CASE WHEN winner_team = team_b_id THEN 1 ELSE 0 END)::int AS team_b_wins
  FROM canon
  GROUP BY team_size, team_a, team_b
)
SELECT
  team_size,
  team_a,
  team_b,
  (team_a || ' vs ' || team_b) AS matchup_key,
  games,
  team_a_wins,
  team_b_wins,
  ROUND((team_a_wins::numeric / NULLIF(games, 0)) * 100, 1)::float8 AS team_a_win_rate,
  ROUND((team_b_wins::numeric / NULLIF(games, 0)) * 100, 1)::float8 AS team_b_win_rate
FROM agg
ORDER BY team_size ASC, games DESC, team_a_win_rate DESC, matchup_key ASC`

	rows, err := tx.QueryContext(ctx, aggregateSQL, MinValidGameLengthSec)
	if err != nil {
		return nil, 0, fmt.Errorf("aggregate analyzer matchup snapshot: %w", err)
	}
	defer rows.Close()

	out := make([]SnapshotRow, 0)
	qualifiedGames := 0
	for rows.Next() {
		var r SnapshotRow
		if err := rows.Scan(
			&r.TeamSize, &r.TeamA, &r.TeamB, &r.MatchupKey, &r.Games,
			&r.TeamAWins, &r.TeamBWins, &r.TeamAWinRate, &r.TeamBWinRate,
		); err != nil {
			return nil, 0, fmt.Errorf("scan analyzer snapshot row: %w", err)
		}
		qualifiedGames += r.Games
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate analyzer snapshot rows: %w", err)
	}
	return out, qualifiedGames, nil
}

func countQualifiedGames(ctx context.Context, client *ent.Client, teamSize int) (int, error) {
	q := client.AnalyzerRaceMatchup.Query()
	if teamSize > 0 {
		q = q.Where(analyzerracematchup.TeamSizeEQ(teamSize))
	}
	var totals []struct {
		Sum *int `json:"sum"`
	}
	if err := q.Aggregate(ent.Sum(analyzerracematchup.FieldGames)).Scan(ctx, &totals); err != nil {
		return 0, fmt.Errorf("sum qualified analyzer games: %w", err)
	}
	if len(totals) == 0 {
		return 0, nil
	}
	if totals[0].Sum == nil {
		return 0, nil
	}
	return *totals[0].Sum, nil
}

func ParseInterval(v string) time.Duration {
	raw := strings.TrimSpace(v)
	if raw == "" {
		return DefaultAnalyzerInterval
	}
	d, err := time.ParseDuration(raw)
	if err != nil || d <= 0 {
		return DefaultAnalyzerInterval
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
