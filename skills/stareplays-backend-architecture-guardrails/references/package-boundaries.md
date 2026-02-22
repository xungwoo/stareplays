# Package Boundaries

## Suggested Structure

- backend/internal/api/handlers/
- backend/internal/services/replay/
- backend/internal/services/playerstats/
- backend/internal/services/ranking/
- backend/internal/services/analyzer/
- backend/internal/repositories/
- backend/internal/domain/

## Handler Conventions

- one handler file per endpoint area
- one request struct per endpoint
- one response struct per endpoint

## Service Conventions

- one public entrypoint per use case
- explicit input/output structs
- no transport coupling

## Repository Conventions

- hide ent query details behind typed methods
- keep sorting whitelist centralized
