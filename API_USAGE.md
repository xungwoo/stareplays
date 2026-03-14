# stareplays API Usage

현재 canonical spec은 `docs/spec.md`입니다.
이 문서는 curl 예시 중심의 보조 문서로 유지합니다.

## Base URL

- Local: `http://localhost:3000`
- Prefix: `/api/v1`

## Data Model Summary

- `Game`: 게임 메타 정보 + 업로드 신뢰도(`upload_count`, `player_count`)
- `Player`: 게임 참가자(Observer 제외) 통계
- `ReplayFile`: 업로드된 리플레이 파일 이력 (업로더 연결)
- `GameDetail`: 시각화용 상세 데이터(APM 타임라인, 빌드오더, 채팅)
- `User`: 업로더/플레이어 사용자 엔터티

신뢰도 표현:

- `m/N` = `upload_count / player_count`
- `N/N`이면 100%

---

## 1) Upload Replay

`POST /api/v1/games/upload`

Replay 파일을 multipart 업로드하여 파싱 후 DB에 저장합니다.

### Request (multipart/form-data)

- `replay_file`: `.rep` 파일
- `uploader_name`: 업로더 이름

### Rules

1. `observer:false` 플레이어만 저장합니다.
2. `host + start_time` 조합으로 동일 게임을 판별합니다.
3. 동일 게임의 다른 업로더 업로드는 `upload_count`를 증가시킵니다.
4. 동일 replay hash 재업로드 시 게임/플레이어/상세 파싱 데이터는 갱신하지 않고 신뢰도만 갱신합니다.
5. 같은 유저가 같은 게임에 중복 업로드하면 `409`를 반환합니다.

### Example

```bash
curl -X POST http://localhost:3000/api/v1/games/upload \
  -F "replay_file=@/Users/seongwoo/Library/Application Support/Blizzard/StarCraft/Maps/Replays/LastReplay.rep" \
  -F "uploader_name=jjang9-pil"
```

### Success Response (new game)

```json
{
  "message": "Game parsed and saved successfully",
  "game": {
    "id": 1,
    "host": "jjang9-pil",
    "player_count": 6,
    "upload_count": 1
  }
}
```

### Success Response (existing game / reliability updated)

```json
{
  "message": "Replay file added to existing game (reliability increased)",
  "game": {
    "id": 1,
    "player_count": 6,
    "upload_count": 3
  },
  "upload_count": 3,
  "reliability": "50%"
}
```

### Error Response (duplicate by same user)

```json
{
  "error": "This user already uploaded a replay for this game"
}
```

---

## 1-1) Upload Replay Preview

`POST /api/v1/games/upload/preview`

업로드 전에 replay 메타와 플레이어 이름을 preview 합니다.

### Request (multipart/form-data)

- `replay_file`: `.rep` 파일

### Example

```bash
curl -X POST http://localhost:3000/api/v1/games/upload/preview \
  -F "replay_file=@/absolute/path/to/sample.rep"
```

---

## 1-2) Local Parse Dev Endpoint

`POST /api/v1/games/parse`

- 로컬 파일 경로 기반 개발용 엔드포인트입니다.
- `DISABLE_LOCAL_PARSE=true`이면 비활성화됩니다.

---

## 2) List Games

`GET /api/v1/games?limit=10&offset=0`

### Example

```bash
curl "http://localhost:3000/api/v1/games?limit=20&offset=0"
```

### Response

```json
{
  "games": [
    {
      "id": 1,
      "host": "jjang9-pil",
      "player_count": 6,
      "upload_count": 3
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "reliability_summaries": {
    "1": {
      "m_of_n": "3/6",
      "upload_count": 3,
      "player_count": 6,
      "reliability": "50%"
    }
  }
}
```

---

## 3) Get Game

`GET /api/v1/games/:id`

### Example

```bash
curl http://localhost:3000/api/v1/games/1
```

### Response

```json
{
  "game": {
    "id": 1,
    "host": "jjang9-pil",
    "player_count": 6,
    "upload_count": 3,
    "players": [],
    "replay_files": []
  },
  "reliability_m_of_n": "3/6",
  "reliability": "50%"
}
```

---

## 4) Get Game Detail

`GET /api/v1/games/:id/detail`

시각화용 상세 데이터(APM timeline, build orders, chat messages)를 조회합니다.

### Example

```bash
curl http://localhost:3000/api/v1/games/1/detail
```

---

## 5) Delete Game

`DELETE /api/v1/games/:id`

### Example

```bash
curl -X DELETE http://localhost:3000/api/v1/games/1
```

### Response

```json
{
  "message": "Game deleted successfully"
}
```

---

## 6) Get Player Stats

`GET /api/v1/players/:name/stats`

플레이어 관점 통계(승률/APM/맵/매치업 등)를 조회합니다.

### Example

```bash
curl http://localhost:3000/api/v1/players/jjang9-pil/stats
```

---

## 6-1) Get User Suggestions

`GET /api/v1/users/suggest?q=j&limit=5`

사용자 이름 자동완성용 endpoint 입니다.

### Example

```bash
curl "http://localhost:3000/api/v1/users/suggest?q=j&limit=5"
```

---

## 6-2) Get Game Analyzer Status / Result

`GET /api/v1/games/:id/analyzer`

- analyzer row가 없으면 `status=not_requested`
- 완료되면 `result.quality_report`, `result.summary`, `result.analysis_phase` 반환

### Example

```bash
curl http://localhost:3000/api/v1/games/1/analyzer
```

---

## 6-3) 3v3 Rankings Snapshot

`GET /api/v1/rankings/3v3?page=1&page_size=20&sort_by=win_rate&sort_dir=desc&min_games=10`

### Example

```bash
curl "http://localhost:3000/api/v1/rankings/3v3?page=1&page_size=20&sort_by=win_rate&sort_dir=desc&min_games=10"
```

---

## 6-4) Race Matchup Snapshot

`GET /api/v1/analyzer/race-matchups?team_size=3&page=1&page_size=50&sort_by=games&sort_dir=desc`

### Example

```bash
curl "http://localhost:3000/api/v1/analyzer/race-matchups?team_size=3&page=1&page_size=50&sort_by=games&sort_dir=desc"
```

---

## 7) Health Check

`GET /health`

```bash
curl http://localhost:3000/health
```
