# Package Boundaries

## Suggested Structure

- internal/api/handlers/
- internal/services/replay/
- internal/services/playerstats/
- internal/services/ranking/
- internal/services/analyzer/
- internal/repositories/
- internal/domain/

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
