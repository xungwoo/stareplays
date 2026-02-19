# Layering Rules

## Dependency Direction

- handler -> service -> repository -> ent/db
- handler must not call ent client directly.
- service must not import fiber.

## Error Model

- service returns typed domain errors.
- handler maps domain errors to HTTP response codes.

## Transactions

- service starts and commits/rolls back multi-step transactions.
- repository functions are transaction-aware via context or repository instance wrapping tx.

## Performance Guard

- forbid N+1 query patterns in services.
- prefer aggregation SQL for heavy analytics.
