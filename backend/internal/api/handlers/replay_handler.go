package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"mime/multipart"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/xungwoo/stareplays/ent"
	"github.com/xungwoo/stareplays/ent/appsetting"
	"github.com/xungwoo/stareplays/ent/game"
	"github.com/xungwoo/stareplays/ent/gameanalysis"
	"github.com/xungwoo/stareplays/ent/player"
	"github.com/xungwoo/stareplays/ent/replayfile"
	"github.com/xungwoo/stareplays/ent/user"
	"github.com/xungwoo/stareplays/internal/database"
	"github.com/xungwoo/stareplays/internal/parser"
	"github.com/xungwoo/stareplays/internal/replayanalysis"
	"github.com/xungwoo/stareplays/internal/services/analyzer"
	"github.com/xungwoo/stareplays/internal/services/ranking"
	"github.com/xungwoo/stareplays/internal/storage/replaybucket"
)

var errAlreadyUploadedByUser = errors.New("this user already uploaded a replay for the game")

const (
	defaultReplayUploadDir              = "/tmp/stareplays/uploads"
	defaultReplayMaxSizeMB              = 30
	maxReplayParseWorkers               = 4
	invalidGameMaxDurationSeconds       = 120
	bytesPerMB                    int64 = 1024 * 1024
)

// ParseReplayRequest represents the request to parse a replay file.
type ParseReplayRequest struct {
	FilePath     string `json:"file_path" validate:"required"`
	UploaderName string `json:"uploader_name" validate:"required"`
}

type ReplayPreview struct {
	Filename      string   `json:"filename"`
	Host          string   `json:"host"`
	StartTime     string   `json:"start_time"`
	MapName       string   `json:"map_name"`
	PlayerCount   int      `json:"player_count"`
	ParsedPlayers []string `json:"parsed_players"`
}

type parsedUploadFile struct {
	FileHeader *multipart.FileHeader
	Parsed     *parser.ParsedGame
	ReplayData []byte
	Err        error
}

type gameResponseDTO struct {
	ID             int                    `json:"id"`
	Host           string                 `json:"host,omitempty"`
	StartTime      time.Time              `json:"start_time,omitempty"`
	MapName        string                 `json:"map_name,omitempty"`
	MapWidth       uint16                 `json:"map_width,omitempty"`
	MapHeight      uint16                 `json:"map_height,omitempty"`
	GameLength     int                    `json:"game_length,omitempty"`
	GameType       string                 `json:"game_type,omitempty"`
	GameSpeed      string                 `json:"game_speed,omitempty"`
	Title          string                 `json:"title,omitempty"`
	PlayerCount    int                    `json:"player_count,omitempty"`
	UploadCount    int                    `json:"upload_count,omitempty"`
	WinnerTeam     uint8                  `json:"winner_team,omitempty"`
	SeasonLabel    *string                `json:"season_label,omitempty"`
	SeasonNo       *int                   `json:"season_no,omitempty"`
	CreatedAt      time.Time              `json:"created_at,omitempty"`
	UpdatedAt      time.Time              `json:"updated_at,omitempty"`
	Edges          gameResponseEdgesDTO   `json:"edges"`
	SeasonAnalysis *seasonGameAnalysisDTO `json:"season_analysis,omitempty"`
}

type seasonSummary struct {
	SeasonLabel string            `json:"season_label"`
	SeasonNo    *int              `json:"season_no,omitempty"`
	Games       int               `json:"games"`
	WinsByTeam  map[string]int    `json:"wins_by_team"`
	GameIDs     []int             `json:"game_ids"`
	GamesData   []gameResponseDTO `json:"games_data,omitempty"`
}

type seasonRequest struct {
	SeasonLabel string `json:"season_label"`
	SeasonNo    *int   `json:"season_no,omitempty"`
}

const currentSeasonSettingKey = "current_season"

type uploadOptions struct {
	UploaderName string
	SeasonLabel  *string
	SeasonNo     *int
}

type gameResponseEdgesDTO struct {
	Players     []gamePlayerDTO     `json:"players,omitempty"`
	ReplayFiles []gameReplayFileDTO `json:"replay_files,omitempty"`
	Analysis    *ent.GameAnalysis   `json:"analysis,omitempty"`
	GameDetail  *ent.GameDetail     `json:"game_detail,omitempty"`
}

type gamePlayerDTO struct {
	ID                int       `json:"id"`
	Name              string    `json:"name,omitempty"`
	Race              string    `json:"race,omitempty"`
	Team              uint8     `json:"team,omitempty"`
	Color             string    `json:"color,omitempty"`
	PlayerID          uint8     `json:"player_id"`
	Apm               int32     `json:"apm,omitempty"`
	Eapm              int32     `json:"eapm,omitempty"`
	CmdCount          uint32    `json:"cmd_count,omitempty"`
	EffectiveCmdCount uint32    `json:"effective_cmd_count,omitempty"`
	StartLocationX    uint16    `json:"start_location_x,omitempty"`
	StartLocationY    uint16    `json:"start_location_y,omitempty"`
	StartDirection    int32     `json:"start_direction,omitempty"`
	Redundancy        int       `json:"redundancy,omitempty"`
	IsWinner          bool      `json:"is_winner"`
	Result            string    `json:"result,omitempty"`
	CreatedAt         time.Time `json:"created_at,omitempty"`
	Edges             fiber.Map `json:"edges"`
}

type gameReplayFileDTO struct {
	ID        int       `json:"id"`
	FileHash  string    `json:"file_hash,omitempty"`
	Filename  string    `json:"filename,omitempty"`
	CreatedAt time.Time `json:"created_at,omitempty"`
	Edges     fiber.Map `json:"edges"`
}

type seasonGameAnalysisDTO struct {
	Status     string                             `json:"status"`
	DataSource string                             `json:"data_source"`
	Players    map[string]seasonPlayerAnalysisDTO `json:"players"`
}

type seasonPlayerAnalysisDTO struct {
	Production      float64 `json:"production,omitempty"`
	ResourceSpend   float64 `json:"resource_spend,omitempty"`
	WorkerPeak      float64 `json:"worker_peak,omitempty"`
	Kills           float64 `json:"kills,omitempty"`
	TechAndUpgrades float64 `json:"tech_and_upgrades,omitempty"`
}

var (
	replayBucketOnce   sync.Once
	replayBucketClient *replaybucket.Client
	replayBucketErr    error
	notifyDBOnce       sync.Once
	notifyDB           *sql.DB
	notifyDBErr        error
)

// ParseLocalReplay parses a local replay file and saves it to database.
func ParseLocalReplay(c *fiber.Ctx) error {
	var req ParseReplayRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if req.FilePath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "file_path is required",
		})
	}

	// Parse replay file
	parsed, err := parser.ParseReplayFile(req.FilePath)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Failed to parse replay file",
			"details": err.Error(),
		})
	}

	return processParsedReplay(c, parsed, uploadOptions{UploaderName: req.UploaderName}, nil)
}

// ParseUploadedReplay parses an uploaded replay file (multipart/form-data) and saves it.
func ParseUploadedReplay(c *fiber.Ctx) error {
	form, err := c.MultipartForm()
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "invalid multipart form",
			"details": err.Error(),
		})
	}

	files := collectReplayFiles(form)
	if len(files) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "replay_file or replay_files is required",
		})
	}

	options, err := uploadOptionsFromRequest(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "invalid upload options",
			"details": err.Error(),
		})
	}

	// Backward compatibility: single upload keeps original response shape.
	if len(files) == 1 {
		parsed, replayData, err := parseUploadedFile(files[0])
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error":   "Failed to parse replay file",
				"details": err.Error(),
			})
		}
		return processParsedReplay(c, parsed, options, replayData)
	}

	results := make([]fiber.Map, 0, len(files))
	successCount := 0
	failedCount := 0

	parsedFiles := parseUploadedFilesInParallel(files)
	for _, parsedFile := range parsedFiles {
		fh := parsedFile.FileHeader
		if parsedFile.Err != nil {
			failedCount++
			results = append(results, fiber.Map{
				"filename": fh.Filename,
				"ok":       false,
				"status":   fiber.StatusBadRequest,
				"error":    parsedFile.Err.Error(),
			})
			continue
		}

		status, payload := processParsedReplayResult(c.Context(), parsedFile.Parsed, options, parsedFile.ReplayData)
		ok := status < 400
		if ok {
			successCount++
		} else {
			failedCount++
		}

		results = append(results, fiber.Map{
			"filename": fh.Filename,
			"ok":       ok,
			"status":   status,
			"result":   payload,
		})
	}

	return c.JSON(fiber.Map{
		"message":       "Batch replay upload completed",
		"total_files":   len(files),
		"success_count": successCount,
		"failed_count":  failedCount,
		"results":       results,
	})
}

