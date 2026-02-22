# Source Of Truth

- routes and middleware: backend/cmd/server/main.go
- endpoint behavior: backend/internal/api/handlers/*.go
- ranking job behavior: backend/cmd/ranking-job + backend/internal/services/ranking
- analyzer job behavior: backend/cmd/analyzer-job + backend/internal/services/analyzer
- schema/index behavior: backend/ent/schema/*.go
