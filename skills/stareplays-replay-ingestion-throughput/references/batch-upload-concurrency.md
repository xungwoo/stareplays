# Batch Upload Concurrency

- Use bounded worker pool (start with 2-4 workers).
- Keep result ordering stable by input index.
- Avoid global lock around full batch.
- Protect shared maps/slices with channels or mutex.
- Measure p50/p95 latency and success rate.
