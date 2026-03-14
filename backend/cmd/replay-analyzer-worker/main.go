package main

import (
	"bufio"
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/lib/pq"
	"github.com/xungwoo/stareplays/internal/replayanalysis"
	"github.com/xungwoo/stareplays/internal/storage/replaybucket"
)

type config struct {
	DSN          string
	AnalyzerBin  string
	Simulator    string
	OutputRoot   string
	TmpDir       string
	PollInterval time.Duration
	ExecTimeout  time.Duration
	MaxAttempts  int
	RetryBackoff time.Duration
	Channel      string
}

type analysisJob struct {
	ID           int64
	GameID       int64
	FileHash     string
	BucketKey    string
	AttemptCount int
}

type worker struct {
	cfg    config
	db     *sql.DB
	bucket *replaybucket.Client
}

type analyzerMetadata struct {
	Players []analyzerMetadataPlayer `json:"players"`
}

type analyzerMetadataPlayer struct {
	PlayerID int    `json:"player_id"`
	Team     int    `json:"team"`
	Name     string `json:"name"`
}

type analyzerTimeseries struct {
	Players []analyzerTimeseriesPlayer `json:"players"`
}

type analyzerTimeseriesPlayer struct {
	PlayerID int `json:"player_id"`
	Team     int `json:"team"`
	Series   struct {
		KD     []kdPoint     `json:"kd"`
		Supply []supplyPoint `json:"supply"`
		Vision []visionPoint `json:"vision"`
		Worker []workerPoint `json:"worker"`
	} `json:"series"`
}

type kdPoint struct {
	Frame  int `json:"frame"`
	Kills  int `json:"kills"`
	Deaths int `json:"deaths"`
}

type supplyPoint struct {
	Frame   int  `json:"frame"`
	Used    int  `json:"used"`
	Cap     int  `json:"cap"`
	Blocked bool `json:"blocked"`
}

type visionPoint struct {
	Frame             int     `json:"frame"`
	EnemyZoneCoverage float64 `json:"enemy_zone_coverage"`
	VisionScore       float64 `json:"vision_score"`
}

type workerPoint struct {
	Frame int `json:"frame"`
	Count int `json:"count"`
}

type snapshotLine struct {
	Frame   int            `json:"frame"`
	Players []snapshotUser `json:"players"`
}

type snapshotUser struct {
	PlayerID    int `json:"player_id"`
	SupplyUsed  int `json:"supply_used"`
	SupplyCap   int `json:"supply_cap"`
	WorkerCount int `json:"worker_count"`
}

type analyzerEventLine struct {
	Frame   int                `json:"frame"`
	Event   string             `json:"event"`
	Subject *analyzerEventUnit `json:"subject"`
}

type analyzerEventUnit struct {
	PlayerID int    `json:"player_id"`
	Type     string `json:"type"`
}

func main() {
	cfg, err := loadConfig()
	if err != nil {
		log.Fatalf("invalid config: %v", err)
	}

	ctx := context.Background()
	bucketClient, err := replaybucket.NewFromEnv(ctx)
	if err != nil {
		log.Fatalf("bucket config failed: %v", err)
	}
	db, err := sql.Open("postgres", cfg.DSN)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer db.Close()
	if err := db.PingContext(ctx); err != nil {
		log.Fatalf("ping database: %v", err)
	}

	if err := os.MkdirAll(cfg.TmpDir, 0o755); err != nil {
		log.Fatalf("prepare temp dir: %v", err)
	}
	if err := os.MkdirAll(cfg.OutputRoot, 0o755); err != nil {
		log.Fatalf("prepare output dir: %v", err)
	}

	w := &worker{
		cfg:    cfg,
		db:     db,
		bucket: bucketClient,
	}
	if err := w.run(ctx); err != nil {
		log.Fatalf("worker stopped: %v", err)
	}
}