// PreviewUploadedReplay parses uploaded replay files and returns candidate players.
func PreviewUploadedReplay(c *fiber.Ctx) error {
	form, err := c.MultipartForm()
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "invalid multipart form",
			"details": err.Error(),
		})
	}

	files := collectReplayFiles(form)
	if len(files) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "replay_file or replay_files is required",
		})
	}

	results := make([]fiber.Map, 0, len(files))
	successCount := 0
	failedCount := 0
	candidateSet := make(map[string]struct{})

	parsedFiles := parseUploadedFilesInParallel(files)
	for _, parsedFile := range parsedFiles {
		fh := parsedFile.FileHeader
		if parsedFile.Err != nil {
			failedCount++
			results = append(results, fiber.Map{
				"filename": fh.Filename,
				"ok":       false,
				"status":   fiber.StatusBadRequest,
				"error":    parsedFile.Err.Error(),
			})
			continue
		}

		successCount++
		candidates := previewPlayerNames(parsedFile.Parsed)
		for _, name := range candidates {
			candidateSet[name] = struct{}{}
		}
		results = append(results, fiber.Map{
			"filename": fh.Filename,
			"ok":       true,
			"status":   fiber.StatusOK,
			"preview":  replayPreviewFromParsed(parsedFile.Parsed),
		})
	}

	allCandidates := make([]string, 0, len(candidateSet))
	for name := range candidateSet {
		allCandidates = append(allCandidates, name)
	}
	sort.Strings(allCandidates)

	return c.JSON(fiber.Map{
		"message":            "Replay preview completed",
		"total_files":        len(files),
		"success_count":      successCount,
		"failed_count":       failedCount,
		"candidate_players":  allCandidates,
		"preview_candidates": allCandidates,
		"results":            results,
	})
}

func processParsedReplay(c *fiber.Ctx, parsed *parser.ParsedGame, options uploadOptions, replayData []byte) error {
	status, payload := processParsedReplayResult(c.Context(), parsed, options, replayData)
	return c.Status(status).JSON(payload)
}

func processParsedReplayResult(ctx context.Context, parsed *parser.ParsedGame, options uploadOptions, replayData []byte) (int, fiber.Map) {
	if non3x3 := nonThreeVsThreePlayers(parsed.Players); len(non3x3) > 0 {
		return fiber.StatusBadRequest, fiber.Map{
			"error":       "replay contains non-3x3 players",
			"non_players": non3x3,
		}
	}

	uploaderName := strings.TrimSpace(options.UploaderName)
	if uploaderName == "" {
		uploaderName = autoUploaderName(parsed.Players)
	}
	if uploaderName == "" {
		return fiber.StatusBadRequest, fiber.Map{
			"error": "no 3x3 player found in replay",
		}
	}
	uploader, err := getOrCreateUser(ctx, uploaderName)
	if err != nil {
		return fiber.StatusInternalServerError, fiber.Map{
			"error":   "Failed to resolve uploader",
			"details": err.Error(),
		}
	}

	// Game policy: playtime <= 2 minutes is treated as invalid draw (no winner/loser).
	normalizeParsedOutcomeForShortGame(parsed)

	// Same replay hash already exists: do not re-parse game data, only increase reliability.
	existingReplay, err := database.Client.ReplayFile.
		Query().
		Where(replayfile.FileHashEQ(parsed.FileHash)).
		WithGame(func(gq *ent.GameQuery) {
			gq.WithPlayers()
		}).
		First(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			existingReplay = nil
		} else {
			return fiber.StatusInternalServerError, fiber.Map{
				"error":   "Database query failed",
				"details": err.Error(),
			}
		}
	}

	if existingReplay != nil {
		hashGame := existingReplay.Edges.Game
		if hashGame == nil {
			hashGame, err = existingReplay.QueryGame().WithPlayers().Only(ctx)
			if err != nil {
				return fiber.StatusInternalServerError, fiber.Map{
					"error":   "Database query failed",
					"details": err.Error(),
				}
			}
		}

		savedGame, err := addReplayFileToGame(ctx, hashGame, uploader, parsed, replayData)
		if err != nil {
			if errors.Is(err, errAlreadyUploadedByUser) {
				savedGame = hashGame
			} else {
				return fiber.StatusInternalServerError, fiber.Map{
					"error":   "Failed to add replay file",
					"details": err.Error(),
				}
			}
		}
		savedGame, err = applySeasonToGame(ctx, savedGame.ID, options)
		if err != nil {
			return fiber.StatusInternalServerError, fiber.Map{
				"error":   "Failed to set season",
				"details": err.Error(),
			}
		}

		return fiber.StatusOK, fiber.Map{
			"message":      "Replay already known; reliability updated only",
			"game":         savedGame,
			"upload_count": savedGame.UploadCount,
			"reliability":  reliabilityText(savedGame.UploadCount, savedGame.PlayerCount),
		}
	}

	// Check if same game already exists (host + start_time)
	existingGame, err := database.Client.Game.
		Query().
		Where(
			game.HostEQ(parsed.Host),
			game.StartTimeEQ(parsed.StartTime),
		).
		WithPlayers().
		Only(ctx)

	if err != nil && !ent.IsNotFound(err) {
		return fiber.StatusInternalServerError, fiber.Map{
			"error":   "Database query failed",
			"details": err.Error(),
		}
	}

	if existingGame != nil {
		// Same game exists — add replay file and increment upload count
		savedGame, err := addReplayFileToGame(ctx, existingGame, uploader, parsed, replayData)
		if err != nil {
			if errors.Is(err, errAlreadyUploadedByUser) {
				savedGame = existingGame
			} else {
				return fiber.StatusInternalServerError, fiber.Map{
					"error":   "Failed to add replay file",
					"details": err.Error(),
				}
			}
		}
		savedGame, err = applySeasonToGame(ctx, savedGame.ID, options)
		if err != nil {
			return fiber.StatusInternalServerError, fiber.Map{
				"error":   "Failed to set season",
				"details": err.Error(),
			}
		}
		return fiber.StatusOK, fiber.Map{
			"message":      "Replay file added to existing game (reliability increased)",
			"game":         savedGame,
			"upload_count": savedGame.UploadCount,
			"reliability":  reliabilityText(savedGame.UploadCount, savedGame.PlayerCount),
		}
	}

	if strings.TrimSpace(options.UploaderName) != "" && !isUploaderInParsedPlayers(parsed.Players, uploaderName) {
		return fiber.StatusBadRequest, fiber.Map{
			"error": "uploader must be one of non-observer players in this replay",
		}
	}

	// New game — create everything in a transaction
	savedGame, err := createNewGame(ctx, parsed, uploader, options, replayData)
	if err != nil {
		return fiber.StatusInternalServerError, fiber.Map{
			"error":   "Failed to save game to database",
			"details": err.Error(),
		}
	}

	return fiber.StatusCreated, fiber.Map{
		"message": "Game parsed and saved successfully",
		"game":    savedGame,
	}
}

func buildGameResponseDTO(g *ent.Game) gameResponseDTO {
	dto := gameResponseDTO{
		ID:          g.ID,
		Host:        g.Host,
		StartTime:   g.StartTime,
		MapName:     g.MapName,
		MapWidth:    g.MapWidth,
		MapHeight:   g.MapHeight,
		GameLength:  g.GameLength,
		GameType:    g.GameType,
		GameSpeed:   g.GameSpeed,
		Title:       g.Title,
		PlayerCount: g.PlayerCount,
		UploadCount: g.UploadCount,
		WinnerTeam:  g.WinnerTeam,
		SeasonLabel: g.SeasonLabel,
		SeasonNo:    g.SeasonNo,
		CreatedAt:   g.CreatedAt,
		UpdatedAt:   g.UpdatedAt,
		Edges: gameResponseEdgesDTO{
			Players:     make([]gamePlayerDTO, 0, len(g.Edges.Players)),
			ReplayFiles: make([]gameReplayFileDTO, 0, len(g.Edges.ReplayFiles)),
			Analysis:    g.Edges.Analysis,
			GameDetail:  g.Edges.GameDetail,
		},
	}

	for _, p := range g.Edges.Players {
		dto.Edges.Players = append(dto.Edges.Players, gamePlayerDTO{
			ID:                p.ID,
			Name:              p.Name,
			Race:              p.Race,
			Team:              p.Team,
			Color:             p.Color,
			PlayerID:          p.PlayerID,
			Apm:               p.Apm,
			Eapm:              p.Eapm,
			CmdCount:          p.CmdCount,
			EffectiveCmdCount: p.EffectiveCmdCount,
			StartLocationX:    p.StartLocationX,
			StartLocationY:    p.StartLocationY,
			StartDirection:    p.StartDirection,
			Redundancy:        p.Redundancy,
			IsWinner:          p.IsWinner,
			Result:            p.Result,
			CreatedAt:         p.CreatedAt,
			Edges:             fiber.Map{},
		})
	}

	for _, rf := range g.Edges.ReplayFiles {
		dto.Edges.ReplayFiles = append(dto.Edges.ReplayFiles, gameReplayFileDTO{
			ID:        rf.ID,
			FileHash:  rf.FileHash,
			Filename:  rf.Filename,
			CreatedAt: rf.CreatedAt,
			Edges:     fiber.Map{},
		})
	}
	dto.SeasonAnalysis = buildSeasonGameAnalysisDTO(g)

	return dto
}

