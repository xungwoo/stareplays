# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Mandatory Deployment Guidance

Before any Railway production deployment, read `docs/RAILWAY_DEPLOYMENT_GUIDE.md`.

The critical rule is that `stareplays-next` must be deployed with `railway up frontend/app-next --path-as-root --service stareplays-next --environment production`. Deploying it from the repository root makes Railway miss `frontend/app-next/railway.toml`, fall back to default detection, and can create a failed production deployment.

## Project Overview

stareplays is a StarCraft replay statistics and analysis API built with Go. The application parses StarCraft replay files (.rep), extracts game data, stores it in PostgreSQL, and provides a REST API for querying player statistics and game history.

**Tech Stack:**
- Go 1.25.5
- Fiber v2 (HTTP framework)
- GORM (ORM)
- PostgreSQL (database)
- github.com/icza/screp (StarCraft replay parser library)

## Development Commands

### Running the Application
```bash
# Run in development mode (recommended)
make dev

# Build and run production binary
make build
make run

# Or combine: build then run
make run
```

### Testing
```bash
# Run all tests with verbose output
make test

# Or use go test directly
cd backend && go test -v ./...
```

### Maintenance
```bash
# Clean build artifacts and uploads
make clean

# Tidy dependencies
make tidy
```

### Docker (future use)
```bash
make docker-build
make docker-run
```

## Architecture

### Project Structure

```
stareplays/
├── backend/
│   ├── cmd/server/           # Application entry point
│   │   └── main.go           # HTTP server initialization, middleware setup, route definitions
│   ├── internal/             # Private application code
│   │   ├── api/              # HTTP layer
│   │   ├── database/         # Database connection and configuration
│   │   ├── models/           # Data models
│   │   └── parser/           # Replay file parsing logic
│   ├── ent/                  # Ent schema + generated code
│   └── pkg/                  # Public/reusable packages
└── frontend/web/             # Static web UI
```

### Key Architectural Patterns

**Database Layer:**
- Uses GORM for database abstraction
- Global `database.DB` variable stores the GORM instance
- Auto-migration is performed in `database.Connect()` on startup
- Import path issue: `backend/internal/database/postgres.go:10` references incorrect module path `github.com/yourusername/starcraft-stats` instead of `github.com/xungwoo/stareplays`

**Data Models:**
- `models.Replay`: Core entity storing parsed replay file data
  - Unique constraint on `FileHash` to prevent duplicate uploads
  - Tracks game metadata (map, length, date), player info (name, race, APM), and result
- `models.PlayerStats`: Computed statistics (not persisted, used for API responses)

**HTTP Layer:**
- Fiber v2 framework with standard middleware (logger, CORS)
- API versioned at `/api/v1`
- Currently has stub endpoints:
  - `GET /health` - health check
  - `GET /api/v1/replays` - list replays (stub)
  - `POST /api/v1/replays/upload` - upload replay (stub)

**Configuration:**
- `.env` file for environment variables (loaded via godotenv)
- Required vars: `PORT`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSLMODE`
- Optional: `STORAGE_PATH` (defaults to ./uploads), `JWT_SECRET` (future use)

### Development Workflow

1. **Adding New Endpoints**: Create handlers in `backend/internal/api/handlers/`, register routes in `backend/cmd/server/main.go`
2. **Database Changes**: Update models in `backend/internal/models/`, GORM will auto-migrate on next startup
3. **Replay Parsing**: Implement in `backend/internal/parser/` using the `github.com/icza/screp` library
4. **Testing**: Write `*_test.go` files alongside implementation files

### Known Issues

- Import path in `backend/internal/database/postgres.go:10` references wrong module (`github.com/yourusername/starcraft-stats` should be `github.com/xungwoo/stareplays`)
- Core functionality (handlers, parser, middleware) are placeholder directories awaiting implementation
