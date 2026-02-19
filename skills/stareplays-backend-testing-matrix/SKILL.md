---
name: stareplays-backend-testing-matrix
description: Build and enforce backend test strategy for stareplays across handler, service, repository, parser, and snapshot jobs. Use when implementing features, fixing bugs, reviewing risk, or adding regression protection.
---

# Backend Testing Matrix (stareplays)

Create fast feedback and regression safety for backend changes.

## Apply This Workflow

1. Classify change type: API contract, domain logic, query/index, parser, job.
2. Select test levels from matrix: unit, integration, end-to-end, performance smoke.
3. Add happy path + edge path + failure path tests.
4. Add deterministic fixtures for replay parsing scenarios.
5. Add race-sensitive tests for concurrent upload/job paths.

## Rules

- Require at least one test for every bug fix.
- Prefer table-driven tests for rules-heavy logic.
- Keep heavy DB tests isolated and opt-in if needed.
- Track untested critical paths explicitly.

## References

- `references/test-matrix.md`
- `references/replay-fixtures.md`
- `references/ci-gates.md`

## Script

- `scripts/test_changed_packages.sh` runs tests only for changed Go packages.