func loadConfig() (config, error) {
	cfg := config{
		DSN:          mustDSN(),
		AnalyzerBin:  envOrDefault("REPLAY_ANALYZER_BIN", "replay_analyzer"),
		Simulator:    envOrDefault("REPLAY_ANALYZER_SIMULATOR", "openbw"),
		OutputRoot:   envOrDefault("REPLAY_ANALYZER_WORKER_OUTPUT_ROOT", "/tmp/stareplays/analysis_jobs"),
		TmpDir:       envOrDefault("REPLAY_ANALYZER_WORKER_TMP_DIR", "/tmp/stareplays/replays"),
		PollInterval: envDurationSec("REPLAY_ANALYZER_WORKER_POLL_INTERVAL_SEC", 10),
		ExecTimeout:  envDurationSec("REPLAY_ANALYZER_WORKER_EXEC_TIMEOUT_SEC", 1200),
		MaxAttempts:  envInt("REPLAY_ANALYZER_WORKER_MAX_ATTEMPTS", 3),
		RetryBackoff: envDurationSec("REPLAY_ANALYZER_WORKER_RETRY_BACKOFF_SEC", 60),
		Channel:      envOrDefault("REPLAY_ANALYZER_WORKER_LISTEN_CHANNEL", "replay_analysis_jobs"),
	}
	if cfg.MaxAttempts <= 0 {
		return config{}, errors.New("REPLAY_ANALYZER_WORKER_MAX_ATTEMPTS must be >= 1")
	}
	if cfg.PollInterval <= 0 || cfg.ExecTimeout <= 0 || cfg.RetryBackoff <= 0 {
		return config{}, errors.New("poll/exec/retry durations must be > 0")
	}
	if strings.TrimSpace(cfg.AnalyzerBin) == "" {
		return config{}, errors.New("empty REPLAY_ANALYZER_BIN")
	}
	return cfg, nil
}

func mustDSN() string {
	if dsn := strings.TrimSpace(os.Getenv("DATABASE_URL")); dsn != "" {
		return dsn
	}
	parts := []string{
		"host=" + strings.TrimSpace(os.Getenv("DB_HOST")),
		"port=" + strings.TrimSpace(os.Getenv("DB_PORT")),
		"user=" + strings.TrimSpace(os.Getenv("DB_USER")),
		"password=" + strings.TrimSpace(os.Getenv("DB_PASSWORD")),
		"dbname=" + strings.TrimSpace(os.Getenv("DB_NAME")),
		"sslmode=" + strings.TrimSpace(os.Getenv("DB_SSLMODE")),
	}
	return strings.Join(parts, " ")
}

func envOrDefault(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return v
}

func envDurationSec(key string, fallbackSec int) time.Duration {
	return time.Duration(envInt(key, fallbackSec)) * time.Second
}

func (w *worker) run(ctx context.Context) error {
	listener := pq.NewListener(w.cfg.DSN, 2*time.Second, 30*time.Second, func(et pq.ListenerEventType, err error) {
		if err != nil {
			log.Printf("pq listener event=%d err=%v", et, err)
		}
	})
	defer listener.Close()
	if err := listener.Listen(w.cfg.Channel); err != nil {
		return fmt.Errorf("listen channel %s: %w", w.cfg.Channel, err)
	}
	log.Printf("worker started: channel=%s poll=%s", w.cfg.Channel, w.cfg.PollInterval)

	for {
		claimed, err := w.processNext(ctx)
		if err != nil {
			log.Printf("process job error: %v", err)
		}
		if claimed {
			continue
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-listener.Notify:
		case <-time.After(w.cfg.PollInterval):
		}
	}
}

func (w *worker) processNext(ctx context.Context) (bool, error) {
	job, err := w.claimNextJob(ctx)
	if err != nil {
		return false, err
	}
	if job == nil {
		return false, nil
	}

	log.Printf("job claimed id=%d game_id=%d attempt=%d", job.ID, job.GameID, job.AttemptCount)
	err = w.executeJob(ctx, *job)
	if err != nil {
		if upErr := w.markFailure(ctx, *job, err); upErr != nil {
			return true, fmt.Errorf("mark failure: %v (original: %w)", upErr, err)
		}
		return true, nil
	}
	if err := w.markSuccess(ctx, *job); err != nil {
		return true, err
	}
	return true, nil
}

