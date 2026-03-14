# TODO Game Analyzer Rebuild (Replay Analyzer 기반)

## 목적

- 기존 `game_analyzer`의 workbench 구조는 유지하고, 그 안의 콘텐츠를 `replay_analyzer` 기반으로 재구성한다.
- `replay_analyzer` 통합 결과와 기존 `game_detail` 파생 데이터를 결합해, 유저가 이해하기 쉬운 "게임 해석" 중심 화면을 만든다.
- 내부 검증용 품질 지표(`quality_report`, coverage, warnings)는 기본 UI의 주인공이 아니다.
- 유저에게는 "게임 흐름", "승패에 영향을 준 장면", "플레이어별 스타일과 선택"을 보여준다.

## 현재 기준

- 운영 UI 기준은 `frontend/web`
- `frontend/app-next` 전환은 별도 작업
- 현재 방향은 `old layout + new data`다
- 즉 `Game Selector / Top Summary Strip / Timeline Workspace / Player Deep Dive / Event Inspector` 구조를 유지한다
- 이 문서는 그 workbench 안에 어떤 데이터를 어떤 우선순위로 넣을지 정리한다

## 데이터 소스

### 1. `GET /api/v1/games/:id/detail`

현재 확보 데이터:

- `tech_tree`
  - tech / upgrade / prereq building 이벤트
  - frame / second
  - cancel / inefficiency 여부
- `unit_production`
  - player별 생산량 timeline
  - worker / army / tech_unit 요약
  - unit별 생산량 요약
- `resource_spend`
  - player별 mineral / gas / total spend timeline
  - build / production / tech / upgrade 카테고리별 요약
- `apm_timeline`
  - player별 APM 변화
- `chat_messages`

### 2. `GET /api/v1/games/:id/analyzer`

현재 확보 데이터:

- `summary`
  - team별 kills / deaths
  - player별 final:
    - kills / deaths / kdr
    - kills_by_zone / deaths_by_zone
    - kd_attribution_breakdown
    - self_deaths / friendly_fire_kills / unattributed_deaths
    - supply_peak_used / worker_peak / tower_peak
    - vision_score_final / enemy_zone_coverage
- `analysis_phase`
  - winner_team_candidate
  - winner_team_source
  - applied
  - confidence
  - reasons / signals / thresholds

## 설계 원칙

1. 품질 검증 데이터는 숨기고 해석 결과만 보여준다
- `overall_confidence`, `metric_confidence`, `coverage`, `warnings`는 기본 메인 UI에서 직접 노출하지 않는다
- 필요하면 향후 운영자 전용 디버그 패널로 분리한다

2. "숫자 나열"보다 "해석 단위"를 만든다
- 단순 K/D, 생산량, 자원 소모를 카드/차트로만 뿌리지 않는다
- "언제 격차가 벌어졌는가", "누가 어떤 역할을 했는가", "어떤 선택이 승패를 갈랐는가"를 묶어서 보여준다

3. 현재 저장된 payload로 가능한 것과 불가능한 것을 명확히 구분한다
- 현재 요약 데이터만으로 안 되는 항목은 억지로 추정하지 않는다
- 필요한 추가 analyzer 산출물이 있으면 2차 작업으로 분리한다

## 1차 목표 정보구조

## A. 게임 전체 해설

### A-1. Match Story Header

표시 내용:

- 승리 팀 후보
- 실제 팀별 `kills / deaths`
- 경기 길이
- 맵
- 참가 플레이어

해석 문구 예시:

- "초반은 비슷했지만, 중반 이후 팀 2가 생산력 우위를 유지하며 킬 교환에서 크게 앞섰다."
- "팀 1은 높은 킬 관여를 보인 핵심 플레이어가 있었지만, 팀 전체 worker/vision 관리에서 밀렸다."

구현 근거:

- `summary.teams`
- `summary.players[].final`
- `game` 기본 메타

### A-2. Match Verdict Panel

표시 내용:

