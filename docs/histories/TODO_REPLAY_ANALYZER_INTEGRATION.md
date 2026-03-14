# TODO_REPLAY_ANALYZER_INTEGRATION

## 작업 우선순위 (2026-03-14 기준)
- `P0 (현재 1순위)`: Replay Analyzer 운영 안정화 및 후속 모니터링
- `P1 (보류)`: Frontend Refactor 작업 (Next.js + Fastify) 재개 대기

## 현재 진행 상태 스냅샷 (2026-03-14)
- [x] `game_analyses` 스키마/ent 코드 추가
- [x] 업로드 경로에서 Bucket 업로드 + 분석 큐 upsert + `pg_notify` 구현
- [x] Worker(`cmd/replay-analyzer-worker`) 추가
- [x] `SKIP LOCKED` claim + `LISTEN/NOTIFY` + fallback poll 구현
- [x] `GET /games/:id/analyzer` 및 `GET /games` 상태 응답 확장
- [x] 레거시 UI(`frontend/web`)에 분석 상태 배지/수동 새로고침 반영
- [x] Railway Bucket 생성 및 API/Worker env 연결 완료
- [x] 기존 `replay_analyzer` 서비스를 `stareplays` worker 이미지로 재목적화 완료
- [x] 운영 E2E 검증 및 수용 기준(AC) 실증 완료

## 운영 현재 상태 메모 (2026-03-14)
- 현재 운영 사용자 트래픽은 `frontend/web`(legacy web) 기준으로 처리한다.
- `frontend/app-next` 전환 작업은 현재 보류 상태이며, replay analyzer 통합 완료 범위에 포함하지 않는다.
- Railway Bucket 생성 및 서비스 변수 연결이 완료되었다.
- 운영 worker는 별도 새 서비스를 추가하지 않고, 기존 `replay_analyzer` 서비스를 `stareplays` 기반 `replay-analyzer-worker` Docker 이미지로 전환해 사용한다.
- `replay_analyzer-volume`의 MPQ 자산은 `/data/mpq`에서 계속 재사용한다.
- 현재 운영 환경의 replay analyzer 통합 상태는 "운영 연결 및 실제 업로드 E2E 검증 완료"로 본다.

## 운영 E2E 실제 검증 결과 (2026-03-14)
- Railway `replay_analyzer` 서비스가 `2026/03/14 06:42:14`에 아래 로그로 정상 기동함을 확인:
  - `worker started: channel=replay_analysis_jobs poll=10s`
- 운영 신규 업로드 1건에 대해 worker가 실제 claim/success 처리함을 확인:
  - `2026/03/14 06:48:28 job succeeded id=1 game_id=38 result_dir=/tmp/stareplays/analysis_jobs/job_1/sha1:febfad22fbcbc91d1be53111ee11547eea4d6025`
- 위 로그로 아래 운영 경로가 end-to-end로 통과했음을 확인:
  - replay 업로드
  - Railway Bucket 원본 저장
  - `game_analyses` enqueue
  - worker claim
  - `replay_analyzer(openbw)` 실행
  - 결과 JSON 저장
- API 확인:
  - `GET /api/v1/games`에서 `analysis_statuses` 반영 확인
  - `GET /api/v1/games/38/analyzer` 결과 확인
- UI 확인:
  - 운영 웹은 계속 `frontend/web`(legacy web) 기준으로 사용
  - Recent Games / Analyzer 수동 새로고침 UX 확인 완료

## 로컬 E2E 실제 검증 결과 (2026-03-13)
- `MinIO + local API + local worker + fake analyzer stub` 조합으로 bucket 포함 로컬 E2E를 실제 실행했다.
- 성공 경로 확인:
  - `POST /games/upload/preview` 정상 응답
  - `POST /games/upload` 정상 처리
  - bucket object 생성 확인 (`replays/{file_hash}.rep`)
  - worker가 즉시 claim 후 `succeeded` 처리
  - `GET /games`의 `analysis_statuses` 반영 확인
  - `GET /games/:id/analyzer`에서 stub 결과 JSON 반환 확인
- 실패/재시도 경로 확인:
  - fake analyzer stub를 `fail` 모드로 실행했을 때 worker가 retry 후 최종 `failed`로 전이됨
  - `GET /games/:id/analyzer`에 `last_error`와 `attempt_count` 반영 확인
