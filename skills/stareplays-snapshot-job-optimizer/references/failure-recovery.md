# Failure Recovery

- Keep query/build errors actionable with root causes.
- Retry by scheduler rather than in-process infinite loop.
- Keep daemon mode cancellation and ticker shutdown clean.
- On undefined snapshot table, return service unavailable with clear action.
