# Query Checklist

- Inputs validated and normalized (page, page_size, sort_by, sort_dir).
- Deterministic order with tie-breaker.
- Count query separated from item query when needed.
- No repeated per-row query calls.
- Limit and offset bounded.
- Error handling preserves root cause.