- 재큐잉 정책 재검증:
  - `same game_id + same file_hash + same analyzer_version(v1)` 업로드는 정상 수락되지만 analyzer는 중복 큐잉되지 않음을 확인
  - `same game_id + same file_hash + different analyzer_version(v2)` 업로드는 기존 row를 초기화한 뒤 `queued -> running -> succeeded`로 재큐잉됨을 확인
  - 재큐잉 시 `attempt_count`가 `0 -> 1`로 새로 시작하고, 이전 `last_error`/결과 JSON/시각 필드가 초기화됨을 확인
  - 기존 `Create() -> constraint error 감지 -> Update()` 방식은 제거했고, 현재는 DB `ON CONFLICT (game_id)` upsert 기반으로 동작
- 실제 analyzer 풀 E2E:
  - `/tmp/replay_analyzer_real` 및 `/tmp/openbw_sidecar_real`로 실제 `replay_analyzer(openbw)` 실행 확인
  - 단독 실행 기준 `events.jsonl`, `snapshots.jsonl`, `quality_report.json`, `summary.json`, `analysis_phase.json` 생성 확인
  - worker에 실제 analyzer를 연결한 상태에서 `REPLAY_ANALYZER_VERSION=v3` 업로드를 실행했고, 약 6초 내 `job claimed -> job succeeded` 완료 확인
  - `GET /games/:id/analyzer`에 실제 openbw 결과가 저장/반환되는 것 확인
- notify / poll fallback 검증:
  - worker를 `poll=3s`로 실행한 상태에서 DB에서 `game_analyses.status='queued'`로 직접 갱신하고 `NOTIFY`는 보내지 않는 방식으로 누락 시나리오를 재현
  - `2026-03-13 22:45:48+09`에 row를 직접 `queued`로 만들었고, worker가 `2026-03-13 22:45:49+09`에 claim
  - 이후 `2026-03-13 22:45:55+09`에 `succeeded`로 완료되어 fallback poll만으로도 남은 작업이 회수됨을 확인

## 로컬 E2E에서 확인된 즉시 조치 결과
- [x] `upsertGameAnalysisQueuedTx`를 DB `ON CONFLICT (game_id)` upsert 기반으로 교체
- [x] 기존 row 재큐잉 시 `attempt_count`, `started_at`, `finished_at`, 기존 결과 JSON 초기화
- [x] `same hash + same version` 중복 큐잉 방지 검증
- [x] `same hash + different analyzer_version` 재큐잉 검증
- [x] 실제 `replay_analyzer(openbw)` 풀 E2E 검증
- [x] `NOTIFY` 누락 시 fallback poll 처리 검증

## 목적
- `stareplays`에 `replay_analyzer`를 신규 업로드 replay 대상에만 비동기로 통합한다.
- 통합 이전 DB에 이미 있던 기존 replay는 분석 대상에서 제외한다(백필 없음).
- `Recent_Games`와 `Analyzer` 화면에서 분석 상태를 일관되게 노출한다.

## 범위/비범위
- 범위:
  - 업로드 성공 후 비동기 분석 enqueue
  - Railway Bucket에 replay 원본 보관
  - worker 기반 분석 실행 및 결과 저장
  - 분석 상태 API + UI 반영
- 비범위:
  - 기존 데이터 일괄 재분석(backfill)
  - analyzer.html 자동 polling

## 요구사항 반영
1. 분석 트리거
- 신규 업로드 replay에만 `replay_analyzer` 작업 생성
- 통합 이전부터 DB에 있던 기존 game/replay에는 작업 생성하지 않음
- 통합 이후의 신규 업로드 replay라면, 기존 game에 대한 추가 업로드여도 analyzer 대상이 될 수 있음
- `same game_id + same file_hash + same analyzer_version`이면 중복 큐잉하지 않음
- `same game_id + same file_hash + different analyzer_version`일 때만 재큐잉 허용

2. UI 정책
- `Analyzer` 페이지는 polling 없이 "새로고침" 버튼으로 상태 갱신
- 분석 미완료 시 "분석 진행 중" 메시지 노출
- `Recent_Games` 목록에 분석 상태 배지 노출

