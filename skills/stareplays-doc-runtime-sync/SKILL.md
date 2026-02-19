---
name: stareplays-doc-runtime-sync
description: Keep stareplays documentation synchronized with runtime behavior. Use when routes, request/response schemas, env vars, job modes, deployment steps, or operational runbooks are changed.
---

# Doc Runtime Sync (stareplays)

Prevent drift between code behavior and markdown documentation.

## Apply This Workflow

1. Identify changed runtime sources: routes, handlers, env parsing, jobs.
2. List impacted docs: README, API_USAGE, job docs, deploy docs, CLAUDE.md.
3. Update docs with exact endpoint names, params, defaults, and examples.
4. Add explicit references to source-of-truth files.
5. Run drift checks before finalizing.

## Rules

- Prefer current code over stale documentation statements.
- Keep examples executable and aligned with current routes.
- Document defaults exactly as implemented.
- Mark backward compatibility behavior explicitly.

## References

- `references/doc-source-of-truth.md`
- `references/route-doc-sync-checklist.md`

## Script

- `scripts/check_route_doc_drift.sh` compares declared routes in server code against docs.