func buildSeasonGameAnalysisDTO(g *ent.Game) *seasonGameAnalysisDTO {
	if g == nil {
		return nil
	}
	status := replayanalysis.StatusNotRequested
	if g.Edges.Analysis != nil {
		status = replayanalysis.NormalizeStatus(g.Edges.Analysis.Status)
	}

	players := make(map[string]seasonPlayerAnalysisDTO, len(g.Edges.Players))
	for _, p := range g.Edges.Players {
		if p == nil || strings.TrimSpace(p.Name) == "" {
			continue
		}
		players[p.Name] = seasonPlayerAnalysisDTO{}
	}
	if len(players) == 0 {
		return nil
	}

	dataSource := ""
	if detail := g.Edges.GameDetail; detail != nil {
		dataSource = "detail_analysis"
		if unitProd := buildUnitProductionDTO(detail, g.Edges.Players); unitProd != nil {
			for _, s := range unitProd.Summaries {
				m := players[s.PlayerName]
				m.Production = float64(s.Total)
				players[s.PlayerName] = m
			}
		}
		if resource := buildResourceSpendDTO(detail, g.Edges.Players); resource != nil {
			for _, s := range resource.Summaries {
				m := players[s.PlayerName]
				m.ResourceSpend = float64(s.TotalSpend)
				players[s.PlayerName] = m
			}
		}
		if tech := buildTechTreeDTO(g, detail); tech != nil {
			for _, s := range tech.Summary {
				m := players[s.PlayerName]
				m.TechAndUpgrades = float64(s.TechCount + s.UpgradeCount)
				players[s.PlayerName] = m
			}
		}
	}

	if analysis := g.Edges.Analysis; analysis != nil && replayanalysis.NormalizeStatus(analysis.Status) == replayanalysis.StatusSucceeded {
		if mergeAnalyzerSeasonMetrics(players, analysis, g.Edges.Players) {
			if dataSource == "" {
				dataSource = "replay_analyzer"
			} else {
				dataSource += "+replay_analyzer"
			}
		}
	}

	if dataSource == "" && status == replayanalysis.StatusNotRequested {
		return nil
	}
	return &seasonGameAnalysisDTO{
		Status:     status,
		DataSource: dataSource,
		Players:    players,
	}
}

func mergeAnalyzerSeasonMetrics(players map[string]seasonPlayerAnalysisDTO, analysis *ent.GameAnalysis, gamePlayers []*ent.Player) bool {
	rawPlayers, ok := analysis.SummaryJSON["players"].([]interface{})
	if !ok {
		return false
	}
	nameByID := make(map[int]string, len(gamePlayers))
	for _, p := range gamePlayers {
		if p != nil {
			nameByID[int(p.PlayerID)] = p.Name
		}
	}

	merged := false
	for _, raw := range rawPlayers {
		playerMap, ok := raw.(map[string]interface{})
		if !ok {
			continue
		}
		name := stringFromAny(playerMap["player_name"])
		if name == "" {
			name = stringFromAny(playerMap["name"])
		}
		if name == "" {
			name = nameByID[int(numberFromAny(playerMap["player_id"]))]
		}
		if name == "" {
			continue
		}
		final, ok := playerMap["final"].(map[string]interface{})
		if !ok {
			continue
		}
		m := players[name]
		m.Kills = numberFromAny(final["kills"])
		m.WorkerPeak = numberFromAny(final["worker_peak"])
		players[name] = m
		merged = true
	}
	return merged
}

func collectReplayFiles(form *multipart.Form) []*multipart.FileHeader {
	if form == nil || form.File == nil {
		return nil
	}
	var files []*multipart.FileHeader
	files = append(files, form.File["replay_files"]...)
	files = append(files, form.File["replay_file"]...)
	return files
}

func isThreeVsThreeName(name string) bool {
	return strings.HasPrefix(strings.ToLower(strings.TrimSpace(name)), "3x3")
}

func nonThreeVsThreePlayers(players []parser.ParsedPlayer) []string {
	nonPlayers := make([]string, 0)
	for _, p := range players {
		name := strings.TrimSpace(p.Name)
		if name == "" || !isThreeVsThreeName(name) {
			nonPlayers = append(nonPlayers, name)
		}
	}
	sort.Strings(nonPlayers)
	return nonPlayers
}

func autoUploaderName(players []parser.ParsedPlayer) string {
	for _, p := range players {
		name := strings.TrimSpace(p.Name)
		if isThreeVsThreeName(name) {
			return name
		}
	}
	return ""
}

func uploadOptionsFromRequest(c *fiber.Ctx) (uploadOptions, error) {
	options := uploadOptions{
		UploaderName: strings.TrimSpace(c.FormValue("uploader_name")),
	}

	label := strings.TrimSpace(c.FormValue("season_label"))
	if label != "" {
		options.SeasonLabel = &label
		if rawNo := strings.TrimSpace(c.FormValue("season_no")); rawNo != "" {
			seasonNo, err := strconv.Atoi(rawNo)
			if err != nil || seasonNo <= 0 {
				return options, fmt.Errorf("season_no must be a positive integer")
			}
			options.SeasonNo = &seasonNo
		} else if inferred := inferSeasonNo(label); inferred != nil {
			options.SeasonNo = inferred
		}
		return options, nil
	}

	current, err := getCurrentSeason(c.Context())
	if err != nil {
		return options, err
	}
	options.SeasonLabel = current.SeasonLabel
	options.SeasonNo = current.SeasonNo
	return options, nil
}

func inferSeasonNo(label string) *int {
	digits := strings.Builder{}
	for _, r := range label {
		if r >= '0' && r <= '9' {
			digits.WriteRune(r)
		}
	}
	if digits.Len() == 0 {
		return nil
	}
	value, err := strconv.Atoi(digits.String())
	if err != nil || value <= 0 {
		return nil
	}
	return &value
}

func applySeasonToGame(ctx context.Context, gameID int, options uploadOptions) (*ent.Game, error) {
	if options.SeasonLabel == nil && options.SeasonNo == nil {
		return database.Client.Game.Query().Where(game.IDEQ(gameID)).WithPlayers().WithReplayFiles().Only(ctx)
	}
	update := database.Client.Game.UpdateOneID(gameID)
	if options.SeasonLabel != nil {
		update.SetSeasonLabel(*options.SeasonLabel)
	}
	if options.SeasonNo != nil {
		update.SetSeasonNo(*options.SeasonNo)
	}
	return update.Save(ctx)
}

func getCurrentSeason(ctx context.Context) (uploadOptions, error) {
	row, err := database.Client.AppSetting.Query().
		Where(appsetting.KeyEQ(currentSeasonSettingKey)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return uploadOptions{}, nil
		}
		return uploadOptions{}, err
	}
	var req seasonRequest
	if err := json.Unmarshal([]byte(row.Value), &req); err != nil {
		return uploadOptions{}, err
	}
	options := uploadOptions{}
	label := strings.TrimSpace(req.SeasonLabel)
	if label != "" {
		options.SeasonLabel = &label
	}
	if req.SeasonNo != nil && *req.SeasonNo > 0 {
		options.SeasonNo = req.SeasonNo
	} else if inferred := inferSeasonNo(label); inferred != nil {
		options.SeasonNo = inferred
	}
	return options, nil
}

func setCurrentSeason(ctx context.Context, req seasonRequest) (uploadOptions, error) {
	label := strings.TrimSpace(req.SeasonLabel)
	if label == "" {
		return uploadOptions{}, fmt.Errorf("season_label is required")
	}
	if req.SeasonNo == nil {
		req.SeasonNo = inferSeasonNo(label)
	}
	payload, err := json.Marshal(req)
	if err != nil {
		return uploadOptions{}, err
	}

	existing, err := database.Client.AppSetting.Query().
		Where(appsetting.KeyEQ(currentSeasonSettingKey)).
		Only(ctx)
	if err != nil && !ent.IsNotFound(err) {
		return uploadOptions{}, err
	}
	if existing == nil {
		if _, err := database.Client.AppSetting.Create().
			SetKey(currentSeasonSettingKey).
			SetValue(string(payload)).
			Save(ctx); err != nil {
			return uploadOptions{}, err
		}
	} else if _, err := database.Client.AppSetting.UpdateOneID(existing.ID).
		SetValue(string(payload)).
		Save(ctx); err != nil {
		return uploadOptions{}, err
	}

	label = strings.TrimSpace(req.SeasonLabel)
	return uploadOptions{
		SeasonLabel: &label,
		SeasonNo:    req.SeasonNo,
	}, nil
}

func parseUploadedFile(fileHeader *multipart.FileHeader) (*parser.ParsedGame, []byte, error) {
	if err := validateReplayUpload(fileHeader); err != nil {
		return nil, nil, err
	}

	f, err := fileHeader.Open()
	if err != nil {
		return nil, nil, fmt.Errorf("failed to open uploaded file: %w", err)
	}
	defer func() { _ = f.Close() }()

	maxBytes := replayMaxUploadBytes()
	payload, err := io.ReadAll(io.LimitReader(f, maxBytes+1))
	if err != nil {
		return nil, nil, fmt.Errorf("failed to read uploaded replay file: %w", err)
	}
	if int64(len(payload)) > maxBytes {
		return nil, nil, fmt.Errorf("replay file is too large: %d bytes (max %d bytes)", len(payload), maxBytes)
	}

	parsed, err := parser.ParseReplayData(fileHeader.Filename, payload)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse replay file: %w", err)
	}
	parsed.Filename = fileHeader.Filename
	return parsed, payload, nil
}

