# StaReplays Frontend Next Architecture

## Scope

이 문서는 `frontend/app-next` 기준의 현재 프런트엔드 구조를 설명한다.  
백엔드는 기존 Fiber 서버를 유지하고, 운영 웹 대시보드는 Railway `stareplays-next` 서비스의 Next.js 앱이 담당한다.
`frontend/web`은 legacy 동작과 표현을 참고하기 위한 기준으로 남아 있다.

## Goals

- 운영 대시보드 화면을 유지보수 가능한 컴포넌트 구조로 제공
- legacy `frontend/web`의 상세 동작을 Next 구조 안에서 parity 수준으로 복원
- 서버 라우트에서 데이터 로딩을 먼저 수행하고, 상호작용이 필요한 영역만 클라이언트 컴포넌트로 분리
- Fiber API 계약은 유지하되, 프런트 내부에서는 안정적인 page model로 변환해서 사용
- API-first 동작을 기본으로 하되, 실제 장애 시에만 fixture fallback으로 화면을 유지
- 팀 분석/시즌/MCP raw endpoint까지 같은 loader/adapter/page model 구조로 유지

## Route Structure

주요 App Router 엔트리:

- `/` -> [app/page.tsx](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/app/page.tsx)
- `/vault` -> [app/vault/page.tsx](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/app/vault/page.tsx)
- `/analyzer` -> [app/analyzer/page.tsx](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/app/analyzer/page.tsx)
- `/rankings` -> [app/rankings/page.tsx](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/app/rankings/page.tsx)
- `/team-analysis` -> [app/team-analysis/page.tsx](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/app/team-analysis/page.tsx)
- `/seasons` -> [app/seasons/page.tsx](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/app/seasons/page.tsx)
- `/seasons/[season]` -> [app/seasons/[season]/page.tsx](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/app/seasons/[season]/page.tsx)
- `/api/team-analysis/raw` -> [app/api/team-analysis/raw/route.ts](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/app/api/team-analysis/raw/route.ts)

공통 셸은 [app/layout.tsx](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/app/layout.tsx)에서 제공한다.

## Component Layers

구조는 크게 네 층으로 나뉜다.

1. Shell
- `components/shell/*`
- 헤더, 네비게이션, 페이지 컨테이너 등 앱 공통 프레임 담당

2. Shared primitives
- `components/shared/*`
- badge, metric card, section header, empty/loading/error state 같은 재사용 단위

3. Feature pages
- `components/dashboard/*`
- `components/vault/*`
- `components/analyzer/*`
- `components/rankings/*`
- `components/team-analysis/*`
- `components/seasons/*`
- page container와 extracted presentation component를 함께 둔다
- 현재 extracted components 예시:
  - analyzer: `analyzer-summary-strip.tsx`, `analyzer-tabs.tsx`, `analyzer-player-deep-dive.tsx`
  - vault: `vault-detail-panel.tsx`, `vault-game-row.tsx`
  - dashboard: `dashboard-stat-card.tsx`, `dashboard-stats-table.tsx`
  - rankings: `rankings-tables.tsx`
  - team-analysis: `team-analysis-page.tsx`
  - seasons: `season-analysis-page.tsx`

4. Route entry
- `app/*/page.tsx`
- 각 라우트에서 loader를 호출해 page model을 준비하고, feature component에 전달

## Data Boundary

핵심 원칙은 `route -> loader -> adapter -> page model -> component`다.

### 1. Loaders

위치:

- `lib/loaders/dashboard.ts`
- `lib/loaders/vault.ts`
- `lib/loaders/analyzer.ts`
- `lib/loaders/rankings.ts`
- `lib/loaders/team-analysis.ts`

책임:

- Fiber API 호출
- 여러 엔드포인트 병합
- request cookie와 route query에서 현재 사용자를 해석
- 실패 시 `null` 처리 후 fallback 여부를 판단
- adapter에 raw payload 전달

### 2. API client

위치:

- [lib/api/client.ts](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/lib/api/client.ts)
- [lib/api/actions.ts](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/lib/api/actions.ts)
- [lib/utils/current-user-session.ts](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/lib/utils/current-user-session.ts)
- [lib/utils/request-context.ts](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/lib/utils/request-context.ts)

책임:

- API base URL 해석
- 공통 fetch 래퍼 제공
- `fetchApiJson`, `tryFetchApiJson` 제공
- replay preview/upload, analyzer reanalyze 같은 write action 제공
- `current user` cookie read/write 유틸 제공

### 3. Raw API types

