package main

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/xungwoo/stareplays/internal/parser"
)

type expectedGame struct {
	Row              int               `json:"row"`
	Season           string            `json:"season"`
	SeasonNo         int               `json:"season_no"`
	Date             string            `json:"date,omitempty"`
	TeamA            []string          `json:"team_a"`
	TeamB            []string          `json:"team_b"`
	TeamARaces       []string          `json:"team_a_races"`
	TeamBRaces       []string          `json:"team_b_races"`
	WinnerSide       string            `json:"winner_side"`
	Signature        string            `json:"signature"`
	PlayerSignature  string            `json:"player_signature"`
	MatchMode        string            `json:"match_mode,omitempty"`
	MatchScore       int               `json:"match_score,omitempty"`
	RaceMismatch     int               `json:"race_mismatch,omitempty"`
	ScoreReasons     []string          `json:"score_reasons,omitempty"`
	MatchedFile      string            `json:"matched_file,omitempty"`
	MatchedTime      time.Time         `json:"matched_time,omitempty"`
	CandidateFiles   []replayCandidate `json:"candidate_files,omitempty"`
	LooseCandidates  []replayCandidate `json:"loose_candidates,omitempty"`
	PlayerCandidates []replayCandidate `json:"player_candidates,omitempty"`
	PreviousDateHint string            `json:"previous_date_hint,omitempty"`
	NextDateHint     string            `json:"next_date_hint,omitempty"`
}

type replayCandidate struct {
	Path         string    `json:"path"`
	FileHash     string    `json:"file_hash"`
	StartTime    time.Time `json:"start_time"`
	MapName      string    `json:"map_name,omitempty"`
	GameLength   int       `json:"game_length,omitempty"`
	Signature    string    `json:"signature"`
	PlayerSig    string    `json:"player_signature"`
	RaceMismatch int       `json:"race_mismatch,omitempty"`
	Score        int       `json:"score,omitempty"`
	ScoreReasons []string  `json:"score_reasons,omitempty"`
}

type report struct {
	Expected        int            `json:"expected"`
	Candidates      int            `json:"candidates"`
	Matched         int            `json:"matched"`
	MatchedGames    []expectedGame `json:"matched_games,omitempty"`
	Unmatched       []expectedGame `json:"unmatched"`
	Ambiguous       []expectedGame `json:"ambiguous"`
	ExistingHashes  int            `json:"existing_hashes"`
	SkippedExisting int            `json:"skipped_existing"`
	SeasonUpdated   int            `json:"season_updated"`
	Uploaded        int            `json:"uploaded"`
	UploadFailed    []string       `json:"upload_failed"`
}

var koreanToID = map[string]string{
	"민혁": "3x3_mh",
	"성민": "3x3_smwoo",
	"기용": "3x3_Kiyong",
	"명진": "3x3_syntax",
	"필균": "3x3_pil",
	"성우": "3x3_GG",
}

