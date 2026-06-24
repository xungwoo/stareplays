# Documentation

현재 기준의 정식 문서는 아래 파일입니다.

- [architecture.md](architecture.md): 시스템 구조, 컴포넌트 책임, Railway 운영 배포 토폴로지
- [spec.md](spec.md): 현재 기능 명세, 도메인 규칙, API/백그라운드 작업 동작
- [frontend-next-architecture.md](frontend-next-architecture.md): 운영 Next.js 프런트 구조와 데이터 흐름
- [starprojects-railway-overview.md](starprojects-railway-overview.md): StarProjects GitHub 레포지토리와 Railway 배포 모듈 관계

보조 원칙:

- 현재 런타임/운영 동작을 설명하는 문서는 위 두 파일을 기준으로 유지합니다.
- 구현 중간 과정, 검증 로그, 임시 runbook, 완료된 TODO 문서는 [histories](histories/README.md) 아래에 보관합니다.
- 아직 끝나지 않은 작업 계획 문서는 루트의 `TODO_*.md`를 유지합니다.

소스 오브 트루스:

- 라우트/미들웨어: `backend/cmd/server/main.go`
- API 동작: `backend/internal/api/handlers/replay_handler.go`
- replay analyzer worker: `backend/cmd/replay-analyzer-worker/main.go`
- ranking job: `backend/cmd/ranking-job/main.go`, `backend/internal/services/ranking/service.go`
- analyzer job: `backend/cmd/analyzer-job/main.go`, `backend/internal/services/analyzer/service.go`
- Next 프런트: `frontend/app-next/app/*`, `frontend/app-next/components/*`, `frontend/app-next/lib/loaders/*`, `frontend/app-next/lib/adapters/*`
- MCP raw endpoint: `frontend/app-next/app/api/team-analysis/raw/route.ts`, `mcp/stareplays-mcp/README.md`
- 스키마/제약: `backend/ent/schema/*.go`
