# Legacy Frontend Behavior Parity Design

## Goal

`frontend/web`의 실제 동작을 1순위 소스 오브 트루스로 삼아, 현재 `frontend/app-next`가 legacy UI의 상세 기능을 빠짐없이 이식할 수 있도록 행동 명세를 고정한다. 이 문서는 구현 계획이 아니라 `무엇을 그대로 옮겨야 하는지`, `무엇이 legacy quirk인지`, `무엇이 명백한 bug인지`를 구분하는 설계 문서다.

## Source Priority

1. `frontend/web`의 실제 동작
2. `docs/spec.md`
3. backend API 규칙과 실제 응답

판단 원칙:

- legacy UI에서 실제로 동작하는 behavior는 우선 보존한다.
- `docs/spec.md`와 backend API는 legacy UI가 생략하거나 단순화한 규칙을 보강하는 데 사용한다.
- 명백한 버그성 동작은 `Legacy Bug`로 분리하고 이식 대상에서 제외하거나 수정 대상으로 표기한다.

## Analysis Scope

이번 parity 분석의 범위는 다음 네 화면과 cross-page 규칙 전체다.

- `Dashboard`
- `Vault`
- `Analyzer`
- `Rankings`
- `current user`, `selected game`, `selected player`, `manual refresh`, `URL/deep-link`, `empty/error/loading`, `sorting`, `toggle`, `pagination`

## Common State Model

legacy UI는 화면이 나뉘어 있어도 실제로는 아래 다섯 상태 축으로 움직인다.

### 1. Current User

- Dashboard에서 `player query`, `parsed uploader select`, `single common participant auto-select`로 갱신된다.
- Vault, Analyzer, Rankings 조회 기준으로 전파된다.
- current user가 비어 있으면 일부 화면은 조회 대신 로그인 필요 메시지를 보여준다.

### 2. Selected Game

- Vault와 Analyzer의 중심 상태다.
- row click 또는 deep-link로 설정된다.
- game detail, 3x3 보드, analyzer status, visualization의 기준이 된다.

### 3. Selected Player

- Analyzer의 timeline, board, table, APM tab, player panel이 이 상태를 공유한다.
- 동일 player 재선택 시 clear되는 토글 규칙이 있다.
- 게임 전환 시 새 게임에 해당 player가 없으면 clear된다.

### 4. Transient Async State

- `ANALYZING ...`, `QUERYING_PLAYER...`, `FETCHING_GAME...`, `REFRESHING_ANALYZER_STATUS...` 같은 텍스트 상태
- spinner보다 텍스트/패널 치환 중심으로 표현된다.

### 5. Derived UI State

- active tab
- pagination page
- fullscreen 여부
- tech filter
- hidden APM players
- selected row highlight

## Dashboard Detailed Behavior

### Initial Render

- `previewSummary`는 초기 상태에서 `아직 파싱된 replay가 없습니다.`를 보여준다.
- `uploadResult`는 `READY`로 시작한다.
- `playerQuery`는 비어 있을 수 있다.
- `current user`가 없으면 `Recent_Games`는 조회되지 않고 로그인 필요 메시지를 보여준다.

Classification:

- `Must Port`

### Inputs and Interactions

- replay form submit은 최종 업로드가 아니라 `preview`다.
- parsed uploader select change는 즉시 `current user`를 바꾸고 `loadGames(true)`를 호출한다.
- `Query` 버튼 클릭과 input `Enter`는 같은 동작이다.
- `playerQuery` input은 280ms debounce 후 suggestion 요청을 보낸다.
- `Refresh Games`, `Refresh Rankings`는 수동 액션이다.

Classification:

- `Must Port`

### Validation Rules

- preview는 파일이 없으면 아무 요청도 보내지 않는다.
- query는 이름이 비어 있으면 아무 요청도 보내지 않는다.
- upload는 아래 순서대로 차단된다.
  - current user 없음
  - pending files 없음
  - common participant 없음
  - current user가 common participant 집합에 없음

Classification:

- `Must Port`

### Preview Request and Success Rules

- API: `POST /api/v1/games/upload/preview`
- multi-file 허용
- 성공 시:
  - `pendingFiles` 저장
  - 성공한 preview 결과들의 `parsed_players` 교집합 계산
  - parsed uploader select options 재구성
  - 로그인 유저가 교집합에 있으면 자동 선택
  - 로그인 유저가 없고 교집합이 1명뿐이면 그 유저를 current user로 자동 설정
  - preview summary에 파일별 `OK/FAIL`, map, start time, players를 렌더
  - `ANALYZE_OK: x/y files` 상태 문구 출력

