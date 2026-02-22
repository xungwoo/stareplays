---
name: stareplays-backend-architecture-guardrails
description: Enforce long-term maintainable backend architecture for stareplays (Go + Fiber + Ent) with strict handler/service/repository/domain boundaries. Use when adding or changing API endpoints, replay ingestion logic, ranking/analyzer flows, or cross-layer refactors.
---

# Backend Architecture Guardrails (stareplays)

Follow a layered backend structure that keeps HTTP concerns, business logic, and persistence separate.

## Apply This Workflow

1. Define API contract first: request fields, response fields, status codes, and backward compatibility.
2. Keep handlers thin: validate/parse HTTP input, call service, map service errors to HTTP.
3. Put business rules in service: replay reliability policy, uploader eligibility, and idempotency rules.
4. Put query/persistence details in repository: Ent query shape, eager-loading, sorting, and pagination.
5. Keep domain invariants explicit: document preconditions and postconditions in service functions.
6. Require tests for changed paths before merge.

## Boundary Rules

- Do not embed complex business branches in handler functions.
- Do not let service code depend on Fiber types.
- Do not let repositories return transport-specific maps.
- Prefer typed request/result structs over dynamic maps.
- Keep transaction ownership in service layer unless an operation is strictly single-query.

## Refactor Priorities For This Repo

1. Split `backend/internal/api/handlers/replay_handler.go` into multiple files by endpoint group.
2. Extract player stats aggregation from handler into a service package.
3. Standardize error types across upload/ranking/analyzer flows.
4. Add shared pagination and sorting validator helpers.

## References

- Read `references/layering-rules.md` for dependency direction and anti-patterns.
- Read `references/package-boundaries.md` for file/package layout suggestions.
- Read `references/change-checklist.md` before finalizing changes.

## Script

- Run `scripts/scaffold_endpoint.sh` to generate a new endpoint scaffolding checklist.
