# Railway Cron Setup

`ranking-job`, `analyzer-job`를 Railway Cron 서비스로 분리 배포하는 운영 가이드입니다.

## 목표

- API 서버와 배치 잡을 분리
- Cron 주기마다 `once` 모드로 실행 후 종료
- 스냅샷 테이블(`ranking3v3`, `analyzer_race_matchup`)을 주기적으로 갱신

## 전제

- Railway 프로젝트에 Postgres가 연결되어 있어야 함
- API 서비스(`backend/cmd/server`)는 별도 서비스로 상시 실행 중
- 본 문서의 잡 서비스는 각각 별도 서비스로 생성

## 서비스 구성 권장안

1. `api` 서비스: 상시 실행
2. `ranking-job` 서비스: Cron 실행 전용
3. `analyzer-job` 서비스: Cron 실행 전용

잡 서비스는 실행 후 정상 종료되어야 합니다.

---

## 1) ranking-job 서비스 생성

### 1-1. 새 서비스 생성

- Railway 프로젝트에서 `New Service` 선택
- 동일 GitHub repo 연결
- 서비스 이름: `ranking-job`

### 1-2. Build/Start 설정

- Build Command

```bash
cd backend && go mod download && go build -o bin/ranking-job ./cmd/ranking-job/main.go
```

- Start Command

```bash
./bin/ranking-job
```

### 1-3. Variables 설정

필수:

- `RANKING_JOB_MODE=once`
- `RANKING_MIN_GAMES=20`
- `DATABASE_URL` (또는 프로젝트에서 사용하는 DB 연결 변수)

선택:

- `TZ=Asia/Seoul` (로그/시간대 가독성 필요 시)

### 1-4. Cron 설정

- `Settings > Cron Schedule`에서 주기 등록
- 예시(10분마다, 2분 오프셋):

```cron
2-59/10 * * * *
```

---

## 2) analyzer-job 서비스 생성

### 2-1. 새 서비스 생성

- Railway 프로젝트에서 `New Service`
- 동일 GitHub repo 연결
- 서비스 이름: `analyzer-job`

### 2-2. Build/Start 설정

- Build Command

```bash
cd backend && go mod download && go build -o bin/analyzer-job ./cmd/analyzer-job/main.go
```

- Start Command

```bash
./bin/analyzer-job
```

### 2-3. Variables 설정

필수:

- `ANALYZER_JOB_MODE=once`
- `DATABASE_URL` (또는 프로젝트 DB 연결 변수)

선택:

- `TZ=Asia/Seoul`

### 2-4. Cron 설정

- ranking-job과 겹치지 않게 오프셋 분리 권장
- 예시(15분마다, 7분 오프셋):

```cron
7-59/15 * * * *
```

---

## 3) 스케줄 설계 가이드

DB 부하를 줄이려면 서로 다른 분(minute offset)에 배치합니다.

예:

- `ranking-job`: `2,12,22,32,42,52`
- `analyzer-job`: `7,22,37,52` (또는 더 넓은 간격)

동시 실행이 잦으면 주기를 늘리거나 오프셋을 더 벌리세요.

---

## 4) 배포 후 검증

### 4-1. 로그 확인

각 서비스의 최근 배포/실행 로그에서 아래를 확인:

- DB 연결 성공
- 스냅샷 갱신 건수 로그
- 에러 없이 프로세스 종료

### 4-2. API 결과 검증

API 서비스 기준으로 확인:

- Rankings

```bash
curl -sS "https://<your-api-domain>/api/v1/rankings/3v3?page=1&page_size=20"
```

- Analyzer

```bash
curl -sS "https://<your-api-domain>/api/v1/analyzer/race-matchups?team_size=3&page=1&page_size=20"
```

---

## 5) 장애 대응 체크리스트

1. Cron 실행은 되는데 데이터가 갱신되지 않음
- DB 변수(`DATABASE_URL`)가 올바른지 확인
- API 서비스와 잡 서비스가 같은 DB를 바라보는지 확인

2. 실행은 되는데 다음 스케줄부터 멈춤
- 잡 프로세스가 종료되지 않았는지 확인
- 모드가 `once`인지 확인

3. 빌드 실패
- Build Command 경로 오타 확인:
  - `cd backend && ... ./cmd/ranking-job/main.go`
  - `cd backend && ... ./cmd/analyzer-job/main.go`

4. 성능 저하
- 두 Cron 주기를 분리
- analyzer 주기를 더 길게 조정
- 필요 시 잡별 CPU/Memory 플랜 상향

---

## 6) 운영 권장값(초기)

- `RANKING_MIN_GAMES=20` (프로덕션 기본)
- ranking-job: 10분 주기
- analyzer-job: 15분 주기
- 두 잡 실행 시각 최소 3~5분 이상 분리

환경 안정화 후 트래픽/DB 부하를 보고 주기를 조정하세요.