func parseUploadedFilesInParallel(files []*multipart.FileHeader) []parsedUploadFile {
	results := make([]parsedUploadFile, len(files))
	if len(files) == 0 {
		return results
	}
	workers := len(files)
	if workers > maxReplayParseWorkers {
		workers = maxReplayParseWorkers
	}
	if workers <= 1 {
		fh := files[0]
		parsed, replayData, err := parseUploadedFile(fh)
		results[0] = parsedUploadFile{
			FileHeader: fh,
			Parsed:     parsed,
			ReplayData: replayData,
			Err:        err,
		}
		return results
	}

	jobCh := make(chan int)
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for idx := range jobCh {
				fh := files[idx]
				parsed, replayData, err := parseUploadedFile(fh)
				results[idx] = parsedUploadFile{
					FileHeader: fh,
					Parsed:     parsed,
					ReplayData: replayData,
					Err:        err,
				}
			}
		}()
	}
	for idx := range files {
		jobCh <- idx
	}
	close(jobCh)
	wg.Wait()
	return results
}

func replayUploadDir() string {
	if dir := strings.TrimSpace(os.Getenv("REPLAY_UPLOAD_DIR")); dir != "" {
		return dir
	}
	return defaultReplayUploadDir
}

func replayMaxUploadBytes() int64 {
	mbStr := strings.TrimSpace(os.Getenv("REPLAY_MAX_SIZE_MB"))
	if mbStr == "" {
		return defaultReplayMaxSizeMB * bytesPerMB
	}
	mb, err := strconv.ParseInt(mbStr, 10, 64)
	if err != nil || mb <= 0 {
		return defaultReplayMaxSizeMB * bytesPerMB
	}
	return mb * bytesPerMB
}

func validateReplayUpload(fileHeader *multipart.FileHeader) error {
	if fileHeader == nil {
		return fmt.Errorf("replay file is required")
	}
	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	if ext != ".rep" {
		return fmt.Errorf("invalid replay extension: %s", ext)
	}
	maxBytes := replayMaxUploadBytes()
	if fileHeader.Size > maxBytes {
		return fmt.Errorf("replay file is too large: %d bytes (max %d bytes)", fileHeader.Size, maxBytes)
	}
	return nil
}

func getReplayBucketClient(ctx context.Context) (*replaybucket.Client, error) {
	_ = ctx
	replayBucketOnce.Do(func() {
		replayBucketClient, replayBucketErr = replaybucket.NewFromEnv(context.Background())
		if replayBucketErr != nil {
			replayBucketErr = fmt.Errorf("init replay bucket client: %w", replayBucketErr)
			log.Printf("replay bucket init failed: %v", replayBucketErr)
		}
	})
	return replayBucketClient, replayBucketErr
}

func getNotifyDB() (*sql.DB, error) {
	notifyDBOnce.Do(func() {
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
		notifyDB, notifyDBErr = sql.Open("postgres", dsn)
		if notifyDBErr != nil {
			notifyDBErr = fmt.Errorf("open notify db: %w", notifyDBErr)
			return
		}
		if pingErr := notifyDB.Ping(); pingErr != nil {
			notifyDBErr = fmt.Errorf("ping notify db: %w", pingErr)
		}
	})
	return notifyDB, notifyDBErr
}

func notifyReplayAnalysisQueued(ctx context.Context, gameID int) error {
	db, err := getNotifyDB()
	if err != nil {
		return err
	}
	_, err = db.ExecContext(ctx, `SELECT pg_notify('replay_analysis_jobs', $1)`, strconv.Itoa(gameID))
	if err != nil {
		return fmt.Errorf("pg_notify replay_analysis_jobs: %w", err)
	}
	return nil
}

func ensureReplayInBucket(ctx context.Context, parsed *parser.ParsedGame, replayData []byte) (string, error) {
	if parsed == nil {
		return "", errors.New("nil parsed replay")
	}
	if len(replayData) == 0 {
		return "", errors.New("empty replay payload")
	}
	client, err := getReplayBucketClient(ctx)
	if err != nil {
		return "", err
	}
	key, err := client.PutReplay(ctx, parsed.FileHash, replayData)
	if err != nil {
		return "", fmt.Errorf("upload replay object: %w", err)
	}
	return key, nil
}

func upsertGameAnalysisQueuedTx(ctx context.Context, tx *ent.Tx, gameID int, fileHash, bucketKey string) (bool, error) {
	if tx == nil {
		return false, errors.New("nil tx")
	}
	if gameID <= 0 {
		return false, fmt.Errorf("invalid game id: %d", gameID)
	}
	fileHash = strings.TrimSpace(fileHash)
	bucketKey = strings.TrimSpace(bucketKey)
	if fileHash == "" || bucketKey == "" {
		return false, errors.New("file hash and bucket key are required")
	}

	now := time.Now()
	analyzerVersion := replayanalysis.AnalyzerVersion()

	const q = `
INSERT INTO game_analyses (
  game_id,
  file_hash,
  bucket_key,
  analyzer_version,
  status,
  attempt_count,
  priority,
  requested_at,
  next_retry_at,
  quality_report_json,
  summary_json,
  analysis_phase_json,
  analysis_events_json,
  analysis_timeseries_json,
  artifact_result_dir,
  artifact_manifest_json,
  created_at,
  updated_at
)
VALUES (
  $1, $2, $3, $4, $5, 0, 0, $6, $6,
  '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, NULL, '{}'::jsonb, $6, $6
)
ON CONFLICT (game_id) DO UPDATE
SET file_hash = EXCLUDED.file_hash,
    bucket_key = EXCLUDED.bucket_key,
    analyzer_version = EXCLUDED.analyzer_version,
    status = EXCLUDED.status,
    attempt_count = 0,
    priority = EXCLUDED.priority,
    requested_at = EXCLUDED.requested_at,
    started_at = NULL,
    finished_at = NULL,
    next_retry_at = EXCLUDED.next_retry_at,
    last_error = NULL,
    quality_report_json = '{}'::jsonb,
    summary_json = '{}'::jsonb,
    analysis_phase_json = '{}'::jsonb,
    analysis_events_json = '{}'::jsonb,
    analysis_timeseries_json = '{}'::jsonb,
    artifact_result_dir = NULL,
    artifact_manifest_json = '{}'::jsonb,
    updated_at = EXCLUDED.updated_at
WHERE game_analyses.file_hash = EXCLUDED.file_hash
  AND game_analyses.analyzer_version <> EXCLUDED.analyzer_version
RETURNING id`

	rows, err := tx.QueryContext(
		ctx,
		q,
		gameID,
		fileHash,
		bucketKey,
		analyzerVersion,
		replayanalysis.StatusQueued,
		now,
	)
	if err != nil {
		return false, fmt.Errorf("upsert queued analysis row: %w", err)
	}
	defer rows.Close()

	var id int
	if rows.Next() {
		if err := rows.Scan(&id); err != nil {
			return false, fmt.Errorf("scan upsert queued analysis row: %w", err)
		}
		return true, nil
	}
	if err := rows.Err(); err != nil {
		return false, fmt.Errorf("iterate upsert queued analysis row: %w", err)
	}
	return false, nil
}

func previewPlayerNames(parsed *parser.ParsedGame) []string {
	names := make([]string, 0, len(parsed.Players))
	seen := make(map[string]struct{})
	for _, p := range parsed.Players {
		name := strings.TrimSpace(p.Name)
		if name == "" {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		names = append(names, name)
	}
	return names
}

func replayPreviewFromParsed(parsed *parser.ParsedGame) ReplayPreview {
	return ReplayPreview{
		Filename:      parsed.Filename,
		Host:          parsed.Host,
		StartTime:     parsed.StartTime.Format("2006-01-02T15:04:05Z07:00"),
		MapName:       parsed.MapName,
		PlayerCount:   parsed.PlayerCount,
		ParsedPlayers: previewPlayerNames(parsed),
	}
}

// addReplayFileToGame adds a replay file to an existing game and increments upload_count.
func addReplayFileToGame(ctx context.Context, existingGame *ent.Game, uploader *ent.User, parsed *parser.ParsedGame, replayData []byte) (*ent.Game, error) {
	tx, err := database.Client.Tx(ctx)
	if err != nil {
		return nil, err
	}
	analysisQueued := false
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	exists, err := tx.ReplayFile.Query().
		Where(
			replayfile.HasGameWith(game.IDEQ(existingGame.ID)),
			replayfile.HasUploaderWith(user.IDEQ(uploader.ID)),
		).
		Exist(ctx)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, errAlreadyUploadedByUser
	}

	// Create replay file (new uploader contribution)
	_, err = tx.ReplayFile.Create().
		SetFileHash(parsed.FileHash).
		SetFilename(parsed.Filename).
		SetGame(existingGame).
		SetUploader(uploader).
		Save(ctx)
	if err != nil {
		return nil, err
	}

	if len(replayData) > 0 {
		bucketKey, err := ensureReplayInBucket(ctx, parsed, replayData)
		if err != nil {
			return nil, err
		}
		queued, err := upsertGameAnalysisQueuedTx(ctx, tx, existingGame.ID, parsed.FileHash, bucketKey)
		if err != nil {
			return nil, err
		}
		analysisQueued = queued
		if !queued {
			log.Printf(
				"info: skip replay analysis enqueue game_id=%d file_hash=%s analyzer_version=%s",
				existingGame.ID,
				parsed.FileHash,
				replayanalysis.AnalyzerVersion(),
			)
		}
	}

	// Increment upload count
	updatedGame, err := tx.Game.UpdateOneID(existingGame.ID).
		AddUploadCount(1).
		Save(ctx)
	if err != nil {
		return nil, err
	}

	if err = tx.Commit(); err != nil {
		return nil, err
	}
	if len(replayData) > 0 && analysisQueued {
		if err := notifyReplayAnalysisQueued(ctx, existingGame.ID); err != nil {
			log.Printf("warn: notify replay analysis game_id=%d failed: %v", existingGame.ID, err)
		}
	}

	return updatedGame, nil
}