func (w *worker) claimNextJob(ctx context.Context) (*analysisJob, error) {
	tx, err := w.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	const q = `
WITH next_job AS (
  SELECT id
  FROM game_analyses
  WHERE status = $1
    AND next_retry_at <= now()
  ORDER BY priority DESC, requested_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE game_analyses g
SET status = $2,
    started_at = now(),
    attempt_count = g.attempt_count + 1,
    updated_at = now()
FROM next_job
WHERE g.id = next_job.id
RETURNING g.id, g.game_id, g.file_hash, g.bucket_key, g.attempt_count`

	var job analysisJob
	err = tx.QueryRowContext(ctx, q, replayanalysis.StatusQueued, replayanalysis.StatusRunning).
		Scan(&job.ID, &job.GameID, &job.FileHash, &job.BucketKey, &job.AttemptCount)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("claim next job: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit claim tx: %w", err)
	}
	return &job, nil
}

func (w *worker) executeJob(parent context.Context, job analysisJob) error {
	ctx, cancel := context.WithTimeout(parent, w.cfg.ExecTimeout)
	defer cancel()

	replayPath, err := w.bucket.DownloadToTempFile(ctx, job.BucketKey, w.cfg.TmpDir)
	if err != nil {
		return err
	}
	defer func() {
		_ = os.Remove(replayPath)
	}()

	jobOut := filepath.Join(w.cfg.OutputRoot, fmt.Sprintf("job_%d", job.ID))
	if err := os.RemoveAll(jobOut); err != nil {
		return fmt.Errorf("clean previous output: %w", err)
	}
	if err := os.MkdirAll(jobOut, 0o755); err != nil {
		return fmt.Errorf("create job output root: %w", err)
	}

	cmd := exec.CommandContext(ctx, w.cfg.AnalyzerBin,
		"-replay", replayPath,
		"-simulator", w.cfg.Simulator,
		"-out", jobOut,
	)
	cmd.Env = os.Environ()

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("run replay_analyzer: %w (stderr=%s)", err, shorten(stderr.String(), 3000))
	}

	resultDir, err := findAnalysisResultDir(jobOut)
	if err != nil {
		return fmt.Errorf("locate analyzer result: %w (stdout=%s)", err, shorten(stdout.String(), 1500))
	}

	quality, err := readJSONMap(filepath.Join(resultDir, "quality_report.json"))
	if err != nil {
		return err
	}
	summary, err := readJSONMap(filepath.Join(resultDir, "summary.json"))
	if err != nil {
		return err
	}
	phase, err := readJSONMap(filepath.Join(resultDir, "analysis_phase.json"))
	if err != nil {
		return err
	}

	qualityRaw, _ := json.Marshal(quality)
	summaryRaw, _ := json.Marshal(summary)
	phaseRaw, _ := json.Marshal(phase)
	matchFlow, playerTimeseries, err := buildCondensedPayloads(resultDir)
	if err != nil {
		return fmt.Errorf("build condensed payloads: %w", err)
	}
	matchFlowRaw, _ := json.Marshal(matchFlow)
	playerTimeseriesRaw, _ := json.Marshal(playerTimeseries)
	artifactManifest, err := buildArtifactManifest(resultDir)
	if err != nil {
		return fmt.Errorf("build artifact manifest: %w", err)
	}
	artifactManifestRaw, _ := json.Marshal(artifactManifest)

	_, err = w.db.ExecContext(parent, `
		UPDATE game_analyses
		SET status = $2,
		    last_error = NULL,
		    quality_report_json = $3::jsonb,
		    summary_json = $4::jsonb,
		    analysis_phase_json = $5::jsonb,
		    analysis_events_json = $6::jsonb,
		    analysis_timeseries_json = $7::jsonb,
		    artifact_result_dir = $8,
		    artifact_manifest_json = $9::jsonb,
		    finished_at = now(),
		    updated_at = now()
		WHERE id = $1
	`, job.ID, replayanalysis.StatusSucceeded, string(qualityRaw), string(summaryRaw), string(phaseRaw), string(matchFlowRaw), string(playerTimeseriesRaw), resultDir, string(artifactManifestRaw))
	if err != nil {
		return fmt.Errorf("update success result: %w", err)
	}

	log.Printf("job succeeded id=%d game_id=%d result_dir=%s", job.ID, job.GameID, resultDir)
	return nil
}

