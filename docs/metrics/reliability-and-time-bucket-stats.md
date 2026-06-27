# 지표 신뢰도와 시간대별 통계 설계

이 문서는 팀 분석, 시즌, 개인 대시보드에서 사용할 수 있는 지표와 아직 핵심 판단에 쓰면 안 되는 지표를 구분한다.

## 바로 사용 가능한 안정 지표

| 지표 | 출처 | 사용처 | 설명 |
| --- | --- | --- | --- |
| 승패, 승률, 경기 수 | `Game`, `Player.team`, `Game.winner_team` | 전체 | 공식 3x3 필터를 통과한 경기만 집계한다. |
| 종족별 승률 | `Player.race` | 랭킹, 팀 분석, 시즌 | 리플레이에 기록된 실제 플레이 종족 기준이다. |
| 랜덤 선택 여부 | `Player.is_random_selected` | 팀 분석, 시즌 | 리플레이에서 자동 판별하지 않는다. CSV/시즌 룰 기반 수기 관리 값이므로 이 필드를 기준으로 쓴다. |
| APM, EAPM | `Player.apm`, `Player.eapm` | 전체 | replay parser가 선수별로 저장한 값이다. 랭킹의 95P APM과 시즌 평균 APM은 서로 다른 집계다. |
| 명령 효율 | `Player.effective_cmd_count / Player.cmd_count` | 팀 분석 | 유효 명령 비율이다. |
| 분당 유효명령 | `Player.effective_cmd_count / game_length_minutes` | 팀 분석 | 유닛 생산량이 아니다. 기존 `생산능력` 명칭을 쓰면 안 된다. |
| 손효율 | `Player.eapm / Player.apm` | 팀 분석 | 기존 `템포 안정성` 명칭 대신 사용한다. 반복 클릭 대비 유효 행동 비율에 가깝다. |
| Bradley-Terry, TrueSkill | 경기 승패 파생 모델 | 팀 분석 | 원점수 단위가 다르므로 같은 차트에서는 순위 점수로 비교한다. |

## 조건부 사용 지표

조건부 지표는 `GameDetail` 또는 detail API 응답이 있는 경기만 안정적으로 계산된다. 화면에 노출할 때는 `?` 도움말로 출처와 커버리지를 설명해야 한다.

| 지표 | 출처 | 사용 조건 |
| --- | --- | --- |
| APM timeline | `GameDetail.apm_timeline` | 개인/선수별 시간대 평균에 적합하다. 경기 업로드 후 집계 잡에서 재계산한다. |
| 유닛 생산량 | `GameDetail.compressed_build_orders` 우선, 없으면 `build_orders` | `train`, `unit_morph`, `building_morph` 중 유효 이벤트만 사용한다. |
| 자원 소모량 | `resource_spend` handler의 build event 비용 추정 | `unknown_cost_count` 비율을 같이 기록하고 커버리지가 낮으면 핵심 점수에서 제외한다. |
| 테크 타이밍 | `tech_tree` handler의 tech/upgrade/prereq event | 상대적으로 빠른/느린 테크 성향 분석에 사용할 수 있다. 취소/비유효 이벤트는 별도 분리한다. |

## 핵심 판단에 사용 금지

다음 replay_analyzer 산출물은 현재 실험적/휴리스틱 성격이 강하므로 MVP, 레이더, 랭킹 등 핵심 판단에 넣지 않는다.

| 지표 | 이유 |
| --- | --- |
| match flow events | `battle_cluster`, `worker_drop`, `supply_swing` 등이 이벤트/스냅샷 휴리스틱이다. 실제 게임 문맥 검증 전까지 해설 보조로만 둔다. |
| worker/supply/vision/kd timeseries | analyzer snapshot 기반이며 수집 커버리지와 정확도 검증이 끝나지 않았다. |
| analyzer kills/workerPeak 기반 MVP | 일부 경기만 값이 있거나 도구 버전에 따라 분포가 달라질 수 있다. 시즌 MVP는 승률, 승수, APM, EAPM만 사용한다. |

## 시간대별 통계 캐시 설계

게임 수가 커져도 페이지 로딩이 느려지지 않도록 원본 이벤트를 매번 스캔하지 않고 업로드/분석 완료 시점에 집계 스냅샷을 갱신한다.

권장 테이블:

| 테이블 | 키 | 목적 |
| --- | --- | --- |
| `player_time_bucket_stats` | `(player_name, scope_type, scope_id, metric, bucket_sec)` | 선수별 시간대 평균, 표준편차, 95 percentile, 표본 수 저장 |
| `player_metric_snapshots` | `(player_name, scope_type, scope_id)` | 개인 대시보드/팀 분석에서 자주 쓰는 안정 지표 요약 저장 |
| `game_metric_quality` | `(game_id, metric)` | detail/analyzer 지표의 출처, 커버리지, unknown count 저장 |

집계 방식:

1. 업로드가 끝나고 `GameDetail`이 생성되면 해당 `game_id`를 dirty queue에 넣는다.
2. 기존 analyzer/ranking 계열 잡 중 하나에 `stats-refresh` 단계를 추가하거나 별도 `stats-job`을 둔다.
3. dirty game의 선수별 10초 bucket 값을 펼친 뒤, 선수/시즌/전체 scope별로 upsert한다.
4. 평균은 `avg`, 튀는 값 방어는 `percentile_cont(0.95)` 또는 애플리케이션 정렬 기반 95P를 함께 저장한다.
5. 화면은 원본 build order를 직접 읽지 않고 snapshot API만 조회한다.

초기 metric 후보:

| metric | bucket source | 집계 |
| --- | --- | --- |
| `apm` | `GameDetail.apm_timeline` | avg, p95, stddev, sample_count |
| `unit_production` | compressed build order production timeline | avg, p95, total, sample_count |
| `resource_spend` | resource spend timeline | mineral_avg, gas_avg, total_avg, unknown_cost_rate |
| `tech_timing` | tech tree events | first_tech_second, first_upgrade_second, percentile rank |

## 화면 표기 원칙

- 모든 핵심 지표 제목에는 `?` 도움말을 붙인다.
- 지표명이 실제 계산식보다 과장되면 안 된다.
- 수집 커버리지가 낮은 지표는 MVP, 랭킹, 핵심 레이더 점수에서 제외한다.
- 보조 지표를 노출할 때는 출처와 표본 수를 함께 보여준다.