// createNewGame creates a new game with all related entities in a transaction.
func createNewGame(ctx context.Context, parsed *parser.ParsedGame, uploader *ent.User, options uploadOptions, replayData []byte) (*ent.Game, error) {
	tx, err := database.Client.Tx(ctx)
	if err != nil {
		return nil, err
	}
	analysisQueued := false
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	// Create game
	gameCreate := tx.Game.Create().
		SetHost(parsed.Host).
		SetStartTime(parsed.StartTime).
		SetMapName(parsed.MapName).
		SetMapWidth(parsed.MapWidth).
		SetMapHeight(parsed.MapHeight).
		SetGameLength(parsed.GameLength).
		SetGameType(parsed.GameType).
		SetGameSpeed(parsed.GameSpeed).
		SetTitle(parsed.Title).
		SetPlayerCount(parsed.PlayerCount).
		SetUploadCount(1).
		SetWinnerTeam(parsed.WinnerTeam)
	gameCreate.SetNillableSeasonLabel(options.SeasonLabel)
	gameCreate.SetNillableSeasonNo(options.SeasonNo)

	savedGame, err := gameCreate.Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create game: %w", err)
	}

	if err = ensureUsers(ctx, tx, parsed.Players); err != nil {
		return nil, fmt.Errorf("failed to ensure users: %w", err)
	}

	// Create players
	for _, p := range parsed.Players {
		_, err = tx.Player.Create().
			SetName(p.Name).
			SetRace(p.Race).
			SetTeam(p.Team).
			SetColor(p.Color).
			SetPlayerID(p.PlayerID).
			SetApm(p.APM).
			SetEapm(p.EAPM).
			SetCmdCount(p.CmdCount).
			SetEffectiveCmdCount(p.EffCmdCount).
			SetStartLocationX(p.StartX).
			SetStartLocationY(p.StartY).
			SetStartDirection(p.StartDirection).
			SetRedundancy(p.Redundancy).
			SetIsWinner(p.IsWinner).
			SetResult(p.Result).
			SetGame(savedGame).
			Save(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to create player %s: %w", p.Name, err)
		}
	}

	// Create replay file
	_, err = tx.ReplayFile.Create().
		SetFileHash(parsed.FileHash).
		SetFilename(parsed.Filename).
		SetGame(savedGame).
		SetUploader(uploader).
		Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create replay file: %w", err)
	}

	if len(replayData) > 0 {
		bucketKey, err := ensureReplayInBucket(ctx, parsed, replayData)
		if err != nil {
			return nil, fmt.Errorf("failed to upload replay to bucket: %w", err)
		}
		queued, err := upsertGameAnalysisQueuedTx(ctx, tx, savedGame.ID, parsed.FileHash, bucketKey)
		if err != nil {
			return nil, fmt.Errorf("failed to enqueue replay analysis: %w", err)
		}
		analysisQueued = queued
		if !queued {
			log.Printf(
				"info: skip replay analysis enqueue game_id=%d file_hash=%s analyzer_version=%s",
				savedGame.ID,
				parsed.FileHash,
				replayanalysis.AnalyzerVersion(),
			)
		}
	}

	// Create game detail
	if parsed.Detail != nil {
		detailCreate := tx.GameDetail.Create().
			SetGame(savedGame)

		if parsed.Detail.APMTimeline != nil {
			detailCreate.SetApmTimeline(parsed.Detail.APMTimeline)
		}
		if parsed.Detail.BuildOrders != nil {
			detailCreate.SetBuildOrders(parsed.Detail.BuildOrders)
		}
		if parsed.Detail.CompressedBuildOrders != nil {
			detailCreate.SetCompressedBuildOrders(parsed.Detail.CompressedBuildOrders)
		}
		if parsed.Detail.ChatMessages != nil {
			detailCreate.SetChatMessages(parsed.Detail.ChatMessages)
		}

		_, err = detailCreate.Save(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to create game detail: %w", err)
		}
	}

	if err = tx.Commit(); err != nil {
		return nil, err
	}
	if len(replayData) > 0 && analysisQueued {
		if err := notifyReplayAnalysisQueued(ctx, savedGame.ID); err != nil {
			log.Printf("warn: notify replay analysis game_id=%d failed: %v", savedGame.ID, err)
		}
	}

	// Re-query with edges for response
	return database.Client.Game.
		Query().
		Where(game.IDEQ(savedGame.ID)).
		WithPlayers().
		Only(ctx)
}

// ListGames returns all games with pagination.
func ListGames(c *fiber.Ctx) error {
	ctx := c.Context()

	limit := c.QueryInt("limit", 10)
	offset := c.QueryInt("offset", 0)
	userName := strings.TrimSpace(c.Query("user_name"))
	seasonLabel := strings.TrimSpace(c.Query("season_label"))
	includeTotal := c.QueryBool("include_total", true)
	exactUserName := c.QueryBool("exact_user_name", false)
	if limit > 100 {
		limit = 100
	}
	if limit <= 0 {
		limit = 10
	}
	if offset < 0 {
		offset = 0
	}

	gameQuery := database.Client.Game.Query()
	if userName != "" {
		if exactUserName {
			gameQuery = gameQuery.Where(game.HasPlayersWith(player.NameEQ(userName)))
		} else {
			gameQuery = gameQuery.Where(game.HasPlayersWith(player.NameEqualFold(userName)))
		}
	}
	if seasonLabel != "" {
		gameQuery = gameQuery.Where(game.SeasonLabelEQ(seasonLabel))
	}

	queryLimit := limit
	if !includeTotal {
		queryLimit = limit + 1
	}
	games, err := gameQuery.
		WithPlayers().
		Order(ent.Desc(game.FieldStartTime), ent.Desc(game.FieldCreatedAt)).
		Limit(queryLimit).
		Offset(offset).
		All(ctx)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to fetch games",
			"details": err.Error(),
		})
	}

	hasMore := false
	if !includeTotal && len(games) > limit {
		hasMore = true
		games = games[:limit]
	}
	total := windowedTotal(offset, len(games), hasMore)
	if includeTotal {
		totalQuery := database.Client.Game.Query()
		if userName != "" {
			if exactUserName {
				totalQuery = totalQuery.Where(game.HasPlayersWith(player.NameEQ(userName)))
			} else {
				totalQuery = totalQuery.Where(game.HasPlayersWith(player.NameEqualFold(userName)))
			}
		}
		if seasonLabel != "" {
			totalQuery = totalQuery.Where(game.SeasonLabelEQ(seasonLabel))
		}
		total, err = totalQuery.Count(ctx)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   "Failed to count games",
				"details": err.Error(),
			})
		}
		hasMore = offset+len(games) < total
	}

	analysisStatuses, err := buildAnalysisStatusMap(ctx, games)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to fetch analysis statuses",
			"details": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"games":                 games,
		"total":                 total,
		"limit":                 limit,
		"offset":                offset,
		"user_name":             userName,
		"season_label":          seasonLabel,
		"exact_user_name":       exactUserName,
		"has_more":              hasMore,
		"reliability_summaries": buildReliabilitySummaryMap(games),
		"analysis_statuses":     analysisStatuses,
	})
}

func windowedTotal(offset int, returnedGames int, hasMore bool) int {
	total := offset + returnedGames
	if hasMore {
		total++
	}
	return total
}

// ListReplayFileHashes returns a compact hash set for idempotent bulk upload tools.
func ListReplayFileHashes(c *fiber.Ctx) error {
	ctx := c.Context()

	files, err := database.Client.ReplayFile.
		Query().
		WithGame().
		All(ctx)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to fetch replay file hashes",
			"details": err.Error(),
		})
	}

	hashes := make([]string, 0, len(files))
	replayFiles := make([]fiber.Map, 0, len(files))
	for _, file := range files {
		hash := strings.TrimSpace(file.FileHash)
		if hash == "" {
			continue
		}
		hashes = append(hashes, hash)
		gameID := 0
		if file.Edges.Game != nil {
			gameID = file.Edges.Game.ID
		}
		replayFiles = append(replayFiles, fiber.Map{
			"file_hash": hash,
			"filename":  file.Filename,
			"game_id":   gameID,
		})
	}
	sort.Strings(hashes)

	return c.JSON(fiber.Map{
		"count":        len(hashes),
		"hashes":       hashes,
		"replay_files": replayFiles,
	})
}

// GetGame returns a single game by ID with players.
func GetGame(c *fiber.Ctx) error {
	ctx := c.Context()

	id, err := c.ParamsInt("id")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid game ID",
		})
	}

	g, err := database.Client.Game.
		Query().
		Where(game.IDEQ(id)).
		WithPlayers().
		WithReplayFiles().
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "Game not found",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to fetch game",
			"details": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"game":               buildGameResponseDTO(g),
		"reliability_m_of_n": reliabilityMofN(g.UploadCount, g.PlayerCount),
		"reliability":        reliabilityText(g.UploadCount, g.PlayerCount),
	})
}

