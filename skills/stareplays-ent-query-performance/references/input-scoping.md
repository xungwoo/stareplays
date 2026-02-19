# Input Scoping

Collect these inputs before optimizing:

- endpoint and exact response shape
- filters (season, race, map, time range, min_games)
- sort keys and pagination method
- expected row count and freshness requirement
- latency target (p95) and traffic profile

If inputs are unclear, define assumptions explicitly before query/index changes.