3. 운영 정책
- 업로드된 replay 원본은 Railway Bucket 저장
- 분석 실패가 업로드 성공 경로를 오염시키지 않도록 비동기 분리

---

## 권장 아키텍처
1. API 서버(기존)
- 업로드/기본 파싱/DB 저장
- Bucket 업로드
- 분석 작업 enqueue

2. Analyzer Worker(신규 서비스)
- PostgreSQL 큐에서 작업 claim
- `replay_analyzer` 실행
- 결과(JSON) 저장 및 상태 전이

3. 데이터 저장
- 원본 replay: Railway Bucket
- 분석 결과 요약: PostgreSQL(JSON 컬럼)

---

## PostgreSQL 큐 방식 재검토

### 결론
- 본 프로젝트(중간 트래픽, 운영 단순성 우선)에서는
  `WHERE status='queued' ... FOR UPDATE SKIP LOCKED LIMIT 1`
  패턴이 **최선에 가깝다**.
- 그리고 본 통합에서는 `LISTEN/NOTIFY`를 **선택이 아니라 필수**로 포함한다.
- 최종 채택: `SKIP LOCKED`(durable claim) + `LISTEN/NOTIFY`(즉시 wake-up) 하이브리드.

### 근거
1. `SKIP LOCKED`는 PostgreSQL 공식 문서에서 "queue-like table" 용도로 명시됨
- 일반 조회에는 부적합(일관성 뷰 아님)이나, 다중 worker 큐에는 적합

2. `LISTEN/NOTIFY`는 enqueue 시 worker 깨우기에 적합
- 이벤트 전달은 트랜잭션 커밋 시점에 이뤄져 정합성 유지
- payload는 짧게 유지하고, 실제 데이터는 테이블에서 조회

3. 왜 단독 `NOTIFY` 큐가 아닌가
- `NOTIFY` 자체는 durable queue가 아님(신뢰 저장소는 테이블이 필요)
- 따라서 durable table + row lock claim이 기본이어야 함

### 권장 구현 패턴(하이브리드)
1. enqueue 트랜잭션
- `INSERT ... status='queued'`
- `NOTIFY replay_analysis_jobs, '{job_id}'`

2. worker 루프
- 기본: `LISTEN replay_analysis_jobs`
- 깨움 이벤트 수신 시 즉시 claim 시도
- 백업: 주기 poll(예: 5~15초)로 missed notify 방어
- 주의: `LISTEN` 전용 DB connection을 분리해 long-running 대기와 작업 트랜잭션을 분리

3. claim SQL(권장)
```sql
WITH next_job AS (
  SELECT id
  FROM game_analyses
  WHERE status = 'queued'
    AND next_retry_at <= now()
  ORDER BY priority DESC, requested_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE game_analyses g
SET status = 'running',
    started_at = now(),
    attempt_count = attempt_count + 1,
    updated_at = now()
FROM next_job
WHERE g.id = next_job.id
RETURNING g.*;
```

4. 인덱스
- `(status, next_retry_at, priority DESC, requested_at)`
- `game_id UNIQUE` (게임당 1개 활성 작업 정책이면)

5. 운영 안정성 규칙
- Worker 시작 시 notify를 기다리기 전에 1회 claim 루프를 먼저 돌려 누락 작업을 선처리
- notify payload는 힌트로만 사용하고, 실제 claim 대상 결정은 항상 SQL로 수행
- 네트워크 단절/재연결 시 `LISTEN` 재등록 + 즉시 catch-up claim 실행

### 대안 비교
1. Advisory Lock 중심 큐
- 장점: 빠름
- 단점: durable 상태/재시도/운영 가시성이 약해짐
- 결론: 본 건에는 보조 락으로만 고려

2. 외부 MQ(Redis/SQS)
- 장점: 대규모 처리에 유리
- 단점: 인프라 복잡도 증가
- 결론: 현재 목표(빠른 통합) 대비 과함

3. PostgreSQL 확장 큐(PGMQ 등)
- 장점: 기능 풍부(visibility timeout 등)
- 단점: Railway Postgres에서 확장 가용성/운영성 검증 필요
- 결론: 2단계 최적화 후보

