# StarProjects 레포지토리와 Railway 배포 모듈 개요

이 문서는 `/Users/seongwoo/StarProjects` 아래에서 관리 중인 GitHub 레포지토리들과, Railway `StaReplays` production 환경에 배포된 모듈들의 역할을 한눈에 보기 위한 운영 문서입니다.

기준 시점:

- 로컬 확인일: 2026-06-24
- Railway 환경: `production`
- Railway 프로젝트: `StaReplays`
- 기준 GitHub owner: `xungwoo`

## 전체 관계

```text
stareplays
  ├─ 운영 API 서버
  ├─ Next.js 웹 대시보드
  ├─ replay 업로드/저장/조회
  ├─ ranking/analyzer snapshot job
  └─ replay_analyzer worker 실행 래퍼

replay_analyzer
  ├─ replay 정적 파싱
  ├─ OpenBW/BWAPI 기반 프레임 재생 분석
  └─ 분석 결과 JSON 산출

openbw-bwapi-core
  ├─ OpenBW backend용 BWAPI fork
  └─ BWAPILauncher / bridge 실행 기반

openbw-core
  └─ OpenBW core snapshot
```

운영 흐름은 아래와 같습니다.

```text
사용자 브라우저
  -> stareplays-next
  -> stareplays API
  -> Postgres / replay bucket
  -> replay_analyzer worker
  -> replay_analyzer + openbw-bwapi-core + openbw-core
  -> 분석 결과 저장
  -> ranking-job / analyzer-job snapshot 갱신
```

## GitHub 레포지토리

| 로컬 경로 | GitHub remote | 현재 로컬 브랜치 | 역할 |
| --- | --- | --- | --- |
| `/Users/seongwoo/StarProjects/stareplays` | `git@github.com:xungwoo/stareplays.git` | `feat/game-analyzer-replay-analyzer-content` | 운영 서비스의 중심 레포지토리입니다. API, Next 프런트, Railway 설정, snapshot job, MCP 커넥터 문서를 포함합니다. |
| `/Users/seongwoo/StarProjects/replay_analyzer` | `git@github.com:xungwoo/replay_analyzer.git` | `feat/supply-metrics-refinement` | Brood War replay 분석 엔진입니다. `screp` 파싱과 OpenBW/BWAPI 기반 이벤트 분석을 결합해 JSON 결과를 생성합니다. |
| `/Users/seongwoo/StarProjects/openbw-bwapi` | `git@github.com:xungwoo/openbw-bwapi-core.git` | `main` | OpenBW를 backend로 사용하는 BWAPI fork입니다. replay analyzer의 OpenBW bridge 실행 기반입니다. |
| `/Users/seongwoo/StarProjects/openbw` | `git@github.com:xungwoo/openbw-core.git` | `main` | OpenBW core snapshot입니다. BWAPI fork와 함께 시뮬레이션/프레임 재생 기반 분석에 사용됩니다. |

### `stareplays`

역할:

- 공개 API 서버와 Next.js 웹 대시보드 제공
- replay 업로드, 저장, 조회, 삭제
- 3x3 랭킹 snapshot 조회
- 종족 조합 승률 snapshot 조회
- 팀 분석 raw endpoint와 MCP connector 제공
- Railway 서비스별 설정 파일 관리

주요 디렉터리:

| 경로 | 설명 |
| --- | --- |
| `backend/cmd/server` | Fiber 기반 API 서버 엔트리포인트 |
| `backend/cmd/ranking-job` | 3x3 랭킹 snapshot 생성 job |
| `backend/cmd/analyzer-job` | 종족 조합 승률 snapshot 생성 job |
| `backend/cmd/replay-analyzer-worker` | replay analyzer worker 엔트리포인트 |
| `frontend/app-next` | 운영 Next.js 대시보드 |
| `mcp/stareplays-mcp` | Claude/Codex MCP 로컬 커넥터 |
| `railway.*.toml` | Railway 서비스별 배포 설정 |

운영상 중요 포인트:

- main 브랜치가 운영 배포 기준입니다.
- API와 worker는 replay 원본 bucket과 Postgres를 공유합니다.
- 무거운 집계는 요청 시점 실시간 계산이 아니라 snapshot job으로 분리합니다.
- MCP raw endpoint는 현재 별도 인증 없이 팀 분석 JSON을 제공합니다.

### `replay_analyzer`

역할:

- `.rep` 파일을 정적 파싱하고, OpenBW/BWAPI 이벤트와 결합해 분석 결과를 생성합니다.
- `metadata.json`, `quality_report`, `summary`, `analysis_phase` 같은 결과물을 산출합니다.
- stareplays의 `replay_analyzer` Railway worker가 이 분석기를 실행합니다.

주요 구성:

| 경로 | 설명 |
| --- | --- |
| `cmd/replay_analyzer` | 분석 CLI |
| `cmd/openbw_sidecar` | OpenBW adapter용 gRPC sidecar |
| `cmd/openbw_exporter_openbw` | OpenBW bridge 기반 exporter |
| `internal/openbwexport` | exporter 공통 프로토콜과 JSONL 유틸 |
| `docs/ANALYSIS_SYSTEM_SPEC.md` | 분석 시스템 범위와 파이프라인 |
| `docs/METRICS_SPEC.md` | 지표 정의와 집계 규칙 |
| `docs/OPENBW_RAW_EXPORT_SCHEMA.md` | OpenBW raw JSONL payload 명세 |

운영상 중요 포인트:

- stareplays worker에서 실행할 때 `-analyzer-version`을 전달해야 DB/job 버전과 산출물 metadata 버전이 맞습니다.
- OpenBW/BWAPI 실행에는 MPQ 자산이 필요합니다.
- Railway worker는 replay 원본을 bucket에서 내려받아 임시 작업 디렉터리에서 분석합니다.

### `openbw-bwapi-core`

역할:

- OpenBW를 backend로 사용하는 BWAPI fork입니다.
- 일반 StarCraft 클라이언트용 BWAPI와 다르게 OpenBW backend를 대상으로 합니다.
- `BWAPILauncher`와 bridge 실행의 기반이 됩니다.

운영상 중요 포인트:

- `OPENBW_DIR` CMake 변수로 OpenBW core 위치를 지정해야 합니다.
- MPQ 파일(`Stardat.mpq`, `Broodat.mpq`, `Patch_rt.mpq`)이 실행 디렉터리에 필요합니다.
- replay analyzer의 bridge/sidecar 계층과 강하게 연결됩니다.

### `openbw-core`

역할:

- OpenBW core snapshot입니다.
- `openbw-bwapi-core` 빌드와 실행에서 backend 역할을 합니다.

운영상 중요 포인트:

- 단독 운영 서비스라기보다 replay analyzer 실행 체인의 하위 의존성입니다.
- 변경 시 replay analyzer의 frame/event 산출 결과가 바뀔 수 있으므로 회귀 샘플 비교가 필요합니다.

## Railway 배포 모듈

Railway `StaReplays` production 환경에서 확인된 서비스는 아래와 같습니다.

| 서비스 | 현재 상태 | 주요 역할 | 공개 도메인 |
| --- | --- | --- | --- |
| `stareplays` | `SUCCESS` | 공개 API 서버 | `stareplays-production.up.railway.app` |
| `stareplays-next` | `SUCCESS` | Next.js 운영 대시보드 | `stareplays-next-production.up.railway.app` |
| `ranking-job` | `SUCCESS` | 3x3 랭킹 snapshot 생성 | 없음 |
| `analyzer-job` | `SUCCESS` | 종족 조합 승률 snapshot 생성 | 없음 |
| `replay_analyzer` | `SUCCESS` | replay 분석 worker | 없음 |
| `Postgres` | `SUCCESS` | 운영 DB | 없음 |
| `Filebrowser` | `FAILED` | 파일/볼륨 확인용 보조 서비스 | `filebrowser-production-d404.up.railway.app` |

### `stareplays`

빌드/실행:

- Builder: `DOCKERFILE`
- Start command: `/app/server`
- 기준 commit: `main`의 최신 운영 커밋

역할:

- `/api/v1` 공개 API 제공
- replay 업로드와 파싱
- 게임/플레이어/상세 데이터 저장
- replay 원본 bucket 저장
- replay analyzer queue upsert 및 notify
- 랭킹/종족 조합 snapshot 조회 API 제공

주의:

- 운영 API는 공개 서비스입니다.
- replay 업로드, 삭제 등 상태 변경 endpoint는 별도 운영 정책에 맞게 관리해야 합니다.

### `stareplays-next`

빌드/실행:

- Builder: `NIXPACKS`
- Build command: `npm run build`
- Start command: `npm run start`
- Healthcheck path: `/team-analysis`

역할:

- 운영 웹 대시보드 제공
- `/`, `/vault`, `/analyzer`, `/rankings`, `/team-analysis`, `/seasons` 페이지 제공
- `/api/team-analysis/raw` raw endpoint 제공
- Claude/Codex MCP가 읽는 팀 분석 JSON 제공

주의:

- `/api/team-analysis/raw`는 현재 인증 없이 접근 가능합니다.
- MCP와 LLM 분석용으로 쓰이는 데이터 계약은 `mcp/stareplays-mcp/README.md`에 설명합니다.

### `ranking-job`

빌드/실행:

- Builder: `NIXPACKS`
- Build command: `go build -o bin/ranking-job ./cmd/ranking-job/main.go`
- Start command: `./bin/ranking-job`

역할:

- 3x3 경기 기준 랭킹 snapshot을 재생성합니다.
- 결과는 API가 `ranking_3v3` snapshot 테이블에서 조회합니다.