핵심 규칙:

- uploader 결정 기준은 각 파일의 parsed player 합집합이 아니라 `교집합(common participant)`이다.

Classification:

- `Must Port`

### Preview Error Rules

- 실패 시 `ANALYZE_FAIL: ...`
- preview summary는 이전 상태를 유지하거나 실패 상태 로그를 별도로 남긴다.

Classification:

- `Must Port`

### Upload Request and Success Rules

- API: `POST /api/v1/games/upload`
- body:
  - `replay_files[]`
  - `uploader_name`
- 성공 시:
  - `UPLOAD_DONE: check terminal log`
  - upload summary 누적 출력
  - `loadGames()`
  - 가능한 경우 업로드된 마지막 성공 game을 자동 선택해 detail 로드

중요:

- upload 성공 후 단순 토스트로 끝나지 않고, 현재 화면 안에서 최근 게임 상세 흐름으로 이어진다.

Classification:

- `Must Port`

### Upload Error Rules

- 실패 시 `UPLOAD_FAIL: ...`
- summary terminal에 batch 실패 요약 누적

Classification:

- `Must Port`

### Player Query Rules

- query 실행은 통계 조회이면서 동시에 `current user` 전환이다.
- 순서:
  - 현재 input name trim
  - 비어 있으면 중단
  - `setCurrentUser(name)`
  - `loadGames(true)`
  - `/api/v1/players/:name/stats`
- 성공 시 player stats 패널 렌더
- 실패 시 에러 패널 렌더

Classification:

- `Must Port`

### Suggestion / Autocomplete Rules

- API: `GET /api/v1/users/suggest?q=...&limit=5`
- q가 비면 datalist 비움
- 결과는 최대 5개만 렌더
- 실패는 사용자-facing 에러 대신 log에만 남김

Classification:

- `Must Port`

### Recent Games Rules

- current user가 없으면 `LOGIN_REQUIRED: SIMPLE_LOGIN 후 Recent_Games 조회 가능`
- current user가 있으면 `/api/v1/games?limit&offset&user_name=...`
- pager는 `Page x/y`
- prev/next disabled 규칙 존재
- current user 변경이나 query는 페이지를 1로 리셋한다

Classification:

- `Must Port`

### Persistence and Navigation

- Dashboard는 사실상 current user의 origin 화면이다.
- current user는 다른 페이지 조회 기준으로 반드시 이어져야 한다.

Classification:

- `Must Port`

### Dashboard Quirks and Bugs

Legacy Quirk:

- suggestion 실패는 사용자-facing 에러 없이 log만 남긴다.
- preview success 후 로그인 유저가 교집합에 없을 때 warning은 UI보다 log 중심이다.

Legacy Bug:

- preview submit 시 파일이 없으면 사용자에게 아무 메시지도 주지 않는다.

## Vault Detailed Behavior

### Initial Render

- current user가 없으면 목록 대신 로그인 필요 메시지
- current user가 있으면 `/games` 조회
- selected game이 없으면 상세 영역은 `NO_GAME_SELECTED` 또는 유사 empty 상태

Classification:

- `Must Port`

### Games List Rules

- API: `GET /api/v1/games?limit&offset&user_name=...`
- 응답의 `games`, `total`, `analysis_statuses`를 함께 사용
- 성공 시 목록 렌더, pager 갱신
- 실패 시 목록 비우고 테이블 메시지로 에러 출력

Classification:

- `Must Port`

### Pagination Rules

- `Page x/y`
- `Prev`는 1페이지 이하일 때 disabled
- `Next`는 마지막 페이지 이상 또는 `total=0`일 때 disabled
- current user 변경 시 1페이지로 reset

Classification:

- `Must Port`

### Selected Game Flow

- row click 시 selected game 설정
- 선택 즉시:
  - row highlight
  - viewport sync
  - detail 영역 `FETCHING_GAME...`
  - highlighted player / tech focus / visualization derived state reset
- 요청:
  - `GET /api/v1/games/:id`
  - `GET /api/v1/games/:id/detail`
- 성공 시:
  - selected game board 렌더
  - `detail`
  - `analysis_status`
  - `tech_tree`
  - `unit_production`
  - `unit_production_versions`
  - `resource_spend`
  - visualization data