func (w *worker) markSuccess(ctx context.Context, job analysisJob) error {
	// executeJob already commits success payload/state in one UPDATE.
	_ = ctx
	_ = job
	return nil
}

func (w *worker) markFailure(ctx context.Context, job analysisJob, runErr error) error {
	msg := shorten(strings.TrimSpace(runErr.Error()), 3000)
	if job.AttemptCount < w.cfg.MaxAttempts {
		nextRetry := time.Now().Add(w.cfg.RetryBackoff * time.Duration(job.AttemptCount))
		if _, err := w.db.ExecContext(ctx, `
			UPDATE game_analyses
			SET status = $2,
			    last_error = $3,
			    next_retry_at = $4,
			    updated_at = now()
			WHERE id = $1
		`, job.ID, replayanalysis.StatusQueued, msg, nextRetry); err != nil {
			return err
		}
		log.Printf("job retry queued id=%d game_id=%d attempt=%d err=%s", job.ID, job.GameID, job.AttemptCount, msg)
		return nil
	}
	if _, err := w.db.ExecContext(ctx, `
		UPDATE game_analyses
		SET status = $2,
		    last_error = $3,
		    finished_at = now(),
		    updated_at = now()
		WHERE id = $1
	`, job.ID, replayanalysis.StatusFailed, msg); err != nil {
		return err
	}
	log.Printf("job failed id=%d game_id=%d attempt=%d err=%s", job.ID, job.GameID, job.AttemptCount, msg)
	return nil
}

func findAnalysisResultDir(root string) (string, error) {
	var found string
	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() {
			return nil
		}
		q := filepath.Join(path, "quality_report.json")
		s := filepath.Join(path, "summary.json")
		p := filepath.Join(path, "analysis_phase.json")
		if existsFile(q) && existsFile(s) && existsFile(p) {
			found = path
			return syscall.EBUSY
		}
		return nil
	})
	if err != nil && !errors.Is(err, syscall.EBUSY) {
		return "", err
	}
	if found == "" {
		return "", errors.New("analysis output files not found")
	}
	return found, nil
}

func existsFile(path string) bool {
	fi, err := os.Stat(path)
	return err == nil && !fi.IsDir()
}

func buildArtifactManifest(resultDir string) (map[string]any, error) {
	entries, err := os.ReadDir(resultDir)
	if err != nil {
		return nil, err
	}

	files := make([]map[string]any, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			return nil, err
		}
		name := entry.Name()
		files = append(files, map[string]any{
			"name":       name,
			"size_bytes": info.Size(),
			"kind":       artifactKind(name),
		})
	}

	sort.Slice(files, func(i, j int) bool {
		return fmt.Sprint(files[i]["name"]) < fmt.Sprint(files[j]["name"])
	})

	return map[string]any{
		"result_dir": resultDir,
		"files":      files,
	}, nil
}

func buildCondensedPayloads(resultDir string) (map[string]any, map[string]any, error) {
	metadata, err := readJSONFile[analyzerMetadata](filepath.Join(resultDir, "metadata.json"))
	if err != nil {
		return nil, nil, err
	}
	timeseries, err := readJSONFile[analyzerTimeseries](filepath.Join(resultDir, "timeseries.json"))
	if err != nil {
		return nil, nil, err
	}

	playerMeta := make(map[int]analyzerMetadataPlayer, len(metadata.Players))
	for _, player := range metadata.Players {
		playerMeta[player.PlayerID] = player
	}

	matchFlowEvents, err := buildMatchFlowEvents(resultDir, playerMeta)
	if err != nil {
		return nil, nil, err
	}

	playerSeries := buildPlayerTimeseries(timeseries, playerMeta)

	return map[string]any{
			"version": "v1",
			"events":  matchFlowEvents,
		}, map[string]any{
			"version": "v1",
			"players": playerSeries,
		}, nil
}

