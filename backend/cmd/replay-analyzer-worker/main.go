package main

import (
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

	_, err = w.db.ExecContext(parent, `
		UPDATE game_analyses
		SET status = $2,
		    last_error = NULL,
		    quality_report_json = $3::jsonb,
		    summary_json = $4::jsonb,
		    analysis_phase_json = $5::jsonb,
		    finished_at = now(),
		    updated_at = now()
		WHERE id = $1
	`, job.ID, replayanalysis.StatusSucceeded, string(qualityRaw), string(summaryRaw), string(phaseRaw))
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