- `winner_team_candidate`
- `winner_team_source`
- `analysis_phase.reasons`

표현 원칙:

- `applied=false`면 "최종 판정 확정"처럼 쓰지 않는다
- "분석기는 팀 2 우세로 해석" 같은 서술형으로 표현

구현 근거:

- `analysis_phase`

## B. 게임 흐름 Timeline

이 섹션이 새 페이지의 핵심이다.

### B-1. 1차 구현: 현재 데이터로 바로 가능한 타임라인 이벤트

#### 1. high level tech unit 등장 시점

표시 방식:

- player별 tech unit 첫 등장 시점을 timeline marker로 표시
- 예: `Shuttle`, `Science Vessel`, `Defiler`, `Arbiter`, `Carrier`, `Ultralisk`

구현 근거:

- `unit_production.summaries[].by_unit`
- `unit_production.timelines`
- `tech_tree.events`

#### 2. 핵심 tech / upgrade / prereq building 도달 시점

표시 방식:

- `Academy`, `Cybernetics Core`, `Citadel`, `Templar Archives`, `Science Facility`, `Defiler Mound` 등
- 업그레이드/테크 완성 타이밍을 팀별 비교

구현 근거:

- `tech_tree.events`

#### 3. 상대 적진 방어타워 진출 시도

현재 상태:

- "상대 적진에 방어타워 건설 성공"은 현재 저장 payload만으로 직접 판정하기 어렵다
- build order에는 건설 이벤트가 있지만 위치/진영 판정 정보가 없다

1차 처리:

- TODO로 유지
- 현재는 구현하지 않음

2차 필요 데이터:

- 건설 이벤트 위치
- zone classification

#### 4. 정찰 성공 이벤트

현재 상태:

- "누가 어디를 정찰했는지"를 지금 저장된 payload만으로 직접 복원하기 어렵다
- 현재 있는 것은 `vision_score_final`, `enemy_zone_coverage` 같은 최종 요약값뿐이다

1차 처리:

- player 카드의 "정찰 기여" 요약으로만 제한
- timeline event로는 보류

2차 필요 데이터:

- vision / location timeline
- scout path 또는 enemy zone entry 이벤트

### B-2. 2차 구현: analyzer 산출물 확장 후 가능한 타임라인 이벤트

#### 1. worker 수 급감 이벤트

현재 상태:

- 현재 저장값은 `worker_peak`뿐이어서 "급감 시점"은 계산 불가

필요 데이터:

- player/team별 worker alive timeline

#### 2. 대규모 전투 이벤트

현재 상태:

- 현재 저장값은 최종 `kills / deaths` 요약이라 특정 시점 전투를 재구성할 수 없다

필요 데이터:

- combat cluster timeline
- frame 구간별 casualties
- 참여 player / team

#### 3. 전투 참여도

현재 상태:

- 현재는 final summary 기준 관여 비율 정도만 간접 추정 가능
- 특정 전투 참여도는 불가

필요 데이터:

- battle-scoped participant set
- player별 damage / kill / spell / supply contribution

## C. 팀 비교 섹션

### C-1. 팀 전력 비교

표시 내용:

- 팀별 총 kills / deaths
- 팀별 peak supply 합
- 팀별 peak worker 합
- 팀별 vision score 합

구현 근거:

- `summary.teams`
- `summary.players[].final`

### C-2. 팀 운영 성향 비교

표시 내용:

- 자원 소비 총량
- tech / upgrade 투자 비중
- army 생산 집중도

구현 근거:

- `resource_spend.summaries`
- `unit_production.summaries`
- `tech_tree.summary`

## D. 플레이어별 분석

### D-1. Player Summary Card

표시 내용:

- K / D / KDR
- peak supply
- peak worker
- peak tower
- vision score
- enemy zone coverage

구현 근거:

- `summary.players[].final`

## 페이지 정보구조(IA)

페이지는 "하나의 경기 스토리"를 위에서 아래로 읽게 만드는 구조로 간다.

### 최상위 섹션 순서