주의:

- 신규 경기 업로드 직후에는 job 실행 전까지 랭킹 경기 수가 늦게 반영될 수 있습니다.
- 운영에서 랭킹 경기 수가 잠시 어긋나는 현상은 snapshot 갱신 타이밍 때문일 수 있습니다.

### `analyzer-job`

빌드/실행:

- Builder: `NIXPACKS`
- Build command: `go build -o bin/analyzer-job ./cmd/analyzer-job/main.go`
- Start command: `./bin/analyzer-job`

역할:

- 종족 조합 승률 snapshot을 재생성합니다.
- 결과는 API가 `analyzer_race_matchups` snapshot 테이블에서 조회합니다.

주의:

- 팀 분석에서 표본이 적은 종족 조합은 과대표현되지 않도록 별도 표본 기준을 적용합니다.

### `replay_analyzer`

빌드/실행:

- Builder: `DOCKERFILE`
- Dockerfile: `backend/Dockerfile.replay-analyzer-worker`
- 기준 commit: `main`의 최신 운영 커밋

역할:

- Postgres의 replay analysis queue를 소비합니다.
- replay bucket에서 원본 `.rep` 파일을 내려받습니다.
- `replay_analyzer`와 OpenBW/BWAPI 기반 실행 체인을 통해 분석합니다.
- 성공/실패 상태와 결과 JSON을 `game_analyses`에 저장합니다.

주의:

- MPQ 자산과 OpenBW/BWAPI 실행 환경이 맞아야 합니다.
- worker와 API의 bucket 환경변수는 같은 저장소를 바라봐야 합니다.
- analyzer 버전 축은 `REPLAY_ANALYZER_VERSION`과 replay_analyzer 산출물 metadata가 일치하도록 관리해야 합니다.

### `Postgres`

역할:

- 운영 영속 저장소입니다.
- 게임, 플레이어, replay 업로드 이력, analyzer queue/result, snapshot 테이블을 저장합니다.

주요 테이블 축:

- `games`
- `players`
- `game_details`
- `replay_files`
- `game_analyses`
- `ranking_3v3`
- `analyzer_race_matchups`

### `Filebrowser`

현재 상태:

- Railway 상태는 `FAILED`로 확인됐습니다.
- 공개 도메인은 존재하지만, steady-state 핵심 경로는 아닙니다.

역할:

- 파일/볼륨 확인용 보조 서비스로 보입니다.
- 운영 API/대시보드/분석 pipeline의 필수 구성요소는 아닙니다.

## 변경 시 영향 범위

| 변경 대상 | 영향 |
| --- | --- |
| `stareplays/backend` API schema 변경 | API, Next 대시보드, MCP raw endpoint, snapshot job에 영향 |
| `stareplays/frontend/app-next` 변경 | 운영 웹 대시보드와 MCP raw endpoint에 영향 |
| `ranking-job` 변경 | `/rankings`, 선수 랭킹, 관련 summary에 영향 |
| `analyzer-job` 변경 | 종족 조합 승률과 팀 분석 인사이트에 영향 |
| `replay_analyzer` 변경 | 신규 분석 결과, quality report, APM/EAPM/생산 지표에 영향 |
| `openbw-bwapi-core` 변경 | replay_analyzer 이벤트/프레임 산출에 영향 |
| `openbw-core` 변경 | OpenBW 실행 결과와 bridge 이벤트에 영향 |

## 운영 확인 명령

Railway 서비스 목록:

```bash
railway status
```

Railway 서비스별 상태 요약:

```bash
railway status --json \
  | jq -r '.environments.edges[].node.serviceInstances.edges[].node
    | [.serviceName, .latestDeployment.status, (.domains.serviceDomains | map(.domain) | join(","))]
    | @tsv'
```

운영 API 확인:

```bash
curl -sS https://stareplays-production.up.railway.app/health
```

운영 Next 대시보드 확인:

```bash
curl -I https://stareplays-next-production.up.railway.app/team-analysis
curl -I https://stareplays-next-production.up.railway.app/seasons
curl -I https://stareplays-next-production.up.railway.app/rankings
```

MCP raw endpoint 확인:

```bash
curl -s https://stareplays-next-production.up.railway.app/api/team-analysis/raw \
  | jq '{schemaVersion, totalGames: .source.totalGames, seasons: .source.seasons}'
```

## 운영 원칙

- 운영 배포 기준은 `stareplays`의 `main` 브랜치입니다.
- Railway 서비스는 가능한 한 필요한 서비스만 지정해서 배포합니다.
- replay analyzer 계열 변경은 샘플 replay 회귀 비교 후 반영합니다.
- snapshot job 변경은 운영 데이터 전체 재계산 비용과 반영 지연을 고려합니다.
- MCP raw endpoint에는 팀원 공유가 가능한 분석 데이터만 포함합니다.