---

## 스키마/엔티티 변경안
1. 신규 테이블 `game_analyses`
- 식별: `id`, `game_id`, `replay_file_id`, `file_hash`, `bucket_key`
- 상태: `status (queued/running/succeeded/failed/not_requested)`
- 실행: `attempt_count`, `last_error`, `requested_at`, `started_at`, `finished_at`, `next_retry_at`
- 결과: `quality_report_json`, `summary_json`, `analysis_phase_json`
- 메타: `priority`, `created_at`, `updated_at`

2. API 응답 확장
- `GET /games` 결과 항목에 `analysis_status` 포함
- `GET /games/:id/analyzer` 신규: 상태/결과/오류 반환

---

## 업로드 플로우 변경안
1. 업로드 성공 직후
- replay 파일을 Bucket에 `replays/{file_hash}.rep`로 업로드
- DB에서 replay_file 생성/갱신
- `game_analyses` row를 `game_id` 기준으로 upsert
  - row가 없으면 `queued` insert
  - row가 있고 `same file_hash + different analyzer_version`이면 상태 초기화 후 `queued`로 재큐잉
  - row가 있고 `same file_hash + same analyzer_version`이면 중복 큐잉하지 않음
- enqueue 트랜잭션에서 `NOTIFY`

2. 실패 처리 원칙
- Bucket 업로드 실패 시 업로드 요청 실패(원본 유실 방지)
- enqueue 실패 시 업로드는 성공 처리하되 상태를 `failed_to_enqueue`로 남길지 정책 확정 필요
  - 권장: enqueue도 같은 트랜잭션 경계에서 실패 처리

---

## UI 변경안
1. Recent_Games
- 상태 배지: `not_requested | queued | running | succeeded | failed`
- 배지 색/텍스트 표준화

2. Analyzer 페이지(analyzer.html)
- 최초 진입 시 1회 조회
- 상태별 렌더링:
  - `queued/running`: "분석 진행 중" + `새로고침`
  - `failed`: 오류 요약 + 재시도 버튼(선택)
  - `succeeded`: 품질/요약 지표 표시
  - `not_requested`: "기존 업로드 게임(분석 미요청)"

---

## Railway Bucket 설정 체크리스트
1. Bucket 생성 및 Credentials 확인
- `BUCKET`, `ENDPOINT`, `REGION`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`

2. 서비스 변수 매핑
- API/Worker에 아래 env 주입
  - `REPLAY_BUCKET_NAME=${BUCKET}`
  - `REPLAY_BUCKET_ENDPOINT=${ENDPOINT}`
  - `REPLAY_BUCKET_REGION=${REGION}`
  - `REPLAY_BUCKET_ACCESS_KEY_ID=${ACCESS_KEY_ID}`
  - `REPLAY_BUCKET_SECRET_ACCESS_KEY=${SECRET_ACCESS_KEY}`

3. URL 스타일 확인
- Railway Credentials 탭의 URL 스타일(virtual-hosted/path-style) 기준으로 SDK 옵션 설정

4. 보안
- Bucket은 private 전제
- 파일 제공은 presigned URL 또는 API proxy로만

## 남은 운영 후속 작업
- [ ] replay analyzer worker 로그/실패율 모니터링 기준 정리
- [ ] GitHub private repo clone에 사용한 token 운영 관리 방식 정리
- [ ] 문서/API_USAGE 최신화 여부 최종 점검

---

## 로컬 E2E 검증 방안 (Bucket 포함)

- 상세 실행 문서: `LOCAL_REPLAY_ANALYZER_E2E_RUNBOOK.md`

### 결론
- 현재 코드 기준으로 로컬 E2E를 가장 현실적으로 검증하는 방법은 `S3-compatible bucket + local API + local worker + multipart upload` 조합이다.
- 권장안은 `MinIO`를 로컬 bucket 대체재로 쓰는 방식이다.
- `/api/v1/games/parse` 로컬 경로 파싱 API는 `replayData`를 넘기지 않으므로 bucket 업로드/분석 enqueue 검증에는 적합하지 않다.
- replay analyzer 자체 의존성이 무거우면, 2단계로 `fake analyzer stub`를 붙여 queue/bucket/API/UI 통합만 먼저 검증할 수 있다.

### 권장안 A: MinIO + 실제 replay_analyzer 로컬 E2E
1. 준비물
- PostgreSQL
- MinIO 같은 S3-compatible storage
- 로컬 API 서버 (`backend/cmd/server`)
- 로컬 worker (`backend/cmd/replay-analyzer-worker`)
- 실제 `replay_analyzer` 바이너리
- 실제 `.rep` 샘플 파일

2. 이유
- 현재 `internal/storage/replaybucket`는 AWS SDK v2 + custom endpoint 방식이라 S3-compatible storage에 바로 붙을 수 있다.
- `REPLAY_BUCKET_PATH_STYLE=true` 기본값이 있어 MinIO와 궁합이 좋다.
- 운영 경로와 가장 유사한 검증이 가능하다.

3. 권장 env 예시
```bash
export REPLAY_BUCKET_NAME=stareplays-local
export REPLAY_BUCKET_ENDPOINT=http://127.0.0.1:9000
export REPLAY_BUCKET_REGION=us-east-1
export REPLAY_BUCKET_ACCESS_KEY_ID=minioadmin
export REPLAY_BUCKET_SECRET_ACCESS_KEY=minioadmin
export REPLAY_BUCKET_PATH_STYLE=true