1. `Hero Summary`
- 경기 한 줄 요약
- 승패 해석
- 팀 비교 핵심 숫자

2. `Match Timeline`
- 경기 전체 흐름에서 중요한 전환점을 시간순으로 표시
- 1차에서는 tech / upgrade / prereq / high-tech-unit 위주

3. `Team Comparison`
- 팀 대 팀 운영/전투 비교
- 팀별 자원, 생산, peak 지표 비교

4. `Player Gallery`
- 플레이어 카드 목록
- 카드 클릭 시 하단 상세 분석 패널 전환

5. `Player Deep Dive`
- 선택 플레이어의 build / production / economy / combat 해설

6. `Optional Evidence Drawer`
- 원하면 접어서 보는 근거 패널
- 1차에서는 기본 숨김

### 탐색 방식

- 페이지 상단에서 경기 전체를 먼저 이해
- timeline에서 어떤 전환점이 있었는지 파악
- 팀 비교로 전체 구도를 확인
- 플레이어 카드를 눌러 개인별 분석으로 내려감

### 선택 상태

- 기본 선택 플레이어:
  - 승리 팀 핵심 플레이어 1명
  - 없으면 첫 번째 player
- timeline marker 클릭 시:
  - 관련 player 자동 선택
  - 해당 player deep dive 섹션으로 스크롤

## 텍스트 와이어프레임

### Desktop

```text
+----------------------------------------------------------------------------------+
| Game Analyzer                                                                    |
| [Map] [Duration] [Matchup] [Team 1 vs Team 2]                                    |
| "초반은 팽팽했지만, 팀 2가 중반 이후 생산 전환과 시야 장악에서 우위를 만들었다."      |
| [Verdict: Team 2 우세] [Kills 8:0] [Deaths 5:8] [Key reason tags...]             |
+----------------------------------------------------------------------------------+
| Match Timeline                                                                   |
| 00:40 Barracks / Gateway / Hatchery ...                                          |
| 03:20 Cybernetics Core / Academy                                                 |
| 05:10 Templar Archives 등장                                                      |
| 06:05 Science Vessel 첫 등장                                                    |
| 08:00 Carrier/Defiler 등 high-tech unit marker                                   |
+--------------------------------------+-------------------------------------------+
| Team Comparison                      | Selected Player Card                       |
| - total kills/deaths                 | Name / Team / Race                         |
| - total spend by category            | K/D/KDR                                    |
| - worker peak sum                    | Supply peak / Worker peak / Vision         |
| - vision score sum                   | Short interpretation                       |
+----------------------------------------------------------------------------------+
| Player Gallery                                                                    |
| [Player A] [Player B] [Player C] [Player D] [Player E] [Player F]                |
+----------------------------------------------------------------------------------+
| Player Deep Dive: Player A                                                        |
| [Build Timeline]                                                                  |
| [Economy & Production Timeline]                                                   |
| [Combat Outcome Summary]                                                          |
| [Interpretation Blocks]                                                           |
+----------------------------------------------------------------------------------+
```

### Mobile

```text
[Hero Summary]
[Verdict]
[Match Timeline]
[Team Comparison]
[Player chips]
[Selected Player Summary]
[Build Timeline]
[Economy & Production Timeline]
[Combat Outcome Summary]
```

모바일 원칙:

- 팀 비교와 플레이어 카드를 세로 스택으로 전환
- timeline marker 설명은 bottom sheet 또는 expandable row로 처리
- 1차에서는 복잡한 multi-chart 동시 노출보다 섹션 분리를 우선

## 섹션별 데이터 매핑

### 1. Hero Summary

입력 데이터:

- `game`
- `analysis.summary.teams`
- `analysis.summary.players`
- `analysis.analysis_phase`

파생 값:

- 승리팀 후보 텍스트
- 팀별 kill-death diff
- 핵심 플레이어 후보
- 한 줄 해설

### 2. Match Timeline

입력 데이터:

- `detail.tech_tree.events`
- `detail.unit_production.timelines`
- `detail.unit_production.summaries`

