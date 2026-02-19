---
name: stareplays-ent-query-performance
description: Optimize Ent + PostgreSQL query performance in stareplays. Use when working on leaderboards, player averages (APM/win-rate), list endpoints, ranking/analyzer snapshots, pagination/sorting, index tuning, and EXPLAIN-driven query optimization.
---

# Ent Query Performance (stareplays)

Design query changes with correctness, deterministic ordering, and stable latency under growth.

## Apply This Workflow

1. Capture target endpoint/response shape and p95 latency target.
2. Define exact filter + sort + pagination behavior.
3. Build query with deterministic tie-breakers.
4. Verify query plan and index usage with EXPLAIN.
5. Add/adjust indexes aligned with WHERE + ORDER BY.
6. Add regression tests for ordering and edge cases.

## Rules

- Whitelist sortable fields and directions.
- Enforce max page size and sane defaults.
- Avoid loading full rows when count/sum is sufficient.
- Use aggregation SQL for analytics-heavy endpoints.
- Keep result ordering deterministic across pages.
- Keep write path simple and isolate analytics query code.
- Use pre-aggregation for hot leaderboard reads when raw aggregation cost is high.

## Repository-Specific Focus

- Remove N+1 patterns in player stats.
- Replace in-memory aggregate loops that can be SQL sums.
- Align snapshot table indexes with API sort keys.

## References

- `references/query-checklist.md`
- `references/index-playbook.md`
- `references/explain-workflow.md`
- `references/input-scoping.md`
- `references/migration-and-dod.md`

## Script

- `scripts/explain_capture.sh` runs EXPLAIN (ANALYZE, BUFFERS) for a SQL file.
