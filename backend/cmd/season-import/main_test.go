package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestFetchExistingReplayHashesUsesCompactEndpoint(t *testing.T) {
	requests := map[string]int{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests[r.URL.Path]++
		if r.URL.Path != "/api/v1/games/replay-file-hashes" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(replayFileHashesResponse{
			Count: 2,
			ReplayFiles: []existingReplayFile{
				{FileHash: "hash-a", GameID: 10},
				{FileHash: "hash-b", GameID: 11},
			},
		})
	}))
	defer server.Close()

	hashes, err := fetchExistingReplayFiles(server.URL)
	if err != nil {
		t.Fatalf("fetchExistingReplayFiles() error = %v", err)
	}
	if hashes["hash-a"].GameID != 10 || hashes["hash-b"].GameID != 11 || len(hashes) != 2 {
		t.Fatalf("hashes = %v, want hash-a and hash-b", hashes)
	}
	if requests["/api/v1/games/replay-file-hashes"] != 1 {
		t.Fatalf("compact endpoint requests = %d, want 1", requests["/api/v1/games/replay-file-hashes"])
	}
}