파생 값:

- tech milestone markers
- prereq building milestones
- high-tech unit first appearance markers
- player / team 태그

### 3. Team Comparison

입력 데이터:

- `analysis.summary.teams`
- `analysis.summary.players`
- `detail.resource_spend.summaries`
- `detail.unit_production.summaries`
- `detail.tech_tree.summary`

파생 값:

- team aggregate spend
- team aggregate worker peak / supply peak / vision score
- team tech intensity
- team army production intensity

### 4. Player Gallery

입력 데이터:

- `game.players`
- `analysis.summary.players`
- `detail.unit_production.summaries`

파생 값:

- 카드 서브타이틀
- 역할 후보 태그
- 팀 내 상대 비교 배지

### 5. Player Deep Dive

입력 데이터:

- `detail.tech_tree.events`
- `detail.resource_spend.timelines`
- `detail.resource_spend.summaries`
- `detail.unit_production.timelines`
- `detail.unit_production.summaries`
- `detail.apm_timeline`
- `analysis.summary.players[].final`

파생 값:

- build order milestones
- economy curve
- production curve
- combat zone summary
- short interpretation sentences

## 파생 데이터 레이어 설계

UI에서 raw payload를 직접 읽지 말고, page-specific selector를 만든다.

### 추천 selector

1. `buildGameAnalyzerPageModel(game, detail, analyzer)`
- 페이지 전체 view model 생성

2. `buildMatchStoryModel(...)`
- hero summary용

3. `buildMatchTimelineModel(...)`
- marker list 생성

4. `buildTeamComparisonModel(...)`
- 팀 집계 숫자와 차트 데이터 생성

5. `buildPlayerCardsModel(...)`
- 카드 요약 데이터 생성

6. `buildPlayerDeepDiveModel(selectedPlayer, ...)`
- 선택 player 상세 모델 생성

### 매핑 원칙

- `summary.players[].player_id`와 `game.players[].player_id`를 기준으로 이름/팀/종족을 정합시킨다
- 이름 문자열 비교는 fallback으로만 사용한다
- second/frame 변환은 selector 계층에서 끝낸다

## 해석 문구 규칙

문구는 템플릿 기반으로 단순 시작한다.

### Match Story 예시 규칙

1. 팀 킬 차이가 크면:
- "교전 교환비에서 팀 X가 크게 앞섰다."

2. team worker peak 합 차이가 크면:
- "팀 X가 더 안정적인 경제 규모를 유지했다."

3. team tech intensity가 높으면:
- "팀 X는 고급 테크 전환에 더 많은 투자를 했다."

4. enemy zone coverage가 높은 플레이어가 있으면:
- "Player Y가 적진 압박과 시야 확보에서 가장 적극적이었다."

### Player Summary 예시 규칙

1. worker_peak 상위:
- "팀 내 경제 기반이 가장 컸다."

2. vision_score_final 상위:
- "정찰 및 시야 기여가 가장 높았다."

3. tech_tree tech/upgrade count 상위:
- "테크 전환과 업그레이드 운영을 주도했다."

4. kills 높고 deaths 낮음:
- "교전 효율이 가장 좋았다."

## 컴포넌트 분해

1차 구현을 기준으로 필요한 UI 단위:

### 상위 페이지

- `GameAnalyzerPage`
- `GameAnalyzerLoader`
- `GameAnalyzerEmpty`
- `GameAnalyzerError`

### Hero 영역

- `MatchStoryHero`
- `VerdictBadge`
- `ReasonTagList`
- `KeyNumbersStrip`

### Timeline 영역

- `MatchTimeline`
- `TimelineMarker`
- `TimelineFilterChips`

### Team 영역

- `TeamComparisonPanel`
- `TeamMetricCard`
- `TeamSpendCompositionChart`
- `TeamPeakComparisonChart`

### Player 영역

