# EXPLAIN Workflow

1. Save SQL into a file.
2. Run EXPLAIN (ANALYZE, BUFFERS, VERBOSE).
3. Check scan type, rows estimate, actual rows, and sort/hash memory.
4. Add index/query rewrite.
5. Re-run EXPLAIN and compare.

Flag as regression if planner falls back to broad sequential scans on hot endpoints.