func main() {
	csvPath := flag.String("csv", "", "season CSV path")
	autoSaveDir := flag.String("autosave", "", "AutoSave directory")
	apiBase := flag.String("api", "https://stareplays-production.up.railway.app", "API base URL")
	execute := flag.Bool("execute", false, "upload matched replays")
	skipExisting := flag.Bool("skip-existing", true, "skip replay files whose hash already exists in the API")
	allowPlayerFallback := flag.Bool("allow-player-fallback", false, "when exact race signature is unavailable, match by winners/losers, date window, race mismatch score, map, and session continuity")
	flag.Parse()

	expected, err := parseSeasonCSV(*csvPath)
	must(err)
	candidates, err := scanReplays(*autoSaveDir)
	must(err)

	used := map[string]bool{}
	var unmatched []expectedGame
	var ambiguous []expectedGame
	var matched []expectedGame

	for _, exp := range expected {
		matches := matchingCandidates(exp, candidates, used)
		matchMode := "exact"
		if len(matches) == 0 && *allowPlayerFallback {
			matches = playerCandidates(exp, candidates, used)
			matchMode = "player_fallback"
		}
		if len(matches) == 0 {
			exp.CandidateFiles = matchingCandidates(exp, candidates, map[string]bool{})
			exp.LooseCandidates = signatureCandidates(exp, candidates)
			exp.PlayerCandidates = playerCandidates(exp, candidates, used)
			unmatched = append(unmatched, exp)
			continue
		}
		chosen := matches[0]
		exp.MatchedFile = chosen.Path
		exp.MatchedTime = chosen.StartTime
		exp.MatchMode = matchMode
		exp.MatchScore = chosen.Score
		exp.RaceMismatch = chosen.RaceMismatch
		exp.ScoreReasons = chosen.ScoreReasons
		used[chosen.Path] = true
		matched = append(matched, exp)
	}

	existingReplays := map[string]existingReplayFile{}
	if *execute && *skipExisting {
		var err error
		existingReplays, err = fetchExistingReplayFiles(*apiBase)
		must(err)
	}

	out := report{
		Expected:       len(expected),
		Candidates:     len(candidates),
		Matched:        len(matched),
		MatchedGames:   matched,
		Unmatched:      unmatched,
		Ambiguous:      ambiguous,
		ExistingHashes: len(existingReplays),
	}

	if *execute {
		for index, exp := range matched {
			if existing, ok := existingReplays[matchedHash(exp, candidates)]; ok {
				if existing.GameID > 0 {
					if err := updateGameSeason(*apiBase, existing.GameID, exp); err != nil {
						out.UploadFailed = append(out.UploadFailed, fmt.Sprintf("row %d update season game %d: %v", exp.Row, existing.GameID, err))
						continue
					}
					out.SeasonUpdated++
				}
				out.SkippedExisting++
				continue
			}
			fmt.Fprintf(os.Stderr, "upload %d/%d row=%d season=%s file=%s\n", index+1, len(matched), exp.Row, exp.Season, exp.MatchedFile)
			if err := uploadReplay(*apiBase, exp); err != nil {
				out.UploadFailed = append(out.UploadFailed, fmt.Sprintf("row %d %s: %v", exp.Row, exp.MatchedFile, err))
				continue
			}
			out.Uploaded++
		}
	}

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	must(enc.Encode(out))
}

func parseSeasonCSV(path string) ([]expectedGame, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	r := csv.NewReader(f)
	r.FieldsPerRecord = -1
	rows, err := r.ReadAll()
	if err != nil {
		return nil, err
	}

	var games []expectedGame
	var season string
	var seasonNo int
	var teamA, teamB []string
	var currentDate string

	for i, row := range rows {
		row = pad(row, 10)
		first := strings.TrimSpace(row[0])
		if strings.HasPrefix(first, "시즌") {
			season = first
			seasonNo = intValue(first)
			currentDate = ""
			continue
		}
		if isTeamHeader(row) {
			teamA = normalizeNames(row[1:4])
			teamB = normalizeNames(row[6:9])
			if d := normalizeDate(first, seasonNo); d != "" {
				currentDate = d
			}
			continue
		}
		if d := normalizeDate(first, seasonNo); d != "" {
			currentDate = d
		}
		if !isGameRow(row) || season == "" || len(teamA) != 3 || len(teamB) != 3 {
			continue
		}
		date := currentDate
		if strings.Contains(first, "날짜모름") {
			date = ""
		}
		exp := expectedGame{
			Row:        i + 1,
			Season:     season,
			SeasonNo:   seasonNo,
			Date:       date,
			TeamA:      append([]string{}, teamA...),
			TeamB:      append([]string{}, teamB...),
			TeamARaces: normalizeRaces(row[1:4]),
			TeamBRaces: normalizeRaces(row[6:9]),
		}
		if strings.TrimSpace(row[4]) == "승" {
			exp.WinnerSide = "A"
			exp.Signature = signature(exp.TeamA, exp.TeamARaces, exp.TeamB, exp.TeamBRaces)
			exp.PlayerSignature = playerSignature(exp.TeamA, exp.TeamB)
		} else {
			exp.WinnerSide = "B"
			exp.Signature = signature(exp.TeamB, exp.TeamBRaces, exp.TeamA, exp.TeamARaces)
			exp.PlayerSignature = playerSignature(exp.TeamB, exp.TeamA)
		}
		games = append(games, exp)
	}
	attachDateHints(games)
	return games, nil
}

func attachDateHints(games []expectedGame) {
	for i := range games {
		if games[i].Date != "" {
			continue
		}
		for j := i - 1; j >= 0; j-- {
			if games[j].Season != games[i].Season {
				break
			}
			if games[j].Date != "" {
				games[i].PreviousDateHint = games[j].Date
				break
			}
		}
		for j := i + 1; j < len(games); j++ {
			if games[j].Season != games[i].Season {
				break
			}
			if games[j].Date != "" {
				games[i].NextDateHint = games[j].Date
				break
			}
		}
	}
}