- `PlayerGallery`
- `PlayerSummaryCard`
- `PlayerDeepDive`
- `PlayerBuildTimeline`
- `PlayerEconomyChart`
- `PlayerProductionChart`
- `PlayerCombatSummary`

## 구현 태스크 분해

### Phase 1. 데이터 조합 레이어

- [ ] analyzer + detail + game 합성 selector 스켈레톤 생성
- [ ] player_id 매핑 유틸 작성
- [ ] team aggregate 계산 유틸 작성
- [ ] timeline marker 추출 유틸 작성
- [ ] interpretation sentence generator 초안 작성

### Phase 2. 페이지 골격

- [ ] 새 `game_analyzer` route/page shell 작성
- [ ] hero / timeline / team / player 섹션 뼈대 작성
- [ ] loading / empty / failed / not_requested 상태 설계

### Phase 3. 1차 섹션 구현

- [ ] Match Story Hero
- [ ] Match Verdict Panel
- [ ] Match Timeline
- [ ] Team Comparison
- [ ] Player Gallery
- [ ] Player Deep Dive

### Phase 4. 차트/표현 polish

- [ ] 팀 비교 차트
- [ ] player build timeline 시각화
- [ ] resource / production / APM 차트 정리
- [ ] mobile 레이아웃 조정

### Phase 5. 해석 품질 보정

- [ ] 과장된 문구 제거
- [ ] `applied=false` verdict 표현 검수
- [ ] 신뢰 근거가 약한 해석 문구 필터링

## Acceptance Criteria

### IA / UX

- [ ] 사용자가 페이지 진입 후 5초 안에 경기 전체 구도를 파악할 수 있다
- [ ] 플레이어 선택 없이도 경기 요약을 읽을 수 있다
- [ ] timeline marker 클릭으로 관련 player를 자연스럽게 탐색할 수 있다

### 데이터 표현

- [ ] 1차 범위의 모든 섹션이 현재 저장 데이터만으로 렌더링된다
- [ ] `quality_report` 계열은 메인 화면에 직접 노출되지 않는다
- [ ] `not_requested`, `queued`, `running`, `failed`, `succeeded` 상태를 모두 처리한다

### 구현 안정성

- [ ] analyzer payload 일부 누락 시에도 페이지가 깨지지 않는다
- [ ] player 매핑 실패 시 fallback name 기반 렌더링이 가능하다
- [ ] timeline에 marker가 적더라도 empty copy가 자연스럽다

### D-2. Player Build Order Timeline

표시 내용:

- tech / upgrade / prereq building 타이밍
- 중요한 생산 전환 구간

구현 근거:

- `tech_tree.events`
- `unit_production.timelines`

### D-3. Player Economy & Production Timeline

표시 내용:

- supply 변화 추이
- worker / army 생산 추이
- mineral / gas / total spend 변화

주의:

- 현재 저장 payload에는 "실시간 supply timeline"이 없다
- 따라서 1차에서는 아래처럼 분리

1차 구현 가능:

- worker / army 생산량 timeline
- mineral / gas / total spend timeline
- APM timeline
- peak supply 단일 값

2차 필요:

- supply alive timeline
- worker alive timeline

구현 근거:

- `unit_production.timelines`
- `resource_spend.timelines`
- `apm_timeline`
- `summary.players[].final.supply_peak_used`

### D-4. Combat Outcome Summary

표시 내용:

- kills_by_zone
- deaths_by_zone
- friendly_fire_kills
- self_deaths
- unattributed_deaths

해석 예시:

- "적진에서의 성과보다는 아군 진영 교전 손실이 더 컸다"
- "직접 킬 관여는 높았지만 미확인 사망 비중이 커 실제 교전 우위 해석에는 주의가 필요하다"

구현 근거:

- `summary.players[].final`

## 1차 구현 범위 확정안

### 반드시 구현

- [ ] 새 `game_analyzer` 페이지 정보구조 설계
- [ ] Match Story Header
- [ ] Match Verdict Panel
- [ ] 팀 비교 섹션
- [ ] 플레이어별 Summary Card
- [ ] 플레이어별 Build Order Timeline
- [ ] 플레이어별 Economy & Production Timeline
- [ ] high level tech unit 등장 시점 timeline
- [ ] 핵심 tech / upgrade / prereq building timeline