func buildMatchFlowEvents(resultDir string, playerMeta map[int]analyzerMetadataPlayer) ([]map[string]any, error) {
	events := make([]map[string]any, 0, 32)
	seenTechUnits := make(map[string]bool)
	destroyBuckets := map[int]int{}

	eventFile, err := os.Open(filepath.Join(resultDir, "events.jsonl"))
	if err != nil {
		return nil, fmt.Errorf("open events.jsonl: %w", err)
	}
	defer eventFile.Close()

	scanner := bufio.NewScanner(eventFile)
	for scanner.Scan() {
		var row analyzerEventLine
		if err := json.Unmarshal(scanner.Bytes(), &row); err != nil {
			return nil, fmt.Errorf("decode events.jsonl: %w", err)
		}
		if row.Event != "unit_spawned" && row.Event != "unit_morphed" {
			if row.Event == "unit_destroyed" {
				bucket := (row.Frame / (24 * 20)) * (24 * 20)
				destroyBuckets[bucket]++
			}
			continue
		}
		if row.Subject == nil {
			continue
		}
		unitType := row.Subject.Type
		if !isHighTechUnit(unitType) {
			continue
		}
		key := fmt.Sprintf("%d:%s", row.Subject.PlayerID, unitType)
		if seenTechUnits[key] {
			continue
		}
		seenTechUnits[key] = true

		player := playerMeta[row.Subject.PlayerID]
		events = append(events, map[string]any{
			"type":        "tech_unit_first_seen",
			"frame":       row.Frame,
			"second":      frameToSecond(row.Frame),
			"player_id":   row.Subject.PlayerID,
			"player_name": player.Name,
			"team":        player.Team,
			"title":       formatUnitType(unitType),
			"subtitle":    fmt.Sprintf("%s first fielded %s", player.Name, formatUnitType(unitType)),
			"importance":  80,
			"tags":        []string{"tech_unit", unitType},
		})
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("scan events.jsonl: %w", err)
	}

	for bucket, count := range destroyBuckets {
		if count < 4 {
			continue
		}
		events = append(events, map[string]any{
			"type":        "battle_cluster",
			"frame":       bucket,
			"second":      frameToSecond(bucket),
			"player_id":   -1,
			"player_name": "",
			"team":        0,
			"title":       "Battle Spike",
			"subtitle":    fmt.Sprintf("%d units destroyed in a short window", count),
			"importance":  50 + count*3,
			"tags":        []string{"battle", "destroy"},
			"count":       count,
		})
	}

	snapshotFile, err := os.Open(filepath.Join(resultDir, "snapshots.jsonl"))
	if err != nil {
		return nil, fmt.Errorf("open snapshots.jsonl: %w", err)
	}
	defer snapshotFile.Close()

	lastWorkers := map[int]int{}
	lastWorkerDropFrame := map[int]int{}
	lastSupplyUsed := map[int]int{}
	lastSupplySwingFrame := map[int]int{}
	snapshotScanner := bufio.NewScanner(snapshotFile)
	for snapshotScanner.Scan() {
		var row snapshotLine
		if err := json.Unmarshal(snapshotScanner.Bytes(), &row); err != nil {
			return nil, fmt.Errorf("decode snapshots.jsonl: %w", err)
		}
		for _, playerRow := range row.Players {
			prev, ok := lastWorkers[playerRow.PlayerID]
			lastWorkers[playerRow.PlayerID] = playerRow.WorkerCount
			player := playerMeta[playerRow.PlayerID]

			prevSupply, hasSupply := lastSupplyUsed[playerRow.PlayerID]
			lastSupplyUsed[playerRow.PlayerID] = playerRow.SupplyUsed
			if hasSupply && prevSupply > 0 {
				supplyDelta := prevSupply - playerRow.SupplyUsed
				if supplyDelta >= 8 &&
					float64(playerRow.SupplyUsed) <= float64(prevSupply)*0.75 &&
					row.Frame-lastSupplySwingFrame[playerRow.PlayerID] >= 24*20 {
					lastSupplySwingFrame[playerRow.PlayerID] = row.Frame
					events = append(events, map[string]any{
						"type":        "supply_swing",
						"frame":       row.Frame,
						"second":      frameToSecond(row.Frame),
						"player_id":   playerRow.PlayerID,
						"player_name": player.Name,
						"team":        player.Team,
						"title":       "Supply Swing",
						"subtitle":    fmt.Sprintf("%s supply %d -> %d", player.Name, prevSupply, playerRow.SupplyUsed),
						"importance":  55 + supplyDelta*2,
						"tags":        []string{"supply", "battle"},
						"delta":       supplyDelta,
					})
				}
			}
			if !ok || prev <= 0 {
				continue
			}
			delta := prev - playerRow.WorkerCount
			if delta < 3 {
				continue
			}
			if float64(playerRow.WorkerCount) > float64(prev)*0.75 {
				continue
			}
			if row.Frame-lastWorkerDropFrame[playerRow.PlayerID] < 24*20 {
				continue
			}
			lastWorkerDropFrame[playerRow.PlayerID] = row.Frame
			events = append(events, map[string]any{
				"type":        "worker_drop",
				"frame":       row.Frame,
				"second":      frameToSecond(row.Frame),
				"player_id":   playerRow.PlayerID,
				"player_name": player.Name,
				"team":        player.Team,
				"title":       "Worker Drop",
				"subtitle":    fmt.Sprintf("%s workers %d -> %d", player.Name, prev, playerRow.WorkerCount),
				"importance":  60 + delta*4,
				"tags":        []string{"worker", "economy"},
				"delta":       delta,
			})
		}
	}
	if err := snapshotScanner.Err(); err != nil {
		return nil, fmt.Errorf("scan snapshots.jsonl: %w", err)
	}

	sort.Slice(events, func(i, j int) bool {
		frameI := toInt(events[i]["frame"])
		frameJ := toInt(events[j]["frame"])
		if frameI == frameJ {
			return toInt(events[i]["importance"]) > toInt(events[j]["importance"])
		}
		return frameI < frameJ
	})

	return events, nil
}