func scanReplays(root string) ([]replayCandidate, error) {
	var candidates []replayCandidate
	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(strings.ToLower(path), ".rep") {
			return nil
		}
		parsed, err := parser.ParseReplayFile(path)
		if err != nil || len(parsed.Players) != 6 {
			return nil
		}
		winners, losers := replaySides(parsed)
		if len(winners.names) != 3 || len(losers.names) != 3 {
			return nil
		}
		for _, name := range append(winners.names, losers.names...) {
			if !strings.HasPrefix(strings.ToLower(name), "3x3") {
				return nil
			}
		}
		candidates = append(candidates, replayCandidate{
			Path:       path,
			FileHash:   parsed.FileHash,
			StartTime:  parsed.StartTime,
			MapName:    parsed.MapName,
			GameLength: parsed.GameLength,
			Signature:  signature(winners.names, winners.races, losers.names, losers.races),
			PlayerSig:  playerSignature(winners.names, losers.names),
		})
		return nil
	})
	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].StartTime.Before(candidates[j].StartTime)
	})
	return candidates, err
}

type side struct{ names, races []string }

func replaySides(parsed *parser.ParsedGame) (side, side) {
	var winners, losers side
	for _, p := range parsed.Players {
		if p.IsWinner {
			winners.names = append(winners.names, p.Name)
			winners.races = append(winners.races, raceLetter(p.Race))
		} else {
			losers.names = append(losers.names, p.Name)
			losers.races = append(losers.races, raceLetter(p.Race))
		}
	}
	return winners, losers
}

func matchingCandidates(exp expectedGame, candidates []replayCandidate, used map[string]bool) []replayCandidate {
	var matches []replayCandidate
	for _, c := range candidates {
		if used[c.Path] || c.Signature != exp.Signature {
			continue
		}
		if exp.Date != "" {
			d, _ := time.ParseInLocation("2006-01-02", exp.Date, time.Local)
			cd := c.StartTime.In(time.Local)
			candidateDay := time.Date(cd.Year(), cd.Month(), cd.Day(), 0, 0, 0, 0, time.Local)
			if absDays(candidateDay.Sub(d)) > 1 {
				continue
			}
		} else if !candidateWithinDateHints(exp, c) {
			continue
		}
		matches = append(matches, c)
	}
	sort.Slice(matches, func(i, j int) bool {
		return matches[i].StartTime.Before(matches[j].StartTime)
	})
	return matches
}

func candidateWithinDateHints(exp expectedGame, c replayCandidate) bool {
	cd := c.StartTime.In(time.Local)
	candidateDay := time.Date(cd.Year(), cd.Month(), cd.Day(), 0, 0, 0, 0, time.Local)
	if exp.PreviousDateHint != "" {
		prev, err := time.ParseInLocation("2006-01-02", exp.PreviousDateHint, time.Local)
		if err == nil && candidateDay.Before(prev.AddDate(0, 0, -1)) {
			return false
		}
	}
	if exp.NextDateHint != "" {
		next, err := time.ParseInLocation("2006-01-02", exp.NextDateHint, time.Local)
		if err == nil && candidateDay.After(next.AddDate(0, 0, 1)) {
			return false
		}
	}
	return true
}

func signatureCandidates(exp expectedGame, candidates []replayCandidate) []replayCandidate {
	var matches []replayCandidate
	for _, c := range candidates {
		if c.Signature == exp.Signature {
			matches = append(matches, c)
		}
	}
	sort.Slice(matches, func(i, j int) bool {
		return matches[i].StartTime.Before(matches[j].StartTime)
	})
	return matches
}

func playerCandidates(exp expectedGame, candidates []replayCandidate, used map[string]bool) []replayCandidate {
	var matches []replayCandidate
	for _, c := range candidates {
		if used[c.Path] || c.PlayerSig != exp.PlayerSignature {
			continue
		}
		if exp.Date != "" {
			d, _ := time.ParseInLocation("2006-01-02", exp.Date, time.Local)
			cd := c.StartTime.In(time.Local)
			candidateDay := time.Date(cd.Year(), cd.Month(), cd.Day(), 0, 0, 0, 0, time.Local)
			if absDays(candidateDay.Sub(d)) > 1 {
				continue
			}
		} else if !candidateWithinDateHints(exp, c) {
			continue
		}
		c.RaceMismatch = raceMismatchCount(exp, c)
		c.Score, c.ScoreReasons = candidateScore(exp, c, candidates)
		matches = append(matches, c)
	}
	sort.Slice(matches, func(i, j int) bool {
		if matches[i].Score != matches[j].Score {
			return matches[i].Score > matches[j].Score
		}
		if matches[i].RaceMismatch != matches[j].RaceMismatch {
			return matches[i].RaceMismatch < matches[j].RaceMismatch
		}
		return matches[i].StartTime.Before(matches[j].StartTime)
	})
	return matches
}

