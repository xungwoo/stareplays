package replayanalysis

import (
	"os"
	"strings"
)

const (
	StatusNotRequested = "not_requested"
	StatusQueued       = "queued"
	StatusRunning      = "running"
	StatusSucceeded    = "succeeded"
	StatusFailed       = "failed"
)

func NormalizeStatus(v string) string {
	switch v {
	case StatusQueued, StatusRunning, StatusSucceeded, StatusFailed, StatusNotRequested:
		return v
	default:
		return StatusNotRequested
	}
}

func AnalyzerVersion() string {
	if v := strings.TrimSpace(os.Getenv("REPLAY_ANALYZER_VERSION")); v != "" {
		return v
	}
	return "v1"
}