func buildPlayerTimeseries(timeseries analyzerTimeseries, playerMeta map[int]analyzerMetadataPlayer) []map[string]any {
	rows := make([]map[string]any, 0, len(timeseries.Players))
	for _, player := range timeseries.Players {
		meta := playerMeta[player.PlayerID]
		rows = append(rows, map[string]any{
			"player_id":   player.PlayerID,
			"player_name": meta.Name,
			"team":        meta.Team,
			"worker":      downsampleWorkerSeries(player.Series.Worker, 160),
			"supply":      downsampleSupplySeries(player.Series.Supply, 160),
			"vision":      downsampleVisionSeries(player.Series.Vision, 160),
			"kd":          downsampleKDSeries(player.Series.KD, 160),
		})
	}
	sort.Slice(rows, func(i, j int) bool {
		return toInt(rows[i]["player_id"]) < toInt(rows[j]["player_id"])
	})
	return rows
}

func downsampleWorkerSeries(points []workerPoint, maxPoints int) []map[string]any {
	out := make([]map[string]any, 0)
	for _, p := range sampleEvery(points, maxPoints) {
		out = append(out, map[string]any{
			"frame":  p.Frame,
			"second": frameToSecond(p.Frame),
			"count":  p.Count,
		})
	}
	return out
}

