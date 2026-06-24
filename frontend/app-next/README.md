# StaReplays App Next

`frontend/app-next`는 StaReplays의 운영 Next.js App Router 프런트입니다. 기존 Fiber API 서버는 그대로 두고, 이 앱이 API를 읽어 대시보드 page model을 구성합니다.

## 역할

- 운영 웹 대시보드 제공
- replay 업로드/조회/분석 화면 제공
- 3x3 랭킹, 시즌 전적, 팀 조합 분석 화면 제공
- Claude/Codex MCP가 읽는 `/api/team-analysis/raw` endpoint 제공

## 주요 Route

| Route | 역할 |
| --- | --- |
| `/` | 메인 대시보드입니다. 현재 유저, 최근 게임, 주요 지표, 업로드 진입점을 제공합니다. |
| `/vault` | 게임 목록과 선택 게임의 상세 replay 분석을 확인합니다. |
| `/analyzer` | 선택 게임의 analyzer 결과, player deep-dive, 수동 refresh/reanalyze 흐름을 제공합니다. |
| `/rankings` | 3x3 랭킹과 종족 조합 승률을 보여줍니다. |
| `/team-analysis` | 전체/시즌 3x3 팀 조합, 선수 역량 오각형, insight card를 제공합니다. |
| `/seasons` | 시즌 목록과 전체 시즌 요약을 제공합니다. |
| `/seasons/[season]` | 특정 시즌의 전적, 플레이어 승패/승률 추이, 경기 목록을 제공합니다. |
| `/api/team-analysis/raw` | MCP/LLM 분석용 raw JSON을 제공합니다. |

## 데이터 흐름

```text
app route
  -> lib/loaders/*
  -> lib/api/client.ts
  -> Fiber API
  -> lib/adapters/*
  -> page model
  -> components/*
```

설계 기준:

- API-first 구조입니다.
- fixture는 운영 API가 없거나 read path가 실패했을 때의 fallback입니다.
- 서버 route에서 API-backed page model을 먼저 만들고, client component는 안정적인 props를 받아 렌더링합니다.
- `currentUser`는 query, cookie, Dashboard의 `localStorage` 복원 흐름을 함께 사용합니다.
- polling은 기본 정책이 아닙니다. analyzer 상태 갱신은 명시적인 refresh/reanalyze 액션 기준입니다.

## 주요 디렉터리

| 경로 | 역할 |
| --- | --- |
| `app/*` | Next.js App Router route entry입니다. |
| `app/api/team-analysis/raw` | MCP/LLM용 raw endpoint입니다. |
| `components/shell` | 공통 앱 shell, nav, current user chip입니다. |
| `components/shared` | `Panel`, `MetricCard`, `PlayerBadge`, `RaceBadge` 같은 공용 UI primitive입니다. |
| `components/dashboard` | 메인 대시보드입니다. |
| `components/vault` | 게임 보관함/상세 분석 화면입니다. |
| `components/analyzer` | analyzer 결과 화면입니다. |
| `components/rankings` | 3x3 랭킹/종족 조합 화면입니다. |
| `components/team-analysis` | 팀 조합 분석 화면입니다. |
| `components/seasons` | 시즌 분석 화면입니다. |
| `lib/loaders` | route별 API read orchestration입니다. |
| `lib/adapters` | API 응답을 page model로 변환합니다. |
| `lib/api` | 공통 fetch/action helper입니다. |
| `lib/utils` | player 표시, 색상, 포맷, board 계산 등 공용 유틸입니다. |
| `types` | raw API와 page model 타입입니다. |

## 페이지별 데이터 소스

| 화면 | 주요 API |
| --- | --- |
| Dashboard | `/api/v1/rankings/3v3`, `/api/v1/players/:name/stats`, `/api/v1/users/suggest`, `/api/v1/games` |
| Vault | `/api/v1/games`, `/api/v1/games/:id/detail` |
| Analyzer | `/api/v1/games`, `/api/v1/games/:id/detail`, `/api/v1/games/:id/analyzer` |
| Rankings | `/api/v1/rankings/3v3`, `/api/v1/analyzer/race-matchups` |
| Team Analysis | `/api/v1/seasons` 우선, 필요 시 `/api/v1/games` fallback |
| Seasons | `/api/v1/seasons` |
| Raw endpoint | Team Analysis page model 기반 JSON |

