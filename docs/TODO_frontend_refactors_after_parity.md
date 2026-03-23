# TODO: Frontend Refactors After Legacy Parity

목적:

- legacy behavior parity가 완료된 뒤에만 안전하게 진행할 수 있는 구조 개선 항목을 모은다.
- 지금 당장 하면 diff가 커지고 parity 검증이 어려워지는 작업만 담는다.

## 1. design token 체계 재정의

- [ ] 반복 color, border, radius, shadow, spacing을 `theme` 또는 CSS 변수로 재정의
- [ ] inline style 의존을 줄이고 Tailwind + token 조합으로 전환
- [ ] dark panel language를 전역 토큰으로 묶기

## 2. 페이지 상태 모델 재구성

- [ ] Dashboard/Vault/Analyzer의 local UI state를 더 작은 hook 또는 reducer로 분리
- [ ] selected game / selected player / tab / async state를 재사용 가능한 state machine 수준으로 승격 검토
- [ ] reset semantics를 테스트로 잠근 뒤 구조를 정리

## 3. data layer 정리

- [ ] loader / adapter / action / browser fetch helper 경계를 재검토
- [ ] API error shape, empty state, fallback 정책을 통일
- [ ] fixture fallback을 더 체계적으로 끄고 mock strategy를 분리

## 4. Analyzer 대형 파일 분해

- [ ] `match-flow`, `apm`, `economy`, `production`, `tech`, `combat`, `player panel`을 파일 단위로 분리
- [ ] page-level container는 orchestration만 맡도록 축소
- [ ] shared chart primitives와 analyzer-specific view를 분리

대상:

- [analyzer-page.tsx](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/analyzer/analyzer-page.tsx)
- [analyzer.ts](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/lib/adapters/analyzer.ts)

## 5. Dashboard / Vault 구조 재편

- [ ] 업로드 워크플로우, player query, recent games를 독립 feature slice로 분리
- [ ] Vault의 inline detail / viz / board / list를 각각 파일 책임으로 나누기

대상:

- [dashboard-page.tsx](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/dashboard/dashboard-page.tsx)
- [vault-page.tsx](/Users/seongwoo/StarProjects/stareplays/frontend/app-next/components/vault/vault-page.tsx)

## 6. 접근성 보강

- [ ] legacy parity 완료 후 keyboard semantics를 더 엄격히 조정
- [ ] aria-live, table semantics, chart summary 텍스트를 보강
- [ ] current user / selection / async status를 screen-reader 친화적으로 재표현

## 7. URL / persistence 모델 재정리

- [ ] current user, selected game, selected tab, selected player의 URL 반영 범위를 다시 결정
- [ ] cookie / query / local state 역할 분담을 명시적으로 단순화

## 8. visual system cleanup

- [ ] source exact-port 과정에서 남은 inline style을 공통 primitive 기반으로 줄이기
- [ ] typography hierarchy, icon sizing, badge spacing, row density를 토큰화

## 9. 테스트 전략 재편

- [ ] page-level snapshot 대신 interaction test 중심으로 재구성
- [ ] parity test, API mapping test, accessibility test를 층별로 분리
- [ ] 브라우저 기반 visual regression 도입 검토

## 10. 운영 문서 정리

- [ ] architecture 문서와 parity spec, implementation plan, refactor TODO를 정리
- [ ] “legacy parity 완료” 이후 유지보수 기준을 새 문서로 고정