위치:

- [types/api.ts](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/types/api.ts)

책임:

- Fiber 응답 shape를 프런트 타입으로 명시
- page component에서 raw payload를 직접 읽지 않도록 경계 제공

### 4. Adapters

위치:

- `lib/adapters/dashboard.ts`
- `lib/adapters/vault.ts`
- `lib/adapters/analyzer.ts`
- `lib/adapters/rankings.ts`
- `lib/adapters/team-analysis.ts`
- `lib/adapters/team-analysis-raw.ts`
- `lib/adapters/season-analysis.ts`

책임:

- raw API 응답을 Figma UI가 소비하는 page model로 변환
- 현재 사용자 기준의 perspective 적용
- metric, matchup, summary, timeline 같은 파생 값 생성

## Fixtures And Fallback

위치:

- `lib/fixtures/*`

역할:

- 백엔드 장애 시에도 4개 페이지를 렌더링 가능하게 유지
- 백엔드 장애 시에도 핵심 페이지를 렌더링 가능하게 유지
- API 연동 작업과 UI 작업을 분리
- loader가 실제 API 접근에 실패했을 때만 fixture 기반 model로 fallback

현재 fallback은 다음 시나리오를 커버한다.

- Fiber 서버가 실행되지 않음
- 읽기 엔드포인트가 네트워크 오류 또는 서버 오류를 반환함
- analyzer detail/analyzer 응답의 일부 섹션이 비어 있으면, 해당 insight 영역만 fixture 기반 파생값으로 보강함

정상 동작 경로에서는 fixture를 사용하지 않는다.

## Current User Persistence

`current user`는 프런트 전체에서 공유되는 세션 개념으로 취급한다.

- route query에 `currentUser`가 있으면 그것을 우선 사용하고, 없을 때 request cookie를 사용한다
- Dashboard는 legacy와 맞추기 위해 localStorage의 `stareplays_current_user`도 mount 시 복원한다
- deep-link가 필요한 경로는 query param의 `currentUser`를 함께 유지한다
- Dashboard의 preview/upload/query 액션은 성공 시 동일한 cookie 상태를 갱신한다
- Shell navigation은 현재 사용자 query를 유지해서 페이지 이동 중 context 손실을 막는다

이 구조 덕분에 App Router의 서버 렌더와 클라이언트 상호작용이 같은 사용자 기준을 유지한다.

legacy parity 기준의 추가 규칙:

- Dashboard는 `localStorage`에 저장된 마지막 current user를 초기 복원할 수 있다
- Dashboard의 preview uploader 선택, player query, upload 성공은 모두 current user를 cookie와 query에 동기화한다
- App shell navigation은 현재 query의 `currentUser`를 유지해서 페이지 간 이동 중 context 손실을 막는다

## Write Flows

현재 프런트는 읽기 전용이 아니라, 레거시에서 사용하던 핵심 쓰기 액션도 복원했다.

### Dashboard

- `POST /api/v1/games/upload/preview`
- `POST /api/v1/games/upload`
- parsed player 기준 current user 선택
- player stats query와 user suggest 재조회
- legacy-style terminal summary와 mismatch validation 복원
- legacy `NO_PREVIEW`, common-player 교집합, mismatch upload 차단, preview failure stale-state 유지 복원

### Analyzer

- `POST /api/v1/analyzer/reanalyze`
- polling 없이 수동 새로고침으로 최신 상태를 확인
- `Refresh analyzer status`는 사용자가 명시적으로 눌렀을 때만 실행된다

### Raw endpoint

- `GET /api/team-analysis/raw`
- `GET /api/team-analysis/raw?season_label=시즌7`
- MCP/LLM 분석용 JSON을 제공한다
- 현재 인증 없이 접근 가능하므로 민감 데이터가 포함되지 않도록 관리한다

## Deep-Link Behavior

- `Vault`의 각 row는 `gameId`를 포함한 `Analyzer` 링크를 제공한다
- `Analyzer`는 route query의 `gameId`를 우선 사용해 초기 선택 게임을 결정한다
- `Analyzer` loader는 현재 `limit=12` 고정 목록을 먼저 읽고, query로 지정된 `gameId`가 그 목록 안에 있을 때 해당 게임을 즉시 선택한다
- Vault/Analyzer 모두 legacy 의도대로 `winner/loser 컬럼`보다 `스타팅 포인트 기반 3x3 보드`를 중심 시각 요소로 사용한다
- `Vault` row는 legacy처럼 re-click collapse가 가능하고, 상세는 선택 전까지 숨겨진다