export REPLAY_ANALYZER_BIN=/absolute/path/to/replay_analyzer
export REPLAY_ANALYZER_SIMULATOR=openbw
export REPLAY_ANALYZER_WORKER_LISTEN_CHANNEL=replay_analysis_jobs
export REPLAY_ANALYZER_WORKER_POLL_INTERVAL_SEC=10
```

4. 검증 순서
- MinIO에서 `stareplays-local` bucket 생성
- API 서버 실행
- worker 실행
- `POST /api/v1/games/upload`로 replay 업로드
- MinIO에 `replays/{file_hash}.rep` 오브젝트가 생성되는지 확인
- DB `game_analyses` row가 `queued -> running -> succeeded|failed`로 바뀌는지 확인
- `GET /api/v1/games`의 `analysis_statuses` 확인
- `GET /api/v1/games/:id/analyzer` 결과 JSON 확인
- legacy web(`frontend/web`)에서 Recent Games 배지와 analyzer 수동 새로고침 동작 확인

5. 운영과 동일하게 확인해야 할 포인트
- 업로드 실패 시 bucket 저장 실패가 요청 실패로 전파되는지
- notify 직후 worker가 즉시 깨는지
- notify 없이도 poll로 결국 처리되는지
- 실패 시 retry 후 최종 `failed`로 내려가는지

### 권장안 B: MinIO + fake analyzer stub 로컬 스모크 E2E
1. 목적
- `replay_analyzer`/`openbw` 설치 없이도 queue/bucket/API/UI 통합만 빠르게 검증

2. 이유
- worker는 최종적으로 output 디렉토리 어딘가에 아래 3개 파일만 찾으면 성공 처리한다.
  - `quality_report.json`
  - `summary.json`
  - `analysis_phase.json`

3. 방법
- `REPLAY_ANALYZER_BIN`을 간단한 shell script로 지정
- 해당 script가 `-out <dir>` 아래 임의 하위 디렉토리를 만들고 위 3개 JSON 파일을 써주게 구성
- 그러면 worker는 bucket download, queue claim, result save, API/UI 반영까지 모두 그대로 검증 가능

4. 이 방식으로 먼저 확인할 것
- bucket env 연결
- `POST /games/upload` 경로에서 bucket/object 생성
- `game_analyses` 상태 전이
- `GET /games` / `GET /games/:id/analyzer` 응답 스키마
- legacy web 수동 새로고침 UX

5. 한계
- 실제 replay_analyzer 결과 품질과 실행시간은 검증하지 못함
- 따라서 최종 AC 전에는 권장안 A 또는 Railway 실환경 검증이 반드시 필요

### 로컬 E2E 실행 시 주의사항
- bucket 연동 검증은 반드시 `POST /api/v1/games/upload`로 해야 한다.
- `POST /api/v1/games/parse`는 bucket 업로드와 enqueue를 타지 않으므로 replay analyzer E2E 검증용으로 쓰면 안 된다.
- 현재 운영 UI 기준은 legacy web이므로, 로컬 E2E의 UI 확인도 `frontend/web` 중심으로 본다.
- Next.js 프론트는 현재 보류 범위이므로 이번 E2E의 완료 조건에 넣지 않는다.

### 권장 실행 우선순위
1. `권장안 B`로 bucket/queue/API/UI 스모크 검증을 먼저 통과시킨다.
2. 이후 `권장안 A`로 실제 analyzer 바이너리까지 포함한 로컬 풀 E2E를 검증한다.
3. 마지막으로 Railway Bucket 생성 후 운영 환경에서 신규 업로드 1건으로 실증한다.

---

## 남은 작업 (우선순위 순)
1. `P0` 로컬 E2E 준비 및 검증
- [x] 로컬 S3-compatible bucket(MinIO 권장) 준비
- [x] `POST /games/upload` 기준 bucket/object 생성 확인
- [x] local worker 실행 후 `queued -> running -> succeeded|failed` 전이 확인
- [x] fake analyzer stub로 스모크 E2E 확보
- [x] 실제 `replay_analyzer` 바이너리 포함 풀 E2E 검증
- [x] 기존 `game_analyses` row가 있는 게임의 재업로드 재큐잉 정책(`same hash + different analyzer_version`) 재검증

2. `P0` 통합 검증
- [x] 신규 업로드 replay로 `queued -> running -> succeeded|failed` 전이 확인
- [x] `NOTIFY` 즉시 처리 + notify 누락 시 fallback poll 처리 확인
- [x] Bucket 파일 저장/다운로드 및 analyzer 결과 JSON 반영 확인

3. `P0` API/UI 검증
- [x] `GET /games`의 `analysis_statuses`가 목록 상태와 일치하는지 확인
- [x] `GET /games/:id/analyzer` 상태/결과/오류 필드 검증
- [ ] `frontend/web` Recent_Games/Analyzer 화면 수동 새로고침 UX 점검

4. `P0` Railway 운영 마무리
- [ ] Railway Bucket 생성
- [ ] 기존 `replay_analyzer` 서비스를 `stareplays` repo 기반 worker 이미지로 전환
- [ ] API/Worker env/secret/Bucket 변수 연결
- [ ] 장애 로그(재시도/최종 실패) 관측 가능성 점검

5. `P1` 문서/운영 이관
- [ ] 실제 운영값 기준 env/runbook 최종 갱신
- [ ] 프론트엔드 리팩터 보류 상태 유지 및 재개 조건 확인
- [ ] legacy web 기준 운영 사실을 문서/런북에 유지

---

## 수용 기준(AC)
1. [x] 신규 업로드 replay 이벤트는 정책에 맞게 `queued` 생성 또는 중복 큐잉 스킵 처리됨
2. [x] Worker 실행 후 `queued -> running -> succeeded|failed` 전이 확인
3. [ ] `Recent_Games`에서 상태가 실시간 조회 시 반영됨
4. [ ] `Analyzer` 페이지에서 polling 없이 새로고침으로 상태 갱신 가능
5. [x] 통합 이전 기존 game은 `not_requested`로 유지되고, 통합 이후 신규 업로드가 들어온 경우에만 analyzer 대상이 됨
6. [x] `same game_id + same file_hash + same analyzer_version`은 중복 큐잉되지 않음
7. [x] `same game_id + same file_hash + different analyzer_version`일 때만 재큐잉됨
8. [x] enqueue 후 `NOTIFY` 기반 즉시 처리 경로가 동작하고, notify 누락 상황에서도 fallback poll로 작업이 결국 처리됨

---

## 참고 링크
- PostgreSQL SELECT locking clause (`SKIP LOCKED` queue-like table 용도):
  - https://www.postgresql.org/docs/16/sql-select.html
- PostgreSQL LISTEN:
  - https://www.postgresql.org/docs/current/sql-listen.html
- PostgreSQL NOTIFY:
  - https://www.postgresql.org/docs/current/sql-notify.html
- PostgreSQL Advisory Locks:
  - https://www.postgresql.org/docs/current/explicit-locking.html
- Railway Storage Buckets:
  - https://docs.railway.com/guides/storage-buckets