### 1차에서 제외

- [ ] worker 급감 이벤트
- [ ] 대규모 전투 이벤트
- [ ] 전투 참여도
- [ ] 상대 적진 방어타워 건설 성공 이벤트
- [ ] "누가 어디를 정찰했는지" timeline

제외 이유:

- 현재 `game_analyses`에 저장되는 `summary_json`, `analysis_phase_json`, `quality_report_json`만으로는 시점별 계산이 불가능하거나 근거가 약하다

## 실제 replay_analyzer 산출물 확인 메모

로컬 real analyzer 검증 기준으로, output 디렉토리에는 아래 파일들이 생성된다.

- [x] `quality_report.json`
- [x] `summary.json`
- [x] `analysis_phase.json`
- [x] `metadata.json`
- [x] `events.jsonl`
- [x] `snapshots.jsonl`
- [x] `timeseries.json`

현재 `stareplays` worker는 이 중 아래 3개만 DB에 저장한다.

- [x] `quality_report.json`
- [x] `summary.json`
- [x] `analysis_phase.json`

즉 2차 확장의 핵심은 "analyzer가 새 데이터를 못 만든다"가 아니라, "이미 만들어진 raw artifact를 stareplays가 아직 보존/가공하지 않는다"에 가깝다.

현재 baseline 구현 상태:

- [x] `artifact_result_dir` 저장
- [x] `artifact_manifest_json` 저장
- [x] `analysis_events_json` 저장
- [x] `analysis_timeseries_json` 저장

현재 `analysis_events_json`에 들어가는 것:

- [x] high-tech unit first seen
- [x] worker drop

현재 `analysis_timeseries_json`에 들어가는 것:

- [x] worker
- [x] supply
- [x] vision
- [x] kd

실제 raw artifact에서 확인한 usable data:

- `metadata.json`
  - player/team/start_location
  - zone model
- `events.jsonl`
  - `unit_spawned`
  - `unit_morphed`
  - `unit_destroyed`
  - `unit_owner_changed`
  - position / attribution / killer 정보
- `snapshots.jsonl`
  - frame별 `worker_count`
  - frame별 `supply_used`, `supply_cap`
- `timeseries.json`
  - player별 `kd`
  - player별 `supply`
  - player별 `tower`
  - player별 `unit_count_by_type`
  - player별 `vision`
  - player별 `worker`

## 2차 데이터 확장 TODO

다음 목표는 "게임 흐름 전체에 대한 스토리텔링"을 강화하는 것이다.

### 필요한 추가 저장 데이터

- [ ] raw analyzer artifact manifest 저장
- [ ] raw artifact bucket prefix 저장
- [ ] UI용 condensed `match_flow_events_json` 저장
- [ ] UI용 condensed `player_timeseries_json` 저장
- [ ] UI용 condensed `player_profiles_json` 저장

### raw artifact -> condensed payload 변환 방향

- [ ] `events.jsonl` 기반:
  - [ ] high-tech unit first seen
  - [ ] destruction cluster 후보
  - [ ] tower forward attempt 후보
  - [ ] enemy zone entry 후보
- [ ] `snapshots.jsonl` 기반:
  - [ ] worker 급감 이벤트
  - [ ] supply swing 이벤트
- [ ] `timeseries.json` 기반:
  - [ ] player별 `worker`, `supply`, `vision`, `kd` 차트 데이터
  - [ ] team 합산 timeline
- [ ] `metadata.json` 기반:
  - [ ] starting point / zone 기준 정규화
  - [ ] ally/enemy/neutral 판정 보정

### worker 확장 방향