## Analyzer Structure

Analyzer는 현재 가장 복잡한 화면이며, 다음 흐름으로 구성된다.

1. `loadAnalyzerPageModel`
- `/api/v1/games`
- `/api/v1/games/:id/detail`
- `/api/v1/games/:id/analyzer`
를 호출한다.

2. `createAnalyzerPageModel`
- 게임 목록을 vault model로 먼저 정규화
- 각 게임별 insight를 `insightsByGameId`에 구축
- route query의 `gameId`를 반영해 초기 선택을 고정
- 선택 게임 변경 시 같은 페이지 모델 안에서 즉시 전환 가능하게 유지

3. 현재 Analyzer 탭
- `Match Flow`
- `Economy`
- `APM`
- `Production`
- `Tech`
- `Combat`

4. 현재 Analyzer 액션
- manual refresh
- manual reanalyze
- no polling
- match-flow pager reset, selected-player 유지/해제, legacy 탭 세트 복원

선택 게임 전환 시에는 legacy reset semantics를 따른다.

- match-flow pager reset
- apm hidden player reset
- selected-player는 source behavior에 맞게 가능한 경우 유지
- status는 수동 refresh 전까지 마지막 렌더 상태를 유지

## Current API Usage

현재 프런트가 직접 사용하는 주요 Fiber 엔드포인트:

- `GET /api/v1/rankings/3v3`
- `GET /api/v1/analyzer/race-matchups`
- `GET /api/v1/games`
- `GET /api/v1/games/:id/detail`
- `GET /api/v1/games/:id/analyzer`
- `GET /api/v1/players/:name/stats`
- `GET /api/v1/users/suggest`
- `GET /api/v1/seasons`
- `POST /api/v1/games/upload/preview`
- `POST /api/v1/games/upload`
- `POST /api/v1/analyzer/reanalyze`
- `PUT /api/v1/seasons/current`
- `PUT /api/v1/games/:id/season`

Next route:

- `GET /api/team-analysis/raw`

## Testing Strategy

테스트는 세 층으로 유지한다.

1. Adapter tests
- fixture/page model 변환 검증

2. Loader tests
- mock fetch로 실제 API shape를 넣고 page model 생성 검증

3. Page interaction tests
- legacy parity 규칙을 page-level interaction test로 잠금
- current user propagation, gameId deep-link, no-polling manual refresh, row re-click collapse, APM hide/show 같은 규칙을 직접 검증
- Dashboard preview/upload/query
- Vault row select/re-click collapse
- Analyzer tab/refresh/reanalyze/no-polling
- Rankings sort/tie-break/empty-error copy
- Team Analysis adapter/raw payload
- Season Analysis adapter/page model

관련 테스트 위치:

- `tests/api-loaders.test.ts`
- `tests/*-adapter.test.ts`
- `tests/*-page.test.tsx`

## Safe-Now Refactor Scope

parity 작업 중에는 아래 수준까지만 리팩토링했다.

- 반복 panel/card/border style 상수를 [ui-styles.ts](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/lib/constants/ui-styles.ts)로 승격
- player color fallback 규칙을 [player-colors.ts](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/lib/utils/player-colors.ts)로 단일화
- [panel.tsx](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/shared/panel.tsx), [section-accent.tsx](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/shared/section-accent.tsx) 같은 shared primitive를 추가하고 extracted view에 실제 적용
- page container/state ownership은 그대로 유지하면서 page-level presentation extraction 수행

아래는 의도적으로 미뤘다.

- design token 전면 재정의
- large page file 대분해
- loader/adapter/state model 재설계

## Operational Notes

- 개발 포트: Next `3100`, Fiber `3000`
- 환경 변수 예시는 `frontend/app-next/.env.example`
- standalone typecheck는 Next가 `.next/types`를 자동 수정하는 문제를 피하려고 `tsconfig.typecheck.json`을 사용한다
- 반복 panel style 상수는 `lib/constants/ui-styles.ts`에 모아 safe-now refactor 범위로 관리한다

## Remaining TODO

- analyzer player deep dive에 실제 `tech_tree`, `resource_spend`, `unit_production` 상세 값을 더 노출
- API 선로딩 범위를 필요 시 선택 기반 fetch로 최적화
- 공용 design token과 메타데이터 정책을 더 문서화
- upload 성공 후 후속 이동 UX를 더 세분화
- 대형 페이지 파일 분해와 token 정비는 parity 이후 리팩토링으로 유지
