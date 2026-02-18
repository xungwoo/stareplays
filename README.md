# StarEPS

StarCraft: Brood War replay 파싱/저장 API 서버입니다.

## 핵심 기능

- Replay 파싱 후 `Game`, `Player`, `GameDetail`, `ReplayFile`, `User` 저장
- `observer:false` 플레이어만 저장
- 게임 식별 키: `host + start_time` (unique)
- 동일 게임 복수 업로드 지원 (`m/N` 신뢰도 모델)
- 동일 replay 재업로드 시 파싱 데이터는 유지하고 `upload_count`(신뢰도)만 갱신

## 신뢰도 모델

- `m/N = upload_count/player_count`
- `N/N`이면 100%
- `upload_count`는 서로 다른 업로더가 해당 게임 replay를 업로드할 때 증가
- 같은 업로더의 같은 게임 중복 업로드는 거부(409)

## API

기본 URL: `http://localhost:3000/api/v1`

### 1) Replay 업로드/저장

`POST /games/upload`

multipart/form-data:
- `replay_file` 또는 `replay_files`: `.rep` 파일
- `uploader_name`: 업로더 이름

업로드 파일은 서버의 temp 디렉토리에 저장 후 파싱되고, 처리 완료 시 즉시 삭제됩니다.

### 1-1) Replay 미리보기(업로더 선택용)

`POST /games/upload/preview`

multipart/form-data:
- `replay_file` 또는 `replay_files`: `.rep` 파일

### 2) 게임 목록

`GET /games?limit=10&offset=0`

- 응답에 `reliability_summaries` 포함 (`m_of_n`, `reliability`)

### 3) 게임 상세

`GET /games/:id`

- 응답에 `reliability_m_of_n`, `reliability` 포함

### 4) 게임 시각화 데이터

`GET /games/:id/detail`

- `APM timeline`, `build orders`, `chat messages`

### 5) 게임 삭제

`DELETE /games/:id`

### 6) 플레이어 통계

`GET /players/:name/stats`

### 7) 헬스체크

`GET /health`

## 실행

환경변수 설정 후:

```bash
go run ./cmd/server
```

또는

```bash
make run
```

### 운영 권장 환경변수

- `REPLAY_UPLOAD_DIR` (기본: `/tmp/stareps/uploads`)
  - multipart 업로드 파일의 임시 저장 디렉토리
- `REPLAY_MAX_SIZE_MB` (기본: `30`)
  - 업로드 파일 최대 크기(MB), Fiber BodyLimit에도 동일 반영
- `DISABLE_LOCAL_PARSE` (기본: `false`)
  - `true`면 `/api/v1/games/parse` 로컬 경로 파싱 API 비활성화

## 참고 문서

- 상세 API 예시: `API_USAGE.md`
- Railway 배포 체크리스트: `DEPLOY_RAILWAY.md`