- 실패 시:
  - 상세 패널 에러
  - detail/visualization 파생 상태 초기화

Classification:

- `Must Port`

### 3x3 Board Rules

- legacy 의도는 `winner/loser column`보다 `starting point based 3x3 board`
- 좌표 기반 정렬이 개입한다.
- summary 메타보다 보드가 상세 영역의 중심 시각 요소다.

Classification:

- `Must Port`

### Inline Visualization Rules

- active visualization tab:
  - `apm`
  - `unitprod`
  - `spend`
  - `production`
  - `tech`
  - `battle`
  - `actions`
- fullscreen toggle 존재
- `Escape`로 fullscreen 해제
- detail fetch 실패 시 viz도 reset

Classification:

- `Must Port`

### Tech Tree Filter and Player Highlight

- tech tree summary 내부 filter button이 존재한다.
- 특정 player + kind(`tech`, `upgrade`) 조합을 focus한다.
- selected game 전환 시 관련 filter/selection은 reset된다.

Classification:

- `Must Port`

### Analyzer Navigation

- selected game이 있으면 `/analyzer.html?game_id=...`
- 없으면 `/analyzer.html`

Classification:

- `Must Port`

### Success / Empty / Error States

- no current user
- no games
- detail loading
- detail error
- no selected game

Classification:

- `Must Port`

### Vault Quirks and Bugs

Legacy Quirk:

- 상세 패널, visualization, tech filter, highlighted player reset이 강하게 묶여 있다.
- log 메시지 중심 상태 추적 비중이 높다.

Legacy Bug:

- 선택/확장 구조가 강결합돼 있어 일부 상태 변화가 과도하게 reset될 가능성이 있다.

## Analyzer Detailed Behavior

### Initial Render

- current user 기준으로 `/games?limit&page&user_name=...`
- URL의 `game_id`가 있으면 그 게임 우선 선택
- 없고 목록이 있으면 첫 게임 자동 선택
- 목록이 없으면 summary, status, player panel, inspector 모두 empty state

Classification:

- `Must Port`

### Games List and Pagination

- analyzer 전용 `page`, `pageSize=10`
- `Page x/y`
- selected row highlight
- prev/next pagination

Classification:

- `Must Port`

### Select Game Rules

- `selectedGameId` 설정
- `timelinePage=1`
- `apmHiddenPlayers={}` reset
- summary는 `LOADING_GAME...`
- analyzer status 먼저 갱신
- 요청:
  - `GET /api/v1/games/:id`
  - `GET /api/v1/games/:id/detail`
  - `GET /api/v1/games/:id/analyzer`
- 성공 시:
  - `selectedGame`
  - `selectedDetail`
  - `selectedAnalysis`
  - `pageModel`
  - URL `game_id`
- 실패 시:
  - summary error
  - analyzer status error
  - player tabs / content / panel / inspector clear

Classification:

- `Must Port`

### Analyzer Status Rules

- no selected game: `SELECT_GAME_FIRST`
- `not_requested`
- `queued`
- `running`
- `failed`
- `done`

특징:

- `queued/running`은 polling이 아니라 수동 refresh 유도 메시지
- `failed`는 `last_error`
- `done`은 headline 중심 메시지

`Refresh Status`:

- `GET /api/v1/games/:id/analyzer`만 다시 읽음
- pageModel 재구성
- 그 후 `loadGames()`도 다시 호출

Classification:

- `Must Port`

### Summary Strip Rules

- `MAP`
- `PLAY_TIME`
- `START`
- `MATCH_STORY`
- 3x3 matchup board

summary 메타와 board가 하나의 hero 영역으로 결합되어 있다.

Classification:

- `Must Port`

### Tab Rules

legacy tabs:

- `match-flow`
- `economy`
- `apm`
- `production`
- `tech`
- `combat`

동작:

- tab click 시 activeTab 변경
- `match-flow` 진입 시 `timelinePage=1`
- active/inactive class 토글

Classification:

- `Must Port`

### Selected Player Rules

- 보드, timeline, table, APM tab에서 player 선택 가능
- 같은 player 재선택 시 clear
- 새 게임에 해당 player가 없으면 clear
- selected player는 player panel과 일부 tab 내용에 직접 반영

Classification:

- `Must Port`

### Match Flow Rules

- headline card
- paginated key timeline
- team comparison
- timeline marker click -> player focus
- marker에 kind badge, side label 표시