- [ ] `events.jsonl`, `snapshots.jsonl`, `timeseries.json`, `metadata.json` raw 전체를 DB에 넣지 않는다
- [ ] worker 성공 시 raw artifact를 bucket 또는 별도 artifact storage에 업로드
- [ ] worker에서 UI 전용 condensed summary JSON을 생성한다
- [ ] `game_analyses`에 컬럼을 과도하게 늘리기보다
- [ ] `analysis_events_json`, `analysis_timeseries_json`, `analysis_profiles_json` 또는 별도 `game_analysis_artifacts` 테이블 검토

### Match Flow 관점의 2차 구현 우선순위

- [ ] 1순위: worker 급감 이벤트
- [ ] 2순위: 대규모 전투 cluster
- [ ] 3순위: 정찰 / enemy-zone-entry timeline
- [ ] 4순위: 상대 적진 static defense 진출 시도

## 플레이어 특성 표현 아이디어 (2차 기획)

이 부분은 "재미 요소"를 강화하는 용도다.

### 1. 역할 태그

예시:

- `경제형`
- `정찰형`
- `과감한 교전형`
- `테크 지향형`
- `물량 압박형`
- `안정 운영형`

가능한 근거:

- worker_peak
- vision_score_final / enemy_zone_coverage
- tech_tree 이벤트 수
- resource_spend 카테고리 비중
- unit_production의 worker/army/tech_unit 분포

### 2. 플레이 스타일 한 줄 해석

예시:

- "초반 일꾼 최적화는 좋았지만, 중반 이후 병력 전환이 늦었다."
- "정찰 기여가 높고 시야 장악이 안정적이었다."
- "전투 관여는 높았지만 손실 관리가 아쉬웠다."

### 3. 비교형 표현

예시:

- "팀 내 최고 정찰 기여"
- "팀 내 가장 빠른 tech 전환"
- "가장 높은 worker peak"
- "가장 공격적인 적진 교전 비중"

### 4. 시그니처 장면

예시:

- "가장 빠른 하이테크 유닛 등장"
- "가장 큰 자원 투자 전환점"
- "가장 높은 적진 교전 비중"

## 추가 제안할 수 있는 콘텐츠

현재 데이터로 비교적 바로 만들 수 있는 항목:

### 1. Opening Profile

- 초반 3~5분 빌드/생산/자원 투자 패턴 요약
- "빠른 tech", "무난한 멀티형", "초반 병력 투자형" 같은 opening label

데이터 근거:

- `tech_tree.events`
- `resource_spend.timelines`
- `unit_production.timelines`

### 2. Economy vs Tech vs Army 삼각형

- player별 자원 소비 비중을
  - economy/build
  - tech/upgrade
  - army production
  세 축으로 표현

데이터 근거:

- `resource_spend.summaries`

### 3. Build Efficiency 요약

- cancel count
- ineff count
- effective-only 생산량 대비 command-based 생산량 차이

데이터 근거:

- `tech_tree.summary`
- `unit_production_versions`

주의:

- 이건 유저에게 "실수 지적"처럼 보일 수 있으니 톤을 부드럽게 조절해야 한다

### 4. Team Coordination 힌트

- 팀원 간 tech 분산/중복
- 누가 경제를 담당했고 누가 병력 전개를 담당했는지

데이터 근거:

- player별 tech_tree
- player별 unit_production
- player별 resource_spend

## 구현 순서 제안

1. 정보구조/카피 설계
- [ ] 섹션 정의
- [ ] 카드/차트 타입 정의
- [ ] 해석 문구 규칙 정의

2. 데이터 조합 레이어
- [ ] `game detail` + `game analyzer` 조합 selector 설계
- [ ] player_id <-> player name 매핑 정리
- [ ] timeline marker 생성 규칙 구현

3. 1차 UI 구현
- [ ] Match Story Header
- [ ] Match Verdict
- [ ] Team Comparison
- [ ] Player Summary
- [ ] Build/Tech Timeline
- [ ] Economy/Production Timeline

4. 2차 확장
- [ ] battle timeline용 analyzer 출력 확장
- [ ] scout/worker/supply timeline 확장
- [ ] 플레이 스타일 태깅
