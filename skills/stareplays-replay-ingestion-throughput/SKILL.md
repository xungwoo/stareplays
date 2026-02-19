---
name: stareplays-replay-ingestion-throughput
description: Improve replay upload/parse/store throughput and reliability in stareplays. Use when changing batch upload, temp-file handling, parser integration, deduplication, uploader validation, and transaction flow.
---

# Replay Ingestion Throughput (stareplays)

Optimize the replay ingestion pipeline without breaking idempotency and domain rules.

## Apply This Workflow

1. Confirm invariants: uploader eligibility, duplicate user upload rejection, reliability updates.
2. Trace hot path: multipart read -> temp write -> parse -> DB operations.
3. Identify serial bottlenecks and move to bounded concurrency.
4. Keep DB updates idempotent and transaction-safe.
5. Add stress tests for batch upload behavior.

## Rules

- Preserve hash-based replay dedup semantics.
- Keep one consistent error model for batch results.
- Bound goroutine count and memory use.
- Keep temp-file cleanup best-effort and observable.
- Treat duplicate insertion races as expected paths.

## References

- `references/ingest-pipeline.md`
- `references/idempotency-rules.md`
- `references/batch-upload-concurrency.md`

## Script

- `scripts/replay_load_test.sh` sends concurrent upload requests for baseline throughput checks.
