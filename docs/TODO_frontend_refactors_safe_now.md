# TODO: Frontend Refactors Safe To Do Now

목적:

- legacy parity 작업을 방해하지 않으면서 개발 속도와 안정성을 높이는 최소 리팩토링만 정리한다.
- 시각 결과나 상태 전이 규칙을 바꾸지 않는 범위만 포함한다.

## 원칙

- 화면 결과가 바뀌면 안 된다.
- legacy parity에 필요한 동작 추적이 더 쉬워져야 한다.
- API 경계, state reset semantics, 탭 구조는 지금 바꾸지 않는다.
- 큰 구조 변경보다 중복 제거와 파일 책임 분리가 우선이다.

## 1. 반복 style object 상수화

- [x] `#0d1833`, `#0a1428`, `rgba(34,211,238,0.1)` 같은 반복 값을 공통 상수로 승격
- [x] panel/card/header/button border style을 공통 상수로 분리
- [x] `dashboard-page.tsx`, `vault-page.tsx`, `analyzer-page.tsx`, `rankings-page.tsx`에서 동일 패턴을 같은 이름으로 정리

대상 파일:

- [dashboard-page.tsx](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/dashboard/dashboard-page.tsx)
- [vault-page.tsx](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/vault/vault-page.tsx)
- [analyzer-page.tsx](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/analyzer/analyzer-page.tsx)
- [rankings-page.tsx](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/rankings/rankings-page.tsx)

## 2. 표현 컴포넌트 분리

- [x] 500줄 이상 페이지 파일에서 pure presentation 블록만 분리
- [x] stateful container와 dumb view를 분리하되 props 구조는 유지
- [x] 분리 대상은 chart card, summary strip, board card, stat card처럼 반복되는 표현 블록 위주

우선 대상:

- [dashboard-page.tsx](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/dashboard/dashboard-page.tsx)
- [vault-page.tsx](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/vault/vault-page.tsx)
- [analyzer-page.tsx](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/analyzer/analyzer-page.tsx)

## 3. 공통 시각 primitive 통합

- [x] refresh button, current user chip, section accent, panel heading 표현을 공통 primitive로 통합
- [x] RaceBadge / ResultBadge / StatusBadge와 같은 수준의 shared primitive를 확장
- [x] 페이지마다 같은 inline style을 다시 쓰지 않도록 공통 컴포넌트로 흡수

후보 위치:

- [components/shared](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/shared)
- [components/shell](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/shell)

## 4. 차트 색상/플레이어 표현 규칙 단일화

- [x] player color resolution을 모든 차트와 deep-dive에서 같은 유틸로 사용
- [x] legend, line/bar color, player dot가 서로 다른 fallback을 쓰지 않게 정리
- [x] unknown player fallback도 deterministic rule 하나로 통일

현재 기반:

- [player-colors.ts](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/lib/utils/player-colors.ts)

## 5. 테스트의 live API 의존 제거

- [x] route-level 테스트는 fixture 기반으로 고정
- [x] live API 값, 특정 game id, 특정 순위 숫자에 묶인 assertion 제거
- [x] component test는 style/behavior, loader test는 API mapping만 검증하도록 역할 분리

대상:

- [tests](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/tests)

## 6. 문서와 TODO 동기화

- [x] legacy parity spec에서 정리한 gap과 safe-now refactor 목록을 서로 참조
- [x] 작업 시작 전 “이 리팩토링이 parity blocker를 줄이는가”를 확인하는 기준 문장 유지

## 완료 메모

- 2026-03-27 기준으로 safe-now refactor 범위는 완료되었다.
- 주요 결과는 `Analyzer/Vault/Dashboard/Rankings`의 presentation extraction과 `Panel`, `SectionAccent` primitive 실제 적용이다.
- 관련 커밋: `809945a`, `634ffaa`, `aa8d656`, `e09bac1`, `a34f43f`, `a50a73e`, `6f109ed`, `4f6e40c`

참조:

- [2026-03-24-legacy-frontend-behavior-parity-design.md](/Users/seongwoo/StarProjects/stareplays/docs/superpowers/specs/2026-03-24-legacy-frontend-behavior-parity-design.md)

## 지금 하지 말 것

- [ ] inline style을 Tailwind class로 전면 치환
- [ ] loader/adapter/state 모델 전면 재구성
- [ ] 화면 구조 자체를 더 “예쁘게” 다시 설계
- [ ] legacy reset semantics 단순화
