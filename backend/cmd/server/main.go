package main

import (
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/joho/godotenv"
	"github.com/xungwoo/stareplays/internal/api/handlers"
	"github.com/xungwoo/stareplays/internal/database"
)

func main() {
	// 환경변수 로드
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	// Connect to database
	if err := database.Connect(); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	// Fiber 앱 생성
	app := fiber.New(fiber.Config{
		AppName:   "stareplays API v1.0",
		BodyLimit: envIntMB("REPLAY_MAX_SIZE_MB", 30),
	})

	// 미들웨어 (권장 순서대로 적용)
	// 1. Recover - 패닉 복구 (가장 먼저 두어 어떤 단계의 패닉도 잡을 수 있게 함)
	app.Use(recover.New(recover.Config{
		EnableStackTrace: true,
	}))

	// 2. RequestID - 요청 ID 생성 (이후 단계의 로그에서 ID를 참조할 수 있게 함)
	app.Use(requestid.New())

	// 3. Logger - 로깅 (요청의 시작과 끝을 기록)
	app.Use(logger.New(logger.Config{
		Format:     "[${time}] ${status} - ${method} ${path} ${latency} | ${ip} | RequestID: ${locals:requestid}\n",
		TimeFormat: "2006-01-02 15:04:05",
	}))

	// 4. CORS - Cross-Origin Resource Sharing (보안 관련 필터링)
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "*",
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization",
		AllowCredentials: false,
	}))

	// 5. Limiter - Rate limiting (보안 관련 필터링)
	app.Use(limiter.New(limiter.Config{
		Max:        100,
		Expiration: 1 * time.Minute,
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": "Too many requests, please try again later",
			})
		},
	}))

	// 헬스체크 엔드포인트
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status": "ok",
		})
	})

	// API 라우트 그룹
	api := app.Group("/api/v1")

	// 게임 관련 라우트
	api.Get("/games", handlers.ListGames)                // 게임 목록 조회
	api.Get("/games/:id", handlers.GetGame)              // 게임 상세 조회
	api.Get("/games/:id/detail", handlers.GetGameDetail) // 게임 시각화 데이터
	api.Get("/games/:id/analyzer", handlers.GetGameAnalyzer)
	if !envBool("DISABLE_LOCAL_PARSE", false) {
		api.Post("/games/parse", handlers.ParseLocalReplay) // 로컬 파일 파싱 (dev)
	} else {
		log.Println("Local parse endpoint disabled by DISABLE_LOCAL_PARSE=true")
	}
	api.Post("/games/upload/preview", handlers.PreviewUploadedReplay)
	api.Post("/games/upload", handlers.ParseUploadedReplay)
	api.Delete("/games/:id", handlers.DeleteGame) // 게임 삭제

	// 플레이어 통계
	api.Get("/players/:name/stats", handlers.GetPlayerStats) // 플레이어 통계 조회
	api.Get("/users/suggest", handlers.GetUserSuggestions)
	api.Get("/rankings/3v3", handlers.GetThreeVsThreeRankings)
	api.Get("/analyzer/race-matchups", handlers.GetRaceMatchupAnalyzer)

	// Web UI
	if webDir, ok := resolveWebDir(); ok {
		app.Get("/", func(c *fiber.Ctx) error {
			return c.SendFile(filepath.Join(webDir, "index.html"))
		})
		app.Static("/", webDir)
	} else {
		log.Println("Web UI assets not found. Running in API-only mode.")
		app.Get("/", func(c *fiber.Ctx) error {
			return c.SendString("StaReplays API is running. Web UI assets not found.")
		})
	}

	// 서버 시작
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	log.Printf("Server starting on port %s", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatal(err)
	}
}

func envBool(key string, fallback bool) bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	if v == "" {
		return fallback
	}
	switch v {
	case "1", "true", "t", "yes", "y", "on":
		return true
	case "0", "false", "f", "no", "n", "off":
		return false
	default:
		return fallback
	}
}

func envIntMB(key string, fallbackMB int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallbackMB * 1024 * 1024
	}
	mb, err := strconv.Atoi(v)
	if err != nil || mb <= 0 {
		return fallbackMB * 1024 * 1024
	}
	return mb * 1024 * 1024
}

func resolveWebDir() (string, bool) {
	if v := strings.TrimSpace(os.Getenv("WEB_DIR")); v != "" {
		if fi, err := os.Stat(v); err == nil && fi.IsDir() {
			return v, true
		}
		log.Printf("WEB_DIR is set but not found: %s", v)
	}
	for _, candidate := range []string{
		"./frontend/web",
		"../frontend/web",
		"./web",
	} {
		fi, err := os.Stat(candidate)
		if err == nil && fi.IsDir() {
			return candidate, true
		}
	}
	return "", false
}
