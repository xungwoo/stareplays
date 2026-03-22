# StaReplays Frontend Next Architecture

## Scope

이 문서는 `frontend/app-next` 기준의 현재 프런트엔드 구조를 설명한다.  
백엔드는 기존 Fiber 서버를 유지하고, Next.js 프런트가 별도 포트에서 병행 실행되는 구성을 전제로 한다.

## Goals

- Figma 기준의 4개 화면을 유지보수 가능한 컴포넌트 구조로 제공
- 서버 라우트에서 데이터 로딩을 먼저 수행하고, 상호작용이 필요한 영역만 클라이언트 컴포넌트로 분리
- Fiber API 계약은 유지하되, 프런트 내부에서는 안정적인 page model로 변환해서 사용
- API가 비어 있거나 실패해도 Figma 기반 UI를 확인할 수 있도록 fixture fallback 유지

## Route Structure

주요 App Router 엔트리:

- `/` -> [app/page.tsx](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/app/page.tsx)
- `/vault` -> [app/vault/page.tsx](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/app/vault/page.tsx)
- `/analyzer` -> [app/analyzer/page.tsx](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/app/analyzer/page.tsx)
- `/rankings` -> [app/rankings/page.tsx](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/app/rankings/page.tsx)

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

책임:

- Fiber API 호출
- 여러 엔드포인트 병합
- 실패 시 `null` 처리
- adapter에 raw payload 전달

### 2. API client

위치:

- [lib/api/client.ts](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/lib/api/client.ts)

책임:

- API base URL 해석
- 공통 fetch 래퍼 제공
- `fetchApiJson`, `tryFetchApiJson` 제공

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

책임:

- raw API 응답을 Figma UI가 소비하는 page model로 변환
- 현재 사용자 기준의 perspective 적용
- metric, matchup, summary, timeline 같은 파생 값 생성

## Fixtures And Fallback

위치:

- `lib/fixtures/*`

역할:

- API 미연결 상태에서도 4개 페이지를 렌더링 가능하게 유지
- 디자인 구현과 데이터 구현을 분리
- loader가 전체 실패 시 fixture 기반 model로 fallback

현재 fallback은 다음 시나리오를 커버한다.

- Fiber 서버가 실행되지 않음
- 특정 엔드포인트가 아직 비어 있음
- analyzer detail/analyzer 응답이 부분적으로 누락됨

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
- 선택 게임 변경 시 같은 페이지 모델 안에서 즉시 전환 가능하게 유지

3. 현재 Analyzer 탭
- `Match Flow`
- `APM`
- `Resource Spend`
- `Unit Production`
- `Tech / Upgrade`

`Battle Intensity`는 현재 구조에서 제거되었다.  
이 값은 실제 제품 기준으로 해석 신뢰도가 낮고, 현재 UI 우선순위 대비 독립적인 의미를 제공하지 못한다고 판단했다.

## Current API Usage

현재 프런트가 직접 사용하는 주요 Fiber 엔드포인트:

- `GET /api/v1/rankings/3v3`
- `GET /api/v1/analyzer/race-matchups`
- `GET /api/v1/games`
- `GET /api/v1/games/:id/detail`
- `GET /api/v1/games/:id/analyzer`
- `GET /api/v1/players/:name/stats`
- `GET /api/v1/users/suggest`

## Testing Strategy

테스트는 세 층으로 유지한다.

1. Adapter tests
- fixture/page model 변환 검증

2. Loader tests
- mock fetch로 실제 API shape를 넣고 page model 생성 검증

3. Page tests
- 주요 인터랙션과 화면 렌더링 확인

관련 테스트 위치:

- `tests/api-loaders.test.ts`
- `tests/*-adapter.test.ts`
- `tests/*-page.test.tsx`

## Operational Notes

- 개발 포트: Next `3100`, Fiber `3000`
- 환경 변수 예시는 `frontend/app-next/.env.example`
- standalone typecheck는 Next가 `.next/types`를 자동 수정하는 문제를 피하려고 `tsconfig.typecheck.json`을 사용한다

## Remaining TODO

- analyzer player deep dive에 실제 `tech_tree`, `resource_spend`, `unit_production` 상세 값을 더 노출
- API 선로딩 범위를 필요 시 선택 기반 fetch로 최적화
- 공용 design token과 메타데이터 정책을 더 문서화
