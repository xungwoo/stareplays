package handlers

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"mime/multipart"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/xungwoo/stareps/ent"
	"github.com/xungwoo/stareps/ent/game"
	"github.com/xungwoo/stareps/ent/player"
	"github.com/xungwoo/stareps/ent/replayfile"
	"github.com/xungwoo/stareps/ent/user"
	"github.com/xungwoo/stareps/internal/database"
	"github.com/xungwoo/stareps/internal/parser"
)

var errAlreadyUploadedByUser = errors.New("this user already uploaded a replay for the game")

const (
	defaultReplayUploadDir       = "/tmp/stareps/uploads"
	defaultReplayMaxSizeMB       = 30
	bytesPerMB             int64 = 1024 * 1024
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

	return processParsedReplay(c, parsed, req.UploaderName)
}

// ParseUploadedReplay parses an uploaded replay file (multipart/form-data) and saves it.
func ParseUploadedReplay(c *fiber.Ctx) error {
	uploaderName := strings.TrimSpace(c.FormValue("uploader_name"))
	if uploaderName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "uploader_name is required",
		})
	}

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

	// Backward compatibility: single upload keeps original response shape.
	if len(files) == 1 {
		parsed, err := parseUploadedFile(files[0])
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error":   "Failed to parse replay file",
				"details": err.Error(),
			})
		}
		return processParsedReplay(c, parsed, uploaderName)
	}

	results := make([]fiber.Map, 0, len(files))
	successCount := 0
	failedCount := 0

	for _, fh := range files {
		parsed, err := parseUploadedFile(fh)
		if err != nil {
			failedCount++
			results = append(results, fiber.Map{
				"filename": fh.Filename,
				"ok":       false,
				"status":   fiber.StatusBadRequest,
				"error":    err.Error(),
			})
			continue
		}

		status, payload := processParsedReplayResult(c.Context(), parsed, uploaderName)
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

	for _, fh := range files {
		parsed, parseErr := parseUploadedFile(fh)
		if parseErr != nil {
			failedCount++
			results = append(results, fiber.Map{
				"filename": fh.Filename,
				"ok":       false,
				"status":   fiber.StatusBadRequest,
				"error":    parseErr.Error(),
			})
			continue
		}

		successCount++
		candidates := previewPlayerNames(parsed)
		for _, name := range candidates {
			candidateSet[name] = struct{}{}
		}
		results = append(results, fiber.Map{
			"filename": fh.Filename,
			"ok":       true,
			"status":   fiber.StatusOK,
			"preview":  replayPreviewFromParsed(parsed),
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

func processParsedReplay(c *fiber.Ctx, parsed *parser.ParsedGame, uploaderName string) error {
	status, payload := processParsedReplayResult(c.Context(), parsed, uploaderName)
	return c.Status(status).JSON(payload)
}

func processParsedReplayResult(ctx context.Context, parsed *parser.ParsedGame, uploaderName string) (int, fiber.Map) {
	if strings.TrimSpace(uploaderName) == "" {
		return fiber.StatusBadRequest, fiber.Map{
			"error": "uploader_name is required",
		}
	}

	uploader, err := getOrCreateUser(ctx, uploaderName)
	if err != nil {
		return fiber.StatusInternalServerError, fiber.Map{
			"error":   "Failed to resolve uploader",
			"details": err.Error(),
		}
	}

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

		if !isUploaderParticipant(hashGame.Edges.Players, uploaderName) {
			return fiber.StatusBadRequest, fiber.Map{
				"error": "uploader must be one of non-observer players in this game",
			}
		}

		savedGame, err := addReplayFileToGame(ctx, hashGame, uploader, parsed)
		if err != nil {
			if errors.Is(err, errAlreadyUploadedByUser) {
				return fiber.StatusConflict, fiber.Map{
					"error": "This user already uploaded a replay for this game",
				}
			}
			return fiber.StatusInternalServerError, fiber.Map{
				"error":   "Failed to add replay file",
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
		if !isUploaderParticipant(existingGame.Edges.Players, uploaderName) {
			return fiber.StatusBadRequest, fiber.Map{
				"error": "uploader must be one of non-observer players in this game",
			}
		}

		// Same game exists — add replay file and increment upload count
		savedGame, err := addReplayFileToGame(ctx, existingGame, uploader, parsed)
		if err != nil {
			if errors.Is(err, errAlreadyUploadedByUser) {
				return fiber.StatusConflict, fiber.Map{
					"error": "This user already uploaded a replay for this game",
				}
			}
			return fiber.StatusInternalServerError, fiber.Map{
				"error":   "Failed to add replay file",
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

	if !isUploaderInParsedPlayers(parsed.Players, uploaderName) {
		return fiber.StatusBadRequest, fiber.Map{
			"error": "uploader must be one of non-observer players in this replay",
		}
	}

	// New game — create everything in a transaction
	savedGame, err := createNewGame(ctx, parsed, uploader)
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

func collectReplayFiles(form *multipart.Form) []*multipart.FileHeader {
	if form == nil || form.File == nil {
		return nil
	}
	var files []*multipart.FileHeader
	files = append(files, form.File["replay_files"]...)
	files = append(files, form.File["replay_file"]...)
	return files
}

func parseUploadedFile(fileHeader *multipart.FileHeader) (*parser.ParsedGame, error) {
	if err := validateReplayUpload(fileHeader); err != nil {
		return nil, err
	}

	uploadDir := replayUploadDir()
	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		return nil, fmt.Errorf("failed to prepare upload temp directory: %w", err)
	}

	tempFile, err := os.CreateTemp(uploadDir, "replay-*.rep")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp replay file: %w", err)
	}
	tempPath := tempFile.Name()
	defer func() { _ = os.Remove(tempPath) }()

	f, err := fileHeader.Open()
	if err != nil {
		return nil, fmt.Errorf("failed to open uploaded file: %w", err)
	}
	defer f.Close()

	if _, err := io.Copy(tempFile, f); err != nil {
		_ = tempFile.Close()
		return nil, fmt.Errorf("failed to write temp replay file: %w", err)
	}
	if err := tempFile.Close(); err != nil {
		return nil, fmt.Errorf("failed to close temp replay file: %w", err)
	}

	parsed, err := parser.ParseReplayFile(tempPath)
	if err != nil {
		return nil, fmt.Errorf("failed to parse replay file: %w", err)
	}
	parsed.Filename = fileHeader.Filename
	return parsed, nil
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
func addReplayFileToGame(ctx context.Context, existingGame *ent.Game, uploader *ent.User, parsed *parser.ParsedGame) (*ent.Game, error) {
	tx, err := database.Client.Tx(ctx)
	if err != nil {
		return nil, err
	}
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

	return updatedGame, nil
}

// createNewGame creates a new game with all related entities in a transaction.
func createNewGame(ctx context.Context, parsed *parser.ParsedGame, uploader *ent.User) (*ent.Game, error) {
	tx, err := database.Client.Tx(ctx)
	if err != nil {
		return nil, err
	}
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
		gameQuery = gameQuery.Where(game.HasPlayersWith(player.NameEqualFold(userName)))
	}

	games, err := gameQuery.
		WithPlayers().
		Order(ent.Desc(game.FieldStartTime), ent.Desc(game.FieldCreatedAt)).
		Limit(limit).
		Offset(offset).
		All(ctx)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to fetch games",
			"details": err.Error(),
		})
	}

	totalQuery := database.Client.Game.Query()
	if userName != "" {
		totalQuery = totalQuery.Where(game.HasPlayersWith(player.NameEqualFold(userName)))
	}
	total, err := totalQuery.Count(ctx)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to count games",
			"details": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"games":                 games,
		"total":                 total,
		"limit":                 limit,
		"offset":                offset,
		"user_name":             userName,
		"reliability_summaries": buildReliabilitySummaryMap(games),
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
		"game":               g,
		"reliability_m_of_n": reliabilityMofN(g.UploadCount, g.PlayerCount),
		"reliability":        reliabilityText(g.UploadCount, g.PlayerCount),
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
		"game":   g,
		"detail": g.Edges.GameDetail,
	})
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
		Where(player.NameEQ(playerName)).
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

			// Get opponents from same game
			opponents, _ := database.Client.Player.
				Query().
				Where(
					player.HasGameWith(game.IDEQ(g.ID)),
					player.TeamNEQ(pr.Team),
				).
				All(ctx)

			for _, opp := range opponents {
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
	limit := c.QueryInt("limit", 100)
	if limit <= 0 {
		limit = 100
	}
	if limit > 200 {
		limit = 200
	}

	games, err := database.Client.Game.
		Query().
		Where(game.PlayerCountEQ(6)).
		WithPlayers().
		All(ctx)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to fetch ranking games",
			"details": err.Error(),
		})
	}

	type rankAgg struct {
		Name    string
		Games   int
		Wins    int
		Losses  int
		Draws   int
		SumAPM  float64
		SumEAPM float64
	}
	aggByName := make(map[string]*rankAgg)
	qualifyingGames := 0

	for _, g := range games {
		if !isStrictThreeVsThree(g.Edges.Players) {
			continue
		}
		qualifyingGames++

		for _, p := range g.Edges.Players {
			name := strings.TrimSpace(p.Name)
			if name == "" {
				continue
			}
			key := strings.ToLower(name)
			a, ok := aggByName[key]
			if !ok {
				a = &rankAgg{Name: name}
				aggByName[key] = a
			}

			a.Games++
			result := strings.ToLower(strings.TrimSpace(p.Result))
			switch result {
			case "win":
				a.Wins++
			case "loss":
				a.Losses++
			case "draw":
				a.Draws++
			default:
				if p.IsWinner {
					a.Wins++
				} else if g.WinnerTeam > 0 {
					a.Losses++
				}
			}
			a.SumAPM += float64(p.Apm)
			a.SumEAPM += float64(p.Eapm)
		}
	}

	type rankingEntry struct {
		Rank    int     `json:"rank"`
		Name    string  `json:"name"`
		Games   int     `json:"games"`
		Wins    int     `json:"wins"`
		Losses  int     `json:"losses"`
		Draws   int     `json:"draws"`
		WinRate float64 `json:"win_rate"`
		AvgAPM  float64 `json:"avg_apm"`
		AvgEAPM float64 `json:"avg_eapm"`
	}

	entries := make([]rankingEntry, 0, len(aggByName))
	for _, a := range aggByName {
		if a.Games == 0 {
			continue
		}
		winRate := math.Round((float64(a.Wins)/float64(a.Games))*1000) / 10
		avgAPM := math.Round((a.SumAPM/float64(a.Games))*10) / 10
		avgEAPM := math.Round((a.SumEAPM/float64(a.Games))*10) / 10
		entries = append(entries, rankingEntry{
			Name:    a.Name,
			Games:   a.Games,
			Wins:    a.Wins,
			Losses:  a.Losses,
			Draws:   a.Draws,
			WinRate: winRate,
			AvgAPM:  avgAPM,
			AvgEAPM: avgEAPM,
		})
	}

	sort.Slice(entries, func(i, j int) bool {
		if entries[i].WinRate != entries[j].WinRate {
			return entries[i].WinRate > entries[j].WinRate
		}
		if entries[i].Wins != entries[j].Wins {
			return entries[i].Wins > entries[j].Wins
		}
		if entries[i].Games != entries[j].Games {
			return entries[i].Games > entries[j].Games
		}
		return strings.ToLower(entries[i].Name) < strings.ToLower(entries[j].Name)
	})

	if len(entries) > limit {
		entries = entries[:limit]
	}
	for i := range entries {
		entries[i].Rank = i + 1
	}

	return c.JSON(fiber.Map{
		"mode":             "3v3",
		"sort":             "win_rate_desc,wins_desc,games_desc",
		"qualifying_games": qualifyingGames,
		"total_rankers":    len(entries),
		"rankings":         entries,
	})
}

