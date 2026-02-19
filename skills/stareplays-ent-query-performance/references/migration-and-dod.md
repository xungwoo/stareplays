# Migration, Testing, Definition Of Done

## Migration Checklist

- update Ent schema if needed
- regenerate Ent code
- add or adjust indexes
- verify on realistic/staging data
- add backfill plan if introducing summary/pre-aggregation tables

## Testing Checklist

- ranking correctness
- filter correctness
- tie-breaker determinism
- zero/edge-case behavior
- no pathological full-scan on hot paths

## Definition Of Done

- correct ranking/average output
- index-efficient query plan validated with EXPLAIN
- deterministic pagination/sorting
- tests added for correctness and key edge cases