func raceMismatchCount(exp expectedGame, c replayCandidate) int {
	expected := raceByPlayer(exp)
	actual := raceByPlayerFromSignature(c.Signature)
	mismatches := 0
	for player, expectedRace := range expected {
		if actual[player] != expectedRace {
			mismatches++
		}
	}
	return mismatches
}

func candidateScore(exp expectedGame, c replayCandidate, candidates []replayCandidate) (int, []string) {
	score := 100
	var reasons []string
	mismatch := raceMismatchCount(exp, c)
	score -= mismatch * 12
	reasons = append(reasons, fmt.Sprintf("race_mismatch=%d", mismatch))

	if exp.Date != "" {
		d, _ := time.ParseInLocation("2006-01-02", exp.Date, time.Local)
		cd := c.StartTime.In(time.Local)
		candidateDay := time.Date(cd.Year(), cd.Month(), cd.Day(), 0, 0, 0, 0, time.Local)
		dayDiff := absDays(candidateDay.Sub(d))
		score -= dayDiff * 4
		reasons = append(reasons, fmt.Sprintf("day_diff=%d", dayDiff))
	}

	if sameMapNeighborCount(c, candidates) > 0 {
		score += 8
		reasons = append(reasons, "same_map_cluster")
	}
	if seasonContinuityNeighborCount(c, candidates) > 0 {
		score += 6
		reasons = append(reasons, "continuous_session")
	}

	return score, reasons
}

func sameMapNeighborCount(c replayCandidate, candidates []replayCandidate) int {
	if strings.TrimSpace(c.MapName) == "" {
		return 0
	}
	count := 0
	for _, other := range candidates {
		if other.Path == c.Path || strings.TrimSpace(other.MapName) != strings.TrimSpace(c.MapName) {
			continue
		}
		if timeDistance(c.StartTime, other.StartTime) <= 3*time.Hour {
			count++
		}
	}
	return count
}

func seasonContinuityNeighborCount(c replayCandidate, candidates []replayCandidate) int {
	count := 0
	for _, other := range candidates {
		if other.Path == c.Path {
			continue
		}
		if timeDistance(c.StartTime, other.StartTime) <= 90*time.Minute {
			count++
		}
	}
	return count
}

func timeDistance(left, right time.Time) time.Duration {
	d := left.Sub(right)
	if d < 0 {
		return -d
	}
	return d
}

func raceByPlayer(exp expectedGame) map[string]string {
	races := map[string]string{}
	for i, player := range exp.TeamA {
		if i < len(exp.TeamARaces) {
			races[player] = exp.TeamARaces[i]
		}
	}
	for i, player := range exp.TeamB {
		if i < len(exp.TeamBRaces) {
			races[player] = exp.TeamBRaces[i]
		}
	}
	return races
}

func raceByPlayerFromSignature(sig string) map[string]string {
	races := map[string]string{}
	for _, section := range strings.Split(sig, "|") {
		section = strings.TrimPrefix(strings.TrimPrefix(section, "W:"), "L:")
		for _, part := range strings.Split(section, ",") {
			name, race, ok := strings.Cut(part, ":")
			if ok {
				races[strings.TrimSpace(name)] = strings.TrimSpace(race)
			}
		}
	}
	return races
}