func isStrictThreeVsThree(players []*ent.Player) bool {
	if len(players) != 6 {
		return false
	}
	teamCounts := make(map[uint8]int)
	for _, p := range players {
		teamCounts[p.Team]++
	}
	if len(teamCounts) != 2 {
		return false
	}
	for _, cnt := range teamCounts {
		if cnt != 3 {
			return false
		}
	}
	return true
}

// GetRaceMatchupAnalyzer returns race-composition matchup win rates.
// Example matchup key: "PTZ vs ZZZ"
func GetRaceMatchupAnalyzer(c *fiber.Ctx) error {
	ctx := c.Context()
	teamSize := c.QueryInt("team_size", 0) // 0 = all
	limit := c.QueryInt("limit", 200)
	if limit <= 0 {
		limit = 200
	}
	if limit > 500 {
		limit = 500
	}
	if teamSize < 0 {
		teamSize = 0
	}

	q := database.Client.Game.Query().WithPlayers()
	if teamSize > 0 {
		q = q.Where(game.PlayerCountEQ(teamSize * 2))
	}
	games, err := q.All(ctx)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to fetch analyzer games",
			"details": err.Error(),
		})
	}

	type agg struct {
		TeamA string
		TeamB string
		Games int
		AWins int
		BWins int
	}
	aggByKey := make(map[string]*agg)
	qualifiedGames := 0

	for _, g := range games {
		players := g.Edges.Players
		if len(players) == 0 {
			continue
		}
		byTeam := make(map[uint8][]*ent.Player)
		for _, p := range players {
			byTeam[p.Team] = append(byTeam[p.Team], p)
		}
		if len(byTeam) != 2 {
			continue
		}

		teams := make([]int, 0, 2)
		for t := range byTeam {
			teams = append(teams, int(t))
		}
		sort.Ints(teams)
		t1 := uint8(teams[0])
		t2 := uint8(teams[1])
		p1 := byTeam[t1]
		p2 := byTeam[t2]
		if teamSize > 0 && (len(p1) != teamSize || len(p2) != teamSize) {
			continue
		}

		comp1 := teamRaceComposition(p1)
		comp2 := teamRaceComposition(p2)
		if comp1 == "" || comp2 == "" {
			continue
		}

		teamA := comp1
		teamB := comp2
		teamAID := t1
		teamBID := t2
		if teamB < teamA {
			teamA, teamB = teamB, teamA
			teamAID, teamBID = teamBID, teamAID
		}

		key := teamA + " vs " + teamB
		a, ok := aggByKey[key]
		if !ok {
			a = &agg{TeamA: teamA, TeamB: teamB}
			aggByKey[key] = a
		}
		if g.WinnerTeam <= 0 {
			continue
		}
		winner := uint8(g.WinnerTeam)
		if winner == teamAID {
			a.Games++
			qualifiedGames++
			a.AWins++
		} else if winner == teamBID {
			a.Games++
			qualifiedGames++
			a.BWins++
		}
	}

	type entry struct {
		Matchup      string  `json:"matchup"`
		TeamA        string  `json:"team_a"`
		TeamB        string  `json:"team_b"`
		Games        int     `json:"games"`
		TeamAWins    int     `json:"team_a_wins"`
		TeamBWins    int     `json:"team_b_wins"`
		TeamAWinRate float64 `json:"team_a_win_rate"`
		TeamBWinRate float64 `json:"team_b_win_rate"`
	}

	rows := make([]entry, 0, len(aggByKey))
	for _, a := range aggByKey {
		if a.Games == 0 {
			continue
		}
		base := float64(a.Games)
		rows = append(rows, entry{
			Matchup:      a.TeamA + " vs " + a.TeamB,
			TeamA:        a.TeamA,
			TeamB:        a.TeamB,
			Games:        a.Games,
			TeamAWins:    a.AWins,
			TeamBWins:    a.BWins,
			TeamAWinRate: math.Round((float64(a.AWins)/base)*1000) / 10,
			TeamBWinRate: math.Round((float64(a.BWins)/base)*1000) / 10,
		})
	}

	sort.Slice(rows, func(i, j int) bool {
		if rows[i].Games != rows[j].Games {
			return rows[i].Games > rows[j].Games
		}
		if rows[i].TeamAWinRate != rows[j].TeamAWinRate {
			return rows[i].TeamAWinRate > rows[j].TeamAWinRate
		}
		return rows[i].Matchup < rows[j].Matchup
	})
	if len(rows) > limit {
		rows = rows[:limit]
	}

	return c.JSON(fiber.Map{
		"mode":            "race_composition_matchup",
		"team_size":       teamSize,
		"qualified_games": qualifiedGames,
		"total_rows":      len(rows),
		"rows":            rows,
	})
}

func teamRaceComposition(players []*ent.Player) string {
	if len(players) == 0 {
		return ""
	}
	letters := make([]string, 0, len(players))
	for _, p := range players {
		r := strings.ToLower(strings.TrimSpace(p.Race))
		switch {
		case strings.HasPrefix(r, "terran"):
			letters = append(letters, "T")
		case strings.HasPrefix(r, "zerg"):
			letters = append(letters, "Z")
		case strings.HasPrefix(r, "protoss"):
			letters = append(letters, "P")
		default:
			letters = append(letters, "U")
		}
	}
	sort.Strings(letters)
	return strings.Join(letters, "")
}