// ListSeasons returns distinct seasons with lightweight records.
func ListSeasons(c *fiber.Ctx) error {
	ctx := c.Context()
	includeGames := c.QueryBool("include_games", false)
	current, err := getCurrentSeason(ctx)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to fetch current season",
			"details": err.Error(),
		})
	}

	query := database.Client.Game.Query().
		Where(game.SeasonLabelNotNil()).
		Order(ent.Asc(game.FieldSeasonNo), ent.Asc(game.FieldStartTime), ent.Asc(game.FieldCreatedAt))
	if includeGames {
		query = query.
			WithPlayers().
			WithReplayFiles().
			WithGameDetail().
			WithAnalysis()
	}

	games, err := query.All(ctx)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to fetch seasons",
			"details": err.Error(),
		})
	}
	if includeGames {
		if err := ensureSeasonAnalysisRows(ctx, games); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   "Failed to queue missing season analyses",
				"details": err.Error(),
			})
		}
	}

	summaries := buildSeasonSummaries(games, includeGames)
	return c.JSON(fiber.Map{
		"current": fiber.Map{
			"season_label": current.SeasonLabel,
			"season_no":    current.SeasonNo,
		},
		"seasons": summaries,
		"total":   len(summaries),
	})
}

func buildSeasonSummaries(games []*ent.Game, includeGames bool) []*seasonSummary {
	summaries := make([]*seasonSummary, 0)
	byLabel := make(map[string]*seasonSummary)
	for _, g := range games {
		if g.SeasonLabel == nil || strings.TrimSpace(*g.SeasonLabel) == "" {
			continue
		}
		label := strings.TrimSpace(*g.SeasonLabel)
		summary := byLabel[label]
		if summary == nil {
			summary = &seasonSummary{
				SeasonLabel: label,
				SeasonNo:    g.SeasonNo,
				WinsByTeam:  map[string]int{},
				GameIDs:     []int{},
			}
			if includeGames {
				summary.GamesData = []gameResponseDTO{}
			}
			byLabel[label] = summary
			summaries = append(summaries, summary)
		}
		summary.Games += 1
		summary.GameIDs = append(summary.GameIDs, g.ID)
		if includeGames {
			summary.GamesData = append(summary.GamesData, buildGameResponseDTO(g))
		}
		if g.WinnerTeam > 0 {
			summary.WinsByTeam[strconv.Itoa(int(g.WinnerTeam))] += 1
		}
	}
	return summaries
}

func ensureSeasonAnalysisRows(ctx context.Context, games []*ent.Game) error {
	for _, g := range games {
		if g == nil || g.Edges.Analysis != nil {
			continue
		}
		fileHash := latestReplayHash(g.Edges.ReplayFiles)
		if fileHash == "" {
			continue
		}
		queued, err := insertQueuedAnalysisRow(ctx, g.ID, fileHash)
		if err != nil {
			return err
		}
		if !queued {
			continue
		}
		g.Edges.Analysis = &ent.GameAnalysis{
			GameID:          g.ID,
			FileHash:        fileHash,
			BucketKey:       replaybucket.ReplayObjectKey(fileHash),
			AnalyzerVersion: replayanalysis.AnalyzerVersion(),
			Status:          replayanalysis.StatusQueued,
		}
		if err := notifyReplayAnalysisQueued(ctx, g.ID); err != nil {
			log.Printf("warn: notify season replay analysis game_id=%d failed: %v", g.ID, err)
		}
	}
	return nil
}

func latestReplayHash(files []*ent.ReplayFile) string {
	if len(files) == 0 {
		return ""
	}
	sort.SliceStable(files, func(i, j int) bool {
		return files[i].CreatedAt.After(files[j].CreatedAt)
	})
	return strings.TrimSpace(files[0].FileHash)
}

func insertQueuedAnalysisRow(ctx context.Context, gameID int, fileHash string) (bool, error) {
	db, err := getNotifyDB()
	if err != nil {
		return false, err
	}
	now := time.Now()
	const q = `
INSERT INTO game_analyses (
  game_id,
  file_hash,
  bucket_key,
  analyzer_version,
  status,
  attempt_count,
  priority,
  requested_at,
  next_retry_at,
  quality_report_json,
  summary_json,
  analysis_phase_json,
  analysis_events_json,
  analysis_timeseries_json,
  artifact_manifest_json,
  created_at,
  updated_at
)
VALUES ($1, $2, $3, $4, $5, 0, 0, $6, $6, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, $6, $6)
ON CONFLICT (game_id) DO NOTHING
RETURNING id`
	var id int
	err = db.QueryRowContext(ctx, q, gameID, fileHash, replaybucket.ReplayObjectKey(fileHash), replayanalysis.AnalyzerVersion(), replayanalysis.StatusQueued, now).Scan(&id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// SetCurrentSeason sets the default season applied to future uploads.
func SetCurrentSeason(c *fiber.Ctx) error {
	var req seasonRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "invalid season request",
			"details": err.Error(),
		})
	}
	current, err := setCurrentSeason(c.Context(), req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "failed to set current season",
			"details": err.Error(),
		})
	}
	return c.JSON(fiber.Map{
		"message":      "current season updated",
		"season_label": current.SeasonLabel,
		"season_no":    current.SeasonNo,
	})
}

// SetGameSeason updates one existing game's season metadata.
func SetGameSeason(c *fiber.Ctx) error {
	ctx := c.Context()
	id, err := c.ParamsInt("id")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid game ID",
		})
	}
	var req seasonRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "invalid season request",
			"details": err.Error(),
		})
	}
	label := strings.TrimSpace(req.SeasonLabel)
	if label == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "season_label is required",
		})
	}
	if req.SeasonNo == nil {
		req.SeasonNo = inferSeasonNo(label)
	}
	g, err := database.Client.Game.UpdateOneID(id).
		SetSeasonLabel(label).
		SetNillableSeasonNo(req.SeasonNo).
		Save(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "Game not found",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to update game season",
			"details": err.Error(),
		})
	}
	return c.JSON(fiber.Map{
		"message": "game season updated",
		"game":    buildGameResponseDTO(g),
	})
}

// GetGameDetail returns the detailed visualization data for a game.
func GetGameDetail(c *fiber.Ctx) error {
	ctx := c.Context()

	id, err := c.ParamsInt("id")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid game ID",
		})
	}

	g, err := database.Client.Game.
		Query().
		Where(game.IDEQ(id)).
		WithGameDetail().
		WithPlayers().
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "Game not found",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to fetch game detail",
			"details": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"game":                     buildGameResponseDTO(g),
		"detail":                   g.Edges.GameDetail,
		"analysis_status":          buildAnalysisStatus(g.Edges.GameDetail),
		"tech_tree":                buildTechTreeDTO(g, g.Edges.GameDetail),
		"unit_production":          buildUnitProductionDTO(g.Edges.GameDetail, g.Edges.Players),
		"unit_production_versions": buildUnitProductionVersionsDTO(g.Edges.GameDetail, g.Edges.Players),
		"resource_spend":           buildResourceSpendDTO(g.Edges.GameDetail, g.Edges.Players),
	})
}

// GetGameAnalyzer returns replay_analyzer job status and, when ready, summarized outputs.
func GetGameAnalyzer(c *fiber.Ctx) error {
	ctx := c.Context()
	id, err := c.ParamsInt("id")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid game ID",
		})
	}

	exists, err := database.Client.Game.Query().Where(game.IDEQ(id)).Exist(ctx)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to query game",
			"details": err.Error(),
		})
	}
	if !exists {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Game not found",
		})
	}

	row, err := database.Client.GameAnalysis.Query().
		Where(gameanalysis.GameIDEQ(id)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return c.JSON(fiber.Map{
				"game_id":           id,
				"status":            replayanalysis.StatusNotRequested,
				"progress_message":  "analysis not requested for this game",
				"attempt_count":     0,
				"last_error":        "",
				"result":            nil,
				"next_refresh_hint": "manual_refresh",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to fetch analyzer status",
			"details": err.Error(),
		})
	}

	status := replayanalysis.NormalizeStatus(row.Status)
	message := "analysis status is available"
	switch status {
	case replayanalysis.StatusQueued:
		message = "analysis is queued"
	case replayanalysis.StatusRunning:
		message = "analysis is running"
	case replayanalysis.StatusSucceeded:
		message = "analysis completed"
	case replayanalysis.StatusFailed:
		message = "analysis failed"
	}

	result := fiber.Map(nil)
	if status == replayanalysis.StatusSucceeded {
		result = fiber.Map{
			"quality_report":    row.QualityReportJSON,
			"summary":           row.SummaryJSON,
			"analysis_phase":    row.AnalysisPhaseJSON,
			"match_flow":        row.AnalysisEventsJSON,
			"player_timeseries": row.AnalysisTimeseriesJSON,
		}
	}

	artifacts := fiber.Map{
		"result_dir": stringPtr(row.ArtifactResultDir),
		"manifest":   row.ArtifactManifestJSON,
	}

	return c.JSON(fiber.Map{
		"game_id":           id,
		"analyzer_version":  row.AnalyzerVersion,
		"status":            status,
		"progress_message":  message,
		"attempt_count":     row.AttemptCount,
		"last_error":        strings.TrimSpace(stringPtr(row.LastError)),
		"requested_at":      row.RequestedAt,
		"started_at":        row.StartedAt,
		"finished_at":       row.FinishedAt,
		"updated_at":        row.UpdatedAt,
		"next_retry_at":     row.NextRetryAt,
		"result":            result,
		"artifacts":         artifacts,
		"next_refresh_hint": "manual_refresh",
	})
}