Classification:

- `Must Port`

### APM Rules

- selected player가 없을 때:
  - 여러 player line을 동시에 표시
  - player별 hide/show toggle 가능
- selected player가 있을 때:
  - toggle보다 focus semantics가 우선

Classification:

- `Must Port`

### Economy / Production / Tech / Combat Rules

Economy:

- spend / worker / resource 계열 데이터

Production:

- 생산량과 버전/요약 표

Tech:

- tech/upgrade event와 player별 summary

Combat:

- selected player combat snapshot
- interpretation
- all players combat table

Classification:

- `Must Port`

### Workspace Event Binding Rules

렌더 후 DOM binding 대상:

- `data-player-name`
- `data-apm-toggle-player`
- `data-timeline-page`

React 이식 시 imperative DOM binding은 제거해도 되지만, 결과 UX는 보존해야 한다.

Classification:

- `Must Port`

### Player Panel Rules

No selected player:

- `All Players`
- 선택 방법 안내
- `Key Player`
- `Worst Impact`

Selected player:

- combat metrics
- spend summary
- production summary
- tech summary
- apm timeline 요약

Classification:

- `Must Port`

### Persistence and Navigation

- `game_id`는 URL에 반영
- refresh 시 우선 복원
- current user는 list query에 직접 반영

Classification:

- `Must Port`

### Analyzer Quirks and Bugs

Legacy Quirk:

- pageModel 재구성 로직이 강결합이라 refresh/selection 전환 시 reset 범위가 넓다.
- DOM re-render 후 재바인딩 방식은 구조적으로 취약하다.

Legacy Bug:

- `loadGames()`에 명시적 try/catch가 없어 목록 조회 실패 시 전역 에러로 번질 가능성이 있다.

## Rankings Detailed Behavior

### Initial Render

- current user는 localStorage에서 읽어 상단에 표시한다.
- 탭:
  - `Rankings_3v3`
  - `Race_Composition_WinRate`
- 초기 active tab은 `rankings3v3`
- 초기 로드 시 rankings와 race composition을 둘 다 fetch한다.

Classification:

- `Must Port`

### Rankings 3v3 Rules

- API: `GET /api/v1/rankings/3v3?limit=100`
- legacy는 서버 paging/query params를 적극 쓰지 않고, 100개를 받아 client-side sorting을 한다.
- current user row는 highlight + `YOU` chip

Client-side sort:

- `win_rate`
- `avg_apm`
- `avg_eapm`

정렬 토글 규칙:

- 같은 컬럼 재클릭 시 asc/desc toggle
- 다른 컬럼 클릭 시 해당 컬럼으로 전환하고 desc로 reset
- arrow indicator:
  - active descending `▼`
  - active ascending `▲`
  - inactive `↕`

tie-break:

- `win_rate` 정렬 시:
  - wins
  - games
  - name
- `avg_apm`, `avg_eapm` 정렬 시:
  - name

랭크 번호는 정렬 결과 기준으로 다시 계산한다.

Classification:

- `Must Port`

### Rankings Empty / Error Rules

- 빈 목록이면 `NO_3V3_RANKINGS`
- 실패 시 `ERROR_LOAD_RANKINGS: ...`

Classification:

- `Must Port`

### Race Composition Rules

- API: `GET /api/v1/analyzer/race-matchups?team_size=3&limit=300`
- meta line:
  - `TEAM_SIZE: 3v3`
  - `QUALIFIED_GAMES`
  - `ROWS`

client-side sort:

- `games`
- `team_a_win_rate`

정렬 토글 규칙:

- 같은 컬럼 재클릭 시 asc/desc toggle
- 다른 컬럼 클릭 시 해당 컬럼으로 전환하고 desc로 reset
- arrow indicator 규칙 동일

tie-break:

- `games` 정렬 시 `team_a_win_rate`, then matchup text
- `team_a_win_rate` 정렬 시 `games`, then matchup text

빈 상태:

- `NO_MATCHUP_DATA`

실패 상태:

- raceCompMeta에 `ERROR_LOAD_ANALYZER: ...`
- 테이블은 empty 상태 렌더

Classification:

- `Must Port`

### Persistence Rules

- active tab은 in-memory only
- current user는 localStorage 기반 표시
- rankings sorting state도 in-memory only

Classification:

- `Should Port`

### Rankings Quirks and Bugs

Legacy Quirk:

- API는 paging/sorting query를 지원하지만 legacy UI는 대부분 client-side sorting에 의존한다.
- page reload 시 active tab과 sort state는 유지되지 않는다.

Legacy Bug:

- 없음으로 간주. 현재 확인된 동작은 단순하지만 일관적이다.

## Cross-Page Rules

### Current User Propagation

- Dashboard에서 바뀐 current user는 Vault, Analyzer, Rankings에 전파되어야 한다.
- legacy는 주로 `localStorage`를 사용한다.
- Next 이식에서는 URL/cookie 보조를 써도 되지만 사용자 관점 동작은 동일해야 한다.

Classification:

- `Must Port`

### Selected Game Deep-Link

- Vault에서 Analyzer 이동 시 `game_id`
- Analyzer는 URL의 `game_id`를 최우선 복원

Classification:

- `Must Port`

### Manual Refresh Only

- analyzer polling 없음
- refresh는 모두 사용자 액션

Classification:

- `Must Port`

### Text-First Async Feedback

- loading/error/success는 spinner보다 텍스트 중심

예:

- `FETCHING_GAME...`
- `QUERYING_PLAYER...`
- `REFRESHING_ANALYZER_STATUS...`

Classification:

- `Should Port`

### Reset Semantics

- current user 변경 -> games page reset
- game 변경 -> 일부 detail/viz/player state reset
- analyzer `match-flow` 탭 진입 -> timeline page reset
- player 재선택 -> clear

Classification:

- `Must Port`

## Legacy Quirk / Bug Summary

### Legacy Quirk

- suggestion 실패는 사용자에게 노출되지 않고 log만 남음
- preview warning도 log 중심
- Vault와 Analyzer는 reset 범위가 넓고 결합도가 높음
- Rankings는 API sorting/paging을 두고도 client-side sorting 중심
- active tab / sort state / 일부 selection은 reload 후 유지되지 않음

### Legacy Bug

- Dashboard preview에서 파일이 없을 때 명시적 피드백 없음
- Analyzer `loadGames()`는 fetch 실패를 명시적으로 처리하지 않아 전역 에러로 번질 가능성 있음
- Vault의 일부 selection/reset 동작은 필요 이상으로 과격하게 초기화될 수 있음

## Next App Gap Checklist

이 섹션은 현재 `frontend/app-next` 기준에서 확인된 parity gap을 정리한다.

### Dashboard

- [x] preview upload
- [x] common participant 기반 uploader validation
- [x] final upload
- [x] player query
- [x] current user persistence
- [x] user suggestion debounce/fetch
- [ ] legacy terminal-style preview/upload summary를 더 정확히 복원
- [ ] blank preview/query의 무반응 규칙을 그대로 가져갈지 대체 UX로 보완할지 결정

### Vault

- [x] current user 기준 games fetch
- [x] selected game detail fetch
- [x] 3x3 board 중심 상세 구조
- [x] analyzer deep-link
- [x] APM timeline live hydration
- [ ] legacy inline viz tabs 전체(`unitprod`, `spend`, `production`, `tech`, `battle`, `actions`) parity
- [ ] fullscreen toggle parity
- [ ] tech tree filter / highlighted player parity

### Analyzer

- [x] current user + gameId 기반 game selection
- [x] detail/analyzer fetch
- [x] manual refresh / reanalyze
- [x] selected player 기본 포커스 흐름 일부
- [ ] legacy tab set parity (`economy`, `production`, `combat`)
- [ ] selected player panel parity
- [ ] APM hide/show toggle parity
- [ ] match-flow marker/table click semantics parity
- [ ] text-first async feedback 문구 parity

### Rankings

- [x] rankings / race composition fetch
- [x] tab switching
- [ ] legacy sort button + arrow semantics parity
- [ ] current user local highlight semantics parity
- [ ] rankings/race-comp error 문구 parity
- [ ] client-side sort tie-break parity

### Cross-Page

- [x] current user propagation
- [x] Vault -> Analyzer deep-link
- [x] manual refresh model
- [ ] legacy reset semantics를 더 세밀하게 일치시킬 필요 있음

## Recommended Execution Order

1. `Dashboard`의 terminal-style preview/upload/query 상태 문구 parity
2. `Vault` inline viz parity
3. `Analyzer` tab set / selected player / APM toggle parity
4. `Rankings` sort/arrow/client-side semantics parity
5. `Legacy Bug` 항목 중 보존하지 않을 항목을 명시적으로 결정

