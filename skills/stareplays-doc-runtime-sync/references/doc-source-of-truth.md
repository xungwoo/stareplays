# Source Of Truth

- routes and middleware: cmd/server/main.go
- endpoint behavior: internal/api/handlers/*.go
- ranking job behavior: cmd/ranking-job + internal/services/ranking
- analyzer job behavior: cmd/analyzer-job + internal/services/analyzer
- schema/index behavior: ent/schema/*.go
