# Analyzer Job 요약

`Game_Analyzer : Race_Composition_WinRate`는 실시간 전체 집계가 아닌 snapshot 기반으로 동작합니다.

## 구성

- 실행 엔트리: `cmd/analyzer-job/main.go`
- 집계 서비스: `internal/services/analyzer/service.go`
- snapshot 테이블: `analyzer_race_matchups` (`ent/schema/analyzer_race_matchup.go`)
- 조회 API: `GET /api/v1/analyzer/race-matchups`

## 집계 방식

1. advisory lock 획득 (`pg_try_advisory_xact_lock`)
2. strict 팀전 게임(2팀, 팀원 수 동일, winner 존재) 선별
3. 팀별 race composition 문자열 생성 (예: `PPT`, `TZZ`)
4. matchup canonical ordering (`team_a <= team_b`)
5. `games`, `team_a_wins`, `team_b_wins`, 승률 집계
6. 기존 snapshot 삭제 후 새 스냅샷 적재

## 실행 방법

### once

```bash
ANALYZER_JOB_MODE=once go run ./cmd/analyzer-job
```

### daemon

```bash
ANALYZER_JOB_MODE=daemon ANALYZER_JOB_INTERVAL=10m go run ./cmd/analyzer-job
```

## Railway Cron 권장

cron에서는 `once` 모드 사용 권장:

```bash
ANALYZER_JOB_MODE=once go run ./cmd/analyzer-job
```

예시 주기: `*/10 * * * *`