func uploadReplay(apiBase string, exp expectedGame) error {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	fileWriter, err := writer.CreateFormFile("replay_files", filepath.Base(exp.MatchedFile))
	if err != nil {
		return err
	}
	f, err := os.Open(exp.MatchedFile)
	if err != nil {
		return err
	}
	if _, err := io.Copy(fileWriter, f); err != nil {
		_ = f.Close()
		return err
	}
	_ = f.Close()
	_ = writer.WriteField("season_label", exp.Season)
	_ = writer.WriteField("season_no", strconv.Itoa(exp.SeasonNo))
	if err := writer.Close(); err != nil {
		return err
	}
	client := http.Client{Timeout: 90 * time.Second}
	resp, err := client.Post(strings.TrimRight(apiBase, "/")+"/api/v1/games/upload", writer.FormDataContentType(), &body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 && resp.StatusCode != http.StatusConflict {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("upload status %d: %s", resp.StatusCode, string(b))
	}
	return nil
}

func updateGameSeason(apiBase string, gameID int, exp expectedGame) error {
	payload, err := json.Marshal(map[string]any{
		"season_label": exp.Season,
		"season_no":    exp.SeasonNo,
	})
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPut, fmt.Sprintf("%s/api/v1/games/%d/season", strings.TrimRight(apiBase, "/"), gameID), bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	client := http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("season update status %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

func matchedHash(exp expectedGame, candidates []replayCandidate) string {
	for _, candidate := range candidates {
		if candidate.Path == exp.MatchedFile {
			return candidate.FileHash
		}
	}
	for _, candidate := range exp.CandidateFiles {
		if candidate.Path == exp.MatchedFile {
			return candidate.FileHash
		}
	}
	return ""
}

type gamesListResponse struct {
	Total int `json:"total"`
	Games []struct {
		ID int `json:"id"`
	} `json:"games"`
}

type gameDetailResponse struct {
	Game struct {
		Edges struct {
			ReplayFiles []struct {
				FileHash string `json:"file_hash"`
			} `json:"replay_files"`
		} `json:"edges"`
		ReplayFiles []struct {
			FileHash string `json:"file_hash"`
		} `json:"replay_files"`
	} `json:"game"`
}

type existingReplayFile struct {
	FileHash string `json:"file_hash"`
	Filename string `json:"filename,omitempty"`
	GameID   int    `json:"game_id,omitempty"`
}

type replayFileHashesResponse struct {
	Count       int                  `json:"count"`
	Hashes      []string             `json:"hashes"`
	ReplayFiles []existingReplayFile `json:"replay_files"`
}

func fetchExistingReplayFiles(apiBase string) (map[string]existingReplayFile, error) {
	replays, err := fetchExistingReplayFilesFast(apiBase)
	if err == nil {
		return replays, nil
	}
	return fetchExistingReplayFilesFromGameDetails(apiBase)
}

func fetchExistingReplayFilesFast(apiBase string) (map[string]existingReplayFile, error) {
	client := http.Client{Timeout: 30 * time.Second}
	var response replayFileHashesResponse
	if err := fetchJSONWithRetry(client, strings.TrimRight(apiBase, "/")+"/api/v1/games/replay-file-hashes", &response); err != nil {
		return nil, err
	}
	replays := map[string]existingReplayFile{}
	for _, replay := range response.ReplayFiles {
		hash := strings.TrimSpace(replay.FileHash)
		if hash != "" {
			replay.FileHash = hash
			replays[hash] = replay
		}
	}
	if len(replays) == 0 {
		for _, hash := range response.Hashes {
			hash = strings.TrimSpace(hash)
			if hash != "" {
				replays[hash] = existingReplayFile{FileHash: hash}
			}
		}
	}
	return replays, nil
}

func fetchExistingReplayFilesFromGameDetails(apiBase string) (map[string]existingReplayFile, error) {
	replays := map[string]existingReplayFile{}
	client := http.Client{Timeout: 60 * time.Second}
	pageSize := 100
	total := 1
	for offset := 0; offset < total; offset += pageSize {
		var page gamesListResponse
		if err := fetchJSONWithRetry(client, fmt.Sprintf("%s/api/v1/games?limit=%d&offset=%d", strings.TrimRight(apiBase, "/"), pageSize, offset), &page); err != nil {
			return nil, err
		}
		total = page.Total
		for _, game := range page.Games {
			var detail gameDetailResponse
			time.Sleep(200 * time.Millisecond)
			if err := fetchJSONWithRetry(client, fmt.Sprintf("%s/api/v1/games/%d", strings.TrimRight(apiBase, "/"), game.ID), &detail); err != nil {
				return nil, err
			}
			for _, replay := range detail.Game.Edges.ReplayFiles {
				if replay.FileHash != "" {
					replays[replay.FileHash] = existingReplayFile{FileHash: replay.FileHash, GameID: game.ID}
				}
			}
			for _, replay := range detail.Game.ReplayFiles {
				if replay.FileHash != "" {
					replays[replay.FileHash] = existingReplayFile{FileHash: replay.FileHash, GameID: game.ID}
				}
			}
		}
	}
	return replays, nil
}

func fetchJSONWithRetry(client http.Client, url string, out any) error {
	var lastErr error
	for attempt := 0; attempt < 4; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt*attempt) * 500 * time.Millisecond)
		}
		if err := fetchJSON(client, url, out); err != nil {
			lastErr = err
			continue
		}
		return nil
	}
	return lastErr
}

