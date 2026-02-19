---
name: stareplays-snapshot-job-optimizer
description: Optimize ranking/analyzer snapshot jobs for reliability, performance, and operability in stareplays. Use when changing job SQL, advisory lock flow, schedule interval behavior, or snapshot table maintenance.
---

# Snapshot Job Optimizer (stareplays)

Improve ranking/analyzer snapshot jobs with predictable run time and safe failure handling.

## Apply This Workflow

1. Confirm job SLA: cadence, max runtime, acceptable staleness.
2. Verify advisory lock behavior and non-overlap guarantees.
3. Tune aggregation SQL and snapshot insert path.
4. Minimize full-table operations where possible.
5. Add logging for rows, qualified_games, duration, and errors.
6. Validate API behavior when snapshot table is empty/unavailable.

## Rules

- Keep one canonical sort behavior per endpoint.
- Keep snapshot writes atomic (delete + insert in one tx).
- Keep lock failure as a non-fatal skip path.
- Ensure daemon mode handles shutdown gracefully.

## References

- `references/job-sla.md`
- `references/snapshot-consistency.md`
- `references/failure-recovery.md`

## Script

- `scripts/run_snapshot_benchmark.sh` runs once-mode jobs and prints elapsed time.
