# Replay Event Analysis Framework

StarCraft replay 기반 실시간/시계열 분석의 정확도와 해석 규칙을 정리한 문서입니다.

## 1. 목적

- 유닛 생산량/소모량 분석 정확도 고도화
- 자원 분석을 `Mineral` / `Gas`로 분리
- 이벤트별 해석 규칙과 신뢰도(확정/추정)를 명시
- 구현 중 판단 기준을 문서화해 일관성 유지

## 2. 현재 데이터 소스

현재 `stareplays`는 `screp` 파서를 통해 아래를 수집합니다.

- Header / Computed / Commands
- Player 통계: APM, EAPM, CmdCount, EffectiveCmdCount, Start 정보
- GameDetail:
  - `apm_timeline`
  - `build_orders` (raw command event)
  - `compressed_build_orders` (중복/취소 상쇄/효율 필터 적용)
  - `chat_messages`

핵심 제약:

- replay에는 "실제 자원 잔액"이 직접 저장되지 않음
- 커맨드 기반 이벤트로 추정 가능하나, 완료/취소/실행 실패의 완전한 상태 추적은 제한적

## 3. 이벤트 구조(해석용 분류)

분석 모델은 이벤트를 아래 4축으로 분류합니다.

1. `Production`
- `train`, `unit_morph`, `building_morph`
- 유닛 생산량/생산 속도 계산의 기본 입력

2. `Construction/Tech`
- `build`, `land`, `tech`, `upgrade`
- 테크 트리 진행/타이밍 분석의 기본 입력

3. `Cancel/Correction`
- `cancel_train`, `cancel_build`, `cancel_morph`, `cancel_tech`, `cancel_upgrade`
- 순생산/순자원 계산 시 차감 또는 상쇄 규칙 적용

4. `Quality`
- `is_effective`, `ineff_kind`
- 반복 입력/비효율 이벤트를 품질 가중치로 반영

## 4. 해석 레벨 정의 (중요)

같은 숫자라도 정확도 수준을 구분해서 노출합니다.

### L1: Command-level (현재 구현 가능, 빠름)

- 의미: "플레이어가 해당 명령을 입력한 횟수"
- 장점: 재현성 높고 구현 단순
- 한계: 실제 완료 여부/실행 성공과 차이 존재

### L2: Effective command-level (현재+확장)

- 의미: 비효율(`ineff`)을 배제/가중한 입력량
- 장점: 노이즈 감소, 실전 의도에 근접
- 한계: 여전히 완료 상태 추정은 아님

### L3: Estimated execution-level (고도화 목표)

- 의미: 취소/짧은 반복/변환 관계를 반영한 추정 순량
- 장점: 실제 게임 진행과 가까움
- 한계: replay만으로 100% 복원 불가, 추정치임을 명시해야 함

## 5. 유닛 생산량 고도화 계획

## Phase 1 (완료)

- `unit_production` DTO 추가
- `/games/:id/detail`에 `unit_production` 포함
- UI `Unit Production` 탭 추가

## Phase 2 (다음)

- 종족/유닛 특수 규칙 반영
  - 예: Zergling/Scourge 2기 생성 보정
  - morph 계열(예: Lurker) 신규 생산 vs 변환 구분 정책 명문화
- `cancel_*`의 시간창 기반 상쇄 정교화
- 이벤트별 `confidence` 부여 (`high/medium/low`)

## Phase 3 (고급)

- 순생산(Net Production)과 소모(Dead/Traded 추정) 분리 모델
- 시간축 누적 곡선 + 전투 구간 연계
- 팀 단위 집계/상대 비교(our vs enemy)

## 6. 자원 분석(Mineral/Gas 분리) 프레임워크

자원은 반드시 `spent`와 `income`을 분리해 해석합니다.

1. `Resource Spend (확정에 가까움)`
- 이벤트 기반 비용 매핑으로 계산
- 산식:
  - `spent_mineral += cost_mineral(event)`
  - `spent_gas += cost_gas(event)`
- 대상:
  - 유닛 생산, 건물 건설, tech, upgrade
- 취소 이벤트는 정책에 따라 환급 추정(`refund_estimate`) 처리

2. `Resource Income (추정)`
- replay 단독으로 정확 복원 어려움
- 추정 모델 단계:
  - L1: Worker 수 기반 이론 채집량
  - L2: 멀티/가스건물 타이밍 반영
  - L3: 생산/테크 소비 역산 + 행동 밀도 보정
- UI에는 `estimated` 라벨을 강제

3. `Net Resource`
- `net_mineral = income_mineral_est - spent_mineral`
- `net_gas = income_gas_est - spent_gas`
- 정확도 등급을 같이 표기

## 7. 표준 이벤트 스키마(제안)

향후 내부 표준 스키마를 아래처럼 고정합니다.

```json
{
  "frame": 12345,
  "second": 518.4,
  "player_name": "foo",
  "category": "production|tech|upgrade|build|cancel",
  "subject": "Dragoon",
  "source_event_type": "train",
  "is_effective": true,
  "ineff_kind": "effective",
  "cost": {"mineral": 125, "gas": 50},
  "refund_estimate": {"mineral": 0, "gas": 0},
  "confidence": "high"
}
```

## 8. API 확장 방향

`GET /api/v1/games/:id/detail`에 아래 섹션을 단계적으로 추가합니다.

- `unit_production` (done)
- `resource_spend` (done)
  - `summaries`, `timelines`, `by_category`
  - mineral / gas 분리 포함
- `resource_income_estimate`
  - `timeline`, `summary`, `model_version`, `confidence`
- `resource_net_estimate`
  - mineral/gas 순량

## 9. UI 표기 원칙

- 확정값: `count`, `spent`
- 추정값: `estimated` 접두어 + 툴팁
- 불확실 구간: 점선/흐린 색/경고 아이콘
- 탭 제목 예시:
  - `Unit Production`
  - `Resource Spend (M/G)`
  - `Resource Income (Estimated)`
  - `Resource Net (Estimated)`

## 10. 구현 시 체크리스트

1. 이벤트 분류 규칙이 race별로 일관적인가?
2. 취소 상쇄 로직이 과도 제거를 만들지 않는가?
3. raw vs compressed 차이를 API에서 선택 가능하게 했는가?
4. 모든 추정치에 confidence/model_version이 포함되는가?
5. UI에서 확정값과 추정값을 혼동하지 않게 표현했는가?

---

문서 갱신 규칙:

- 이벤트 해석 규칙 변경 시 이 문서의 `해석 레벨`, `표준 스키마`, `체크리스트`를 함께 업데이트합니다.

## 11. 진행 현황 (2026-02-21)

- done: `unit_production` DTO + `/games/:id/detail` 응답 + UI 탭
- done: `resource_spend` DTO + `/games/:id/detail` 응답 + UI 탭
  - UI는 `Resource Spend (M/G)` 2라인(미네랄/가스) + 플레이어 요약표 제공
- next:
  - 종족/유닛 특수 규칙 보정(정확도 향상)
  - `income_estimate`, `net_estimate` 모델 추가