func fetchJSON(client http.Client, url string, out any) error {
	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("GET %s status %d: %s", url, resp.StatusCode, string(body))
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func signature(wNames, wRaces, lNames, lRaces []string) string {
	return "W:" + sideSignature(wNames, wRaces) + "|L:" + sideSignature(lNames, lRaces)
}

func playerSignature(wNames, lNames []string) string {
	return "W:" + namesSignature(wNames) + "|L:" + namesSignature(lNames)
}

func namesSignature(names []string) string {
	parts := append([]string{}, names...)
	sort.Strings(parts)
	return strings.Join(parts, ",")
}

func sideSignature(names, races []string) string {
	parts := make([]string, 0, len(names))
	for i, name := range names {
		race := ""
		if i < len(races) {
			race = races[i]
		}
		parts = append(parts, strings.TrimSpace(name)+":"+race)
	}
	sort.Strings(parts)
	return strings.Join(parts, ",")
}

func isTeamHeader(row []string) bool {
	return knownName(row[1]) && knownName(row[2]) && knownName(row[3]) && knownName(row[6]) && knownName(row[7]) && knownName(row[8])
}

func isGameRow(row []string) bool {
	return raceLetter(row[1]) != "" && raceLetter(row[2]) != "" && raceLetter(row[3]) != "" &&
		raceLetter(row[6]) != "" && raceLetter(row[7]) != "" && raceLetter(row[8]) != "" &&
		((strings.TrimSpace(row[4]) == "승") != (strings.TrimSpace(row[9]) == "승"))
}

func normalizeNames(values []string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		out = append(out, koreanToID[strings.TrimSpace(value)])
	}
	return out
}

func normalizeRaces(values []string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		out = append(out, raceLetter(value))
	}
	return out
}

func raceLetter(value string) string {
	value = strings.TrimSpace(value)
	switch {
	case strings.Contains(value, "프") || strings.EqualFold(value, "Protoss") || strings.EqualFold(value, "P"):
		return "P"
	case strings.Contains(value, "테") || strings.EqualFold(value, "Terran") || strings.EqualFold(value, "T"):
		return "T"
	case strings.Contains(value, "저") || strings.EqualFold(value, "Zerg") || strings.EqualFold(value, "Z"):
		return "Z"
	default:
		return ""
	}
}

func normalizeDate(value string, seasonNo int) string {
	value = strings.TrimSpace(value)
	if value == "" || strings.Contains(value, "날짜모름") {
		return ""
	}
	value = strings.ReplaceAll(value, "/", "-")
	parts := strings.Split(value, "-")
	if len(parts) == 3 {
		year, _ := strconv.Atoi(parts[0])
		month, _ := strconv.Atoi(parts[1])
		day, _ := strconv.Atoi(parts[2])
		if year < 100 {
			year += 2000
		}
		return fmt.Sprintf("%04d-%02d-%02d", year, month, day)
	}
	if len(parts) == 2 {
		month, _ := strconv.Atoi(parts[0])
		day, _ := strconv.Atoi(parts[1])
		year := 2026
		if seasonNo <= 2 && month >= 11 {
			year = 2025
		}
		return fmt.Sprintf("%04d-%02d-%02d", year, month, day)
	}
	return ""
}

func knownName(value string) bool {
	_, ok := koreanToID[strings.TrimSpace(value)]
	return ok
}

func intValue(value string) int {
	digits := strings.Builder{}
	for _, r := range value {
		if r >= '0' && r <= '9' {
			digits.WriteRune(r)
		}
	}
	n, _ := strconv.Atoi(digits.String())
	return n
}

func pad(row []string, length int) []string {
	for len(row) < length {
		row = append(row, "")
	}
	return row
}

func absDays(d time.Duration) int {
	if d < 0 {
		d = -d
	}
	return int(d.Hours() / 24)
}

func must(err error) {
	if err != nil {
		panic(err)
	}
}