func downsampleSupplySeries(points []supplyPoint, maxPoints int) []map[string]any {
	out := make([]map[string]any, 0)
	for _, p := range sampleEvery(points, maxPoints) {
		out = append(out, map[string]any{
			"frame":   p.Frame,
			"second":  frameToSecond(p.Frame),
			"used":    p.Used,
			"cap":     p.Cap,
			"blocked": p.Blocked,
		})
	}
	return out
}

func downsampleVisionSeries(points []visionPoint, maxPoints int) []map[string]any {
	out := make([]map[string]any, 0)
	for _, p := range sampleEvery(points, maxPoints) {
		out = append(out, map[string]any{
			"frame":               p.Frame,
			"second":              frameToSecond(p.Frame),
			"vision_score":        p.VisionScore,
			"enemy_zone_coverage": p.EnemyZoneCoverage,
		})
	}
	return out
}

func downsampleKDSeries(points []kdPoint, maxPoints int) []map[string]any {
	out := make([]map[string]any, 0)
	for _, p := range sampleEvery(points, maxPoints) {
		out = append(out, map[string]any{
			"frame":  p.Frame,
			"second": frameToSecond(p.Frame),
			"kills":  p.Kills,
			"deaths": p.Deaths,
		})
	}
	return out
}

func sampleEvery[T any](points []T, maxPoints int) []T {
	if len(points) <= maxPoints || maxPoints <= 0 {
		return points
	}
	step := (len(points) + maxPoints - 1) / maxPoints
	out := make([]T, 0, maxPoints)
	for i := 0; i < len(points); i += step {
		out = append(out, points[i])
	}
	if len(points) > 0 && (len(points)-1)%step != 0 {
		out = append(out, points[len(points)-1])
	}
	return out
}

func isHighTechUnit(unitType string) bool {
	switch unitType {
	case "Protoss_Shuttle",
		"Protoss_Arbiter",
		"Protoss_Carrier",
		"Protoss_Reaver",
		"Terran_Science_Vessel",
		"Terran_Siege_Tank_Tank_Mode",
		"Terran_Siege_Tank_Siege_Mode",
		"Zerg_Defiler",
		"Zerg_Ultralisk",
		"Zerg_Queen":
		return true
	default:
		return false
	}
}

func formatUnitType(unitType string) string {
	unitType = strings.TrimSpace(unitType)
	unitType = strings.TrimPrefix(unitType, "Protoss_")
	unitType = strings.TrimPrefix(unitType, "Terran_")
	unitType = strings.TrimPrefix(unitType, "Zerg_")
	unitType = strings.ReplaceAll(unitType, "_", " ")
	unitType = strings.ReplaceAll(unitType, "Tank Mode", "Tank")
	unitType = strings.ReplaceAll(unitType, "Siege Mode", "Siege")
	return unitType
}

func frameToSecond(frame int) float64 {
	return float64(frame) / 24.0
}

func toInt(v any) int {
	switch t := v.(type) {
	case int:
		return t
	case int32:
		return int(t)
	case int64:
		return int(t)
	case float64:
		return int(t)
	default:
		return 0
	}
}

func artifactKind(name string) string {
	switch {
	case strings.HasSuffix(name, ".json"):
		return "json"
	case strings.HasSuffix(name, ".jsonl"):
		return "jsonl"
	default:
		return "file"
	}
}

func readJSONFile[T any](path string) (T, error) {
	var out T
	b, err := os.ReadFile(path)
	if err != nil {
		return out, fmt.Errorf("read %s: %w", path, err)
	}
	if err := json.Unmarshal(b, &out); err != nil {
		return out, fmt.Errorf("decode %s: %w", path, err)
	}
	return out, nil
}

func readJSONMap(path string) (map[string]any, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", path, err)
	}
	var out map[string]any
	if err := json.Unmarshal(b, &out); err != nil {
		return nil, fmt.Errorf("decode %s: %w", path, err)
	}
	return out, nil
}

func shorten(s string, max int) string {
	s = strings.TrimSpace(s)
	if len(s) <= max {
		return s
	}
	return s[:max] + "...(truncated)"
}