## UI 규칙

- 운영 화면은 `frontend/app-next` 기준으로 구현합니다.
- `frontend/web`은 legacy 동작과 표현을 참고하기 위한 기준입니다.
- 플레이어명은 한국어 별칭을 우선 사용합니다.
- 플레이어/종족 반복 표기는 `PlayerBadge`, `PlayerBadgeGroup`, `RaceBadge`, `RaceCompositionBadges`를 우선 사용합니다.
- 분석 수치에는 하드코딩된 운영 값 대신 API/model 값을 사용합니다.
- 카드와 테이블은 한 화면에서 많은 정보를 볼 수 있도록 밀도 있게 구성합니다.
- `Bradley-Terry`와 `TrueSkill`은 단위가 다르므로 같은 축에서 절대값으로 직접 비교하지 않습니다.

## Raw endpoint

`/api/team-analysis/raw`는 MCP와 LLM 분석용 endpoint입니다.

```text
GET /api/team-analysis/raw
GET /api/team-analysis/raw?season_label=시즌7
```

특징:

- 현재 별도 인증이 없습니다.
- 3x3 팀 분석 page model과 LLM prompt context를 JSON으로 반환합니다.
- 응답 계약은 `mcp/stareplays-mcp/README.md`의 “Raw endpoint 데이터” 섹션을 기준으로 관리합니다.
- 민감 데이터나 비공개 replay 원본 URL을 포함하지 않도록 주의합니다.

## 실행

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` 예시:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3000
```

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | Next dev server를 `3100` 포트로 실행합니다. |
| `npm run build` | `.next-prod` 기준 production build를 생성합니다. |
| `npm run start` | production server를 `${PORT:-3100}`로 실행합니다. |
| `npm run preview` | production preview server를 `3201` 포트로 실행합니다. |
| `npm test` | Vitest test suite를 실행합니다. |
| `npm run typecheck` | TypeScript typecheck를 실행합니다. |

## 포트

- Next dev: `3100`
- Next preview: `3201`
- Fiber API: `3000`

## 검증

표준 검증:

```bash
npm test
npm run typecheck
npm run build
```

주요 테스트 범위:

- Dashboard preview/upload/current-user 흐름
- Vault row select/collapse/detail/analyzer deep-link
- Analyzer tab/manual refresh/reanalyze/no-polling 동작
- Rankings sort/tie-break/error/empty 상태
- Team Analysis adapter와 raw endpoint 계약
- Season Analysis adapter와 season page model

## 배포

Railway service:

- 서비스명: `stareplays-next`
- 설정 파일: `frontend/app-next/railway.toml`
- Dashboard Root Directory: `frontend/app-next`
- Dashboard Railway Config File: `/frontend/app-next/railway.toml`
- Trigger branch: `main`
- Build command: `npm run build`
- Start command: `npm run start`
- Healthcheck path: `/team-analysis`

배포 전 조건:

- feature branch 작업이 `main`에 병합되어 있어야 합니다.
- `main`이 `origin/main`과 같아야 합니다.
- 기본 배포 경로는 GitHub `main` push -> Railway Autodeploy입니다.
- 자세한 절차는 루트의 `AGENTS.md`, `CLAUDE.md`, `docs/RAILWAY_DEPLOYMENT_GUIDE.md`, `docs/RAILWAY_GITHUB_DEPLOYMENT_SETUP.md`를 따릅니다.

CLI 복구용 수동 배포:

아래 명령은 팀 공용 배포 경로가 아니라 Railway CLI 권한이 있는 운영자 복구용입니다.

```bash
railway up frontend/app-next \
  --path-as-root \
  --service stareplays-next \
  --environment production \
  --detach \
  --message "Deploy dashboard update"
```

임시 worktree에서 Railway project link가 없으면 project id를 명시합니다.

```bash
railway up frontend/app-next \
  --path-as-root \
  --project 838683d6-9fb8-41d6-ad8a-1075e4d00196 \
  --service stareplays-next \
  --environment production \
  --detach \
  --message "Deploy dashboard update"
```

금지:

```bash
railway up --service stareplays-next --environment production
```

레포 루트에서 `stareplays-next`를 배포하면 `frontend/app-next/railway.toml`을 읽지 못하고 Railpack 기본 감지로 실패할 수 있습니다.