func buildAnalysisStatus(detail *ent.GameDetail) fiber.Map {
	if detail == nil {
		return fiber.Map{
			"status":                "missing",
			"recomputable":          false,
			"recommended_action":    "reupload_replay",
			"user_message":          "구버전 분석 데이터입니다. replay 재업로드가 필요합니다.",
			"has_build_orders":      false,
			"has_compressed_orders": false,
		}
	}

	rawOrders := detail.BuildOrders
	compressedOrders := detail.CompressedBuildOrders
	hasRaw := len(rawOrders) > 0
	hasCompressed := len(compressedOrders) > 0

	totalEvents := 0
	typedEvents := 0
	for _, bo := range rawOrders {
		for _, ev := range bo.Events {
			totalEvents++
			if strings.TrimSpace(ev.EventType) != "" {
				typedEvents++
			}
		}
	}

	eventTypeCoverage := 0.0
	if totalEvents > 0 {
		eventTypeCoverage = (float64(typedEvents) / float64(totalEvents)) * 100
	}

	rawBytes := estimateJSONBytes(rawOrders)
	compressedBytes := estimateJSONBytes(compressedOrders)
	chatBytes := estimateJSONBytes(detail.ChatMessages)
	totalBytes := rawBytes + compressedBytes + chatBytes

	storageTier := "small"
	switch {
	case totalBytes >= 2*1024*1024:
		storageTier = "large"
	case totalBytes >= 512*1024:
		storageTier = "medium"
	}

	status := "ready"
	recommended := "none"
	message := "최신 분석 데이터입니다."
	switch {
	case !hasRaw:
		status = "missing"
		recommended = "reupload_replay"
		message = "구버전 분석 데이터입니다. replay 재업로드를 권장합니다."
	case !hasCompressed:
		status = "partial"
		recommended = "reupload_replay_recommended"
		message = "일부 분석 데이터가 누락되었습니다. replay 재업로드를 권장합니다."
	case eventTypeCoverage < 90:
		status = "stale"
		recommended = "reupload_replay_recommended"
		message = "구형 이벤트 메타가 포함되어 정확도가 낮을 수 있습니다. replay 재업로드를 권장합니다."
	}

	return fiber.Map{
		"status":                status,
		"recomputable":          hasRaw,
		"recommended_action":    recommended,
		"user_message":          message,
		"has_build_orders":      hasRaw,
		"has_compressed_orders": hasCompressed,
		"raw_event_count":       totalEvents,
		"typed_event_coverage":  math.Round(eventTypeCoverage*10) / 10,
		"estimated_size_bytes":  totalBytes,
		"estimated_size_tier":   storageTier,
	}
}

func estimateJSONBytes(v interface{}) int {
	b, err := json.Marshal(v)
	if err != nil {
		return 0
	}
	return len(b)
}

// DeleteGame deletes a game and all related entities (cascade).
func DeleteGame(c *fiber.Ctx) error {
	ctx := c.Context()

	id, err := c.ParamsInt("id")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid game ID",
		})
	}

	tx, err := database.Client.Tx(ctx)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to start transaction",
			"details": err.Error(),
		})
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	g, err := tx.Game.Query().Where(game.IDEQ(id)).WithGameDetail().Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "Game not found",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to find game",
			"details": err.Error(),
		})
	}

	// Delete related entities
	if _, err = tx.Player.Delete().Where(player.HasGameWith(game.IDEQ(id))).Exec(ctx); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to delete players",
			"details": err.Error(),
		})
	}
	if _, err = tx.ReplayFile.Delete().Where(replayfile.HasGameWith(game.IDEQ(id))).Exec(ctx); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to delete replay files",
			"details": err.Error(),
		})
	}
	if _, err = tx.GameAnalysis.Delete().Where(gameanalysis.GameIDEQ(id)).Exec(ctx); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to delete game analysis",
			"details": err.Error(),
		})
	}
	detail := g.Edges.GameDetail
	if detail != nil {
		if err = tx.GameDetail.DeleteOneID(detail.ID).Exec(ctx); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   "Failed to delete game detail",
				"details": err.Error(),
			})
		}
	}
	if err = tx.Game.DeleteOneID(id).Exec(ctx); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to delete game",
			"details": err.Error(),
		})
	}

	err = tx.Commit()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to commit transaction",
			"details": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Game deleted successfully",
	})
}

func getOrCreateUser(ctx context.Context, uploaderName string) (*ent.User, error) {
	name := strings.TrimSpace(uploaderName)
	u, err := database.Client.User.Query().Where(user.NameEQ(name)).Only(ctx)
	if err == nil {
		return u, nil
	}
	if !ent.IsNotFound(err) {
		return nil, err
	}
	return database.Client.User.Create().SetName(name).Save(ctx)
}

func ensureUsers(ctx context.Context, tx *ent.Tx, players []parser.ParsedPlayer) error {
	for _, p := range players {
		name := strings.TrimSpace(p.Name)
		if name == "" {
			continue
		}
		exists, err := tx.User.Query().Where(user.NameEQ(name)).Exist(ctx)
		if err != nil {
			return err
		}
		if exists {
			continue
		}
		if _, err = tx.User.Create().SetName(name).Save(ctx); err != nil {
			return err
		}
	}
	return nil
}

func isInvalidShortGameLength(seconds int) bool {
	return seconds > 0 && seconds <= invalidGameMaxDurationSeconds
}

func normalizeParsedOutcomeForShortGame(parsed *parser.ParsedGame) {
	if parsed == nil || !isInvalidShortGameLength(parsed.GameLength) {
		return
	}
	parsed.WinnerTeam = 0
	for i := range parsed.Players {
		parsed.Players[i].IsWinner = false
		parsed.Players[i].Result = "draw"
	}
}

func isUploaderInParsedPlayers(players []parser.ParsedPlayer, uploaderName string) bool {
	name := strings.TrimSpace(uploaderName)
	for _, p := range players {
		if strings.EqualFold(strings.TrimSpace(p.Name), name) {
			return true
		}
	}
	return false
}

func isUploaderParticipant(players []*ent.Player, uploaderName string) bool {
	name := strings.TrimSpace(uploaderName)
	for _, p := range players {
		if strings.EqualFold(strings.TrimSpace(p.Name), name) {
			return true
		}
	}
	return false
}

func stringPtr(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

func stringFromAny(v interface{}) string {
	if s, ok := v.(string); ok {
		return strings.TrimSpace(s)
	}
	return ""
}

func numberFromAny(v interface{}) float64 {
	switch n := v.(type) {
	case float64:
		return n
	case float32:
		return float64(n)
	case int:
		return float64(n)
	case int64:
		return float64(n)
	case json.Number:
		value, _ := n.Float64()
		return value
	default:
		return 0
	}
}

func reliabilityText(uploadCount, playerCount int) string {
	if playerCount <= 0 {
		return "0%"
	}
	value := float64(uploadCount) / float64(playerCount) * 100
	if value > 100 {
		value = 100
	}
	return fmt.Sprintf("%.0f%%", value)
}

func reliabilityMofN(uploadCount, playerCount int) string {
	if playerCount < 0 {
		playerCount = 0
	}
	if uploadCount < 0 {
		uploadCount = 0
	}
	return fmt.Sprintf("%d/%d", uploadCount, playerCount)
}

func buildReliabilitySummaryMap(games []*ent.Game) map[int]fiber.Map {
	summary := make(map[int]fiber.Map, len(games))
	for _, g := range games {
		summary[g.ID] = fiber.Map{
			"m_of_n":       reliabilityMofN(g.UploadCount, g.PlayerCount),
			"upload_count": g.UploadCount,
			"player_count": g.PlayerCount,
			"reliability":  reliabilityText(g.UploadCount, g.PlayerCount),
		}
	}
	return summary
}

func buildAnalysisStatusMap(ctx context.Context, games []*ent.Game) (map[int]string, error) {
	out := make(map[int]string, len(games))
	if len(games) == 0 {
		return out, nil
	}
	ids := make([]int, 0, len(games))
	for _, g := range games {
		if g == nil {
			continue
		}
		ids = append(ids, g.ID)
		out[g.ID] = replayanalysis.StatusNotRequested
	}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := database.Client.GameAnalysis.Query().
		Where(gameanalysis.GameIDIn(ids...)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		out[row.GameID] = replayanalysis.NormalizeStatus(row.Status)
	}
	return out, nil
}

// GetPlayerStats returns statistics for a specific player.
func GetPlayerStats(c *fiber.Ctx) error {
	ctx := c.Context()
	playerName := c.Params("name")

	if playerName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Player name is required",
		})
	}

	// Get all player records with game data
	playerRecords, err := database.Client.Player.
		Query().
		Where(
			player.NameEQ(playerName),
			player.HasGameWith(game.GameLengthGT(invalidGameMaxDurationSeconds)),
		).
		WithGame().
		All(ctx)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to fetch player data",
			"details": err.Error(),
		})
	}

	if len(playerRecords) == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "No games found for this player",
		})
	}

	totalGames := len(playerRecords)
	wins := 0
	losses := 0
	draws := 0
	var totalAPM, totalEAPM int64
	raceCount := make(map[string]int)

	// Race stats: race → {wins, total}
	type raceRecord struct {
		Wins, Losses, Total int
	}
	raceStats := make(map[string]*raceRecord)

	// Matchup stats: opponent_race → {wins, total}
	matchupStats := make(map[string]*raceRecord)

	// Map stats: map_name → {wins, total}
	mapStats := make(map[string]*raceRecord)

	gameIDs := make([]int, 0, len(playerRecords))
	seenGameIDs := make(map[int]struct{}, len(playerRecords))
	for _, pr := range playerRecords {
		if pr.Edges.Game == nil {
			continue
		}
		gid := pr.Edges.Game.ID
		if _, ok := seenGameIDs[gid]; ok {
			continue
		}
		seenGameIDs[gid] = struct{}{}
		gameIDs = append(gameIDs, gid)
	}

	playersByGame := make(map[int][]*ent.Player, len(gameIDs))
	if len(gameIDs) > 0 {
		playersInGames, err := database.Client.Player.
			Query().
			Where(player.HasGameWith(
				game.IDIn(gameIDs...),
				game.GameLengthGT(invalidGameMaxDurationSeconds),
			)).
			WithGame().
			All(ctx)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   "Failed to fetch opponent data",
				"details": err.Error(),
			})
		}
		for _, gp := range playersInGames {
			if gp.Edges.Game == nil {
				continue
			}
			gid := gp.Edges.Game.ID
			playersByGame[gid] = append(playersByGame[gid], gp)
		}
	}

	for _, pr := range playerRecords {
		switch pr.Result {
		case "win":
			wins++
		case "loss":
			losses++
		case "draw":
			draws++
		}

		totalAPM += int64(pr.Apm)
		totalEAPM += int64(pr.Eapm)
		raceCount[pr.Race]++

		// Race stats
		if _, ok := raceStats[pr.Race]; !ok {
			raceStats[pr.Race] = &raceRecord{}
		}
		raceStats[pr.Race].Total++
		if pr.Result == "win" {
			raceStats[pr.Race].Wins++
		} else if pr.Result == "loss" {
			raceStats[pr.Race].Losses++
		}

		// Matchup stats — find opponents in the same game
		if pr.Edges.Game != nil {
			g := pr.Edges.Game
			mapName := g.MapName

			// Map stats
			if mapName != "" {
				if _, ok := mapStats[mapName]; !ok {
					mapStats[mapName] = &raceRecord{}
				}
				mapStats[mapName].Total++
				if pr.Result == "win" {
					mapStats[mapName].Wins++
				} else if pr.Result == "loss" {
					mapStats[mapName].Losses++
				}
			}

			// Get opponents from same game (preloaded once for all games).
			for _, opp := range playersByGame[g.ID] {
				if opp.Team == pr.Team {
					continue
				}
				oppRace := opp.Race
				key := fmt.Sprintf("vs %s", oppRace)
				if _, ok := matchupStats[key]; !ok {
					matchupStats[key] = &raceRecord{}
				}
				matchupStats[key].Total++
				if pr.Result == "win" {
					matchupStats[key].Wins++
				} else if pr.Result == "loss" {
					matchupStats[key].Losses++
				}
			}
		}
	}

	// Find favorite race
	favoriteRace := ""
	maxCount := 0
	for race, count := range raceCount {
		if count > maxCount {
			maxCount = count
			favoriteRace = race
		}
	}

	winRate := float64(wins) / float64(totalGames) * 100
	avgAPM := float64(totalAPM) / float64(totalGames)
	avgEAPM := float64(totalEAPM) / float64(totalGames)

	// Build race stats response
	raceStatsResp := make(map[string]fiber.Map)
	for race, rs := range raceStats {
		wr := 0.0
		if rs.Total > 0 {
			wr = math.Round(float64(rs.Wins)/float64(rs.Total)*1000) / 10
		}
		raceStatsResp[race] = fiber.Map{
			"wins":     rs.Wins,
			"losses":   rs.Losses,
			"total":    rs.Total,
			"win_rate": wr,
		}
	}

	// Build matchup stats response
	matchupStatsResp := make(map[string]fiber.Map)
	for matchup, ms := range matchupStats {
		wr := 0.0
		if ms.Total > 0 {
			wr = math.Round(float64(ms.Wins)/float64(ms.Total)*1000) / 10
		}
		matchupStatsResp[matchup] = fiber.Map{
			"wins":     ms.Wins,
			"losses":   ms.Losses,
			"total":    ms.Total,
			"win_rate": wr,
		}
	}

	// Build map stats response
	mapStatsResp := make(map[string]fiber.Map)
	for mapName, ms := range mapStats {
		wr := 0.0
		if ms.Total > 0 {
			wr = math.Round(float64(ms.Wins)/float64(ms.Total)*1000) / 10
		}
		mapStatsResp[mapName] = fiber.Map{
			"wins":     ms.Wins,
			"losses":   ms.Losses,
			"total":    ms.Total,
			"win_rate": wr,
		}
	}

	return c.JSON(fiber.Map{
		"player_name":   playerName,
		"total_games":   totalGames,
		"wins":          wins,
		"losses":        losses,
		"draws":         draws,
		"win_rate":      math.Round(winRate*10) / 10,
		"average_apm":   math.Round(avgAPM*10) / 10,
		"average_eapm":  math.Round(avgEAPM*10) / 10,
		"favorite_race": favoriteRace,
		"race_stats":    raceStatsResp,
		"matchup_stats": matchupStatsResp,
		"map_stats":     mapStatsResp,
	})
}

// GetUserSuggestions returns up to 5 user name suggestions for autocomplete.
func GetUserSuggestions(c *fiber.Ctx) error {
	ctx := c.Context()
	query := strings.TrimSpace(c.Query("q"))
	limit := c.QueryInt("limit", 5)
	if limit <= 0 {
		limit = 5
	}
	if limit > 5 {
		limit = 5
	}

	q := database.Client.User.Query().
		Order(ent.Desc(user.FieldTotalGames), ent.Asc(user.FieldName))
	if query != "" {
		// Start-with filtering is applied in Go to keep case-insensitive behavior.
		q = q.Where(user.NameContainsFold(query)).Limit(100)
	} else {
		q = q.Limit(limit)
	}

	users, err := q.All(ctx)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to fetch user suggestions",
			"details": err.Error(),
		})
	}

	names := make([]string, 0, limit)
	queryLower := strings.ToLower(query)
	for _, u := range users {
		if queryLower != "" && !strings.HasPrefix(strings.ToLower(u.Name), queryLower) {
			continue
		}
		names = append(names, u.Name)
		if len(names) >= limit {
			break
		}
	}

	return c.JSON(fiber.Map{
		"q":     query,
		"limit": limit,
		"users": names,
	})
}

// GetThreeVsThreeRankings returns user rankings computed from strict 3v3 games.
// Sort order: win_rate DESC, wins DESC, games DESC, name ASC.
func GetThreeVsThreeRankings(c *fiber.Ctx) error {
	ctx := c.Context()

	page := c.QueryInt("page", 1)
	pageSize := c.QueryInt("page_size", ranking.DefaultPageSize)
	legacyLimit := c.QueryInt("limit", 0)
	if legacyLimit > 0 {
		pageSize = legacyLimit
		page = 1
	}
	minGames := c.QueryInt("min_games", 0)
	sortBy := c.Query("sort_by", "win_rate")
	sortDir := c.Query("sort_dir", "desc")

	result, err := ranking.List3v3Snapshot(ctx, database.Client, ranking.ListOptions{
		Page:     page,
		PageSize: pageSize,
		MinGames: minGames,
		Sort: ranking.SortOptions{
			SortBy:  sortBy,
			SortDir: sortDir,
		},
	})
	if err != nil {
		if ranking.IsPQUndefinedTable(err) {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "ranking snapshot table is not ready; run ranking job first",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to fetch ranking snapshot",
			"details": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"mode":          "3v3",
		"sort":          result.AppliedSort,
		"min_games":     result.AppliedMinGames,
		"total":         result.TotalCount,
		"total_pages":   result.TotalPages,
		"page":          result.Page,
		"page_size":     result.PageSize,
		"total_rankers": result.TotalCount,
		"rankings":      result.Items,
		"items":         result.Items,
	})
}

// GetRaceMatchupAnalyzer returns race-composition matchup win rates.
// Example matchup key: "PTZ vs ZZZ"
func GetRaceMatchupAnalyzer(c *fiber.Ctx) error {
	ctx := c.Context()
	result, err := analyzer.ListSnapshot(ctx, database.Client, analyzer.ListOptions{
		TeamSize: c.QueryInt("team_size", 0),
		Page:     c.QueryInt("page", 1),
		PageSize: c.QueryInt("page_size", analyzer.DefaultAnalyzerPageSize),
		Limit:    c.QueryInt("limit", 0), // backward compatibility
		Sort: analyzer.SortOptions{
			SortBy:  c.Query("sort_by", "games"),
			SortDir: c.Query("sort_dir", "desc"),
		},
	})
	if err != nil {
		if analyzer.IsPQUndefinedTable(err) {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "analyzer snapshot table is not ready; run analyzer job first",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to fetch analyzer snapshot",
			"details": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"mode":            "race_composition_matchup",
		"team_size":       result.TeamSize,
		"qualified_games": result.QualifiedGames,
		"total_rows":      result.TotalCount,
		"total":           result.TotalCount,
		"total_pages":     result.TotalPages,
		"page":            result.Page,
		"page_size":       result.PageSize,
		"sort":            result.AppliedSort,
		"rows":            result.Items,
		"items":           result.Items,
	})
}
