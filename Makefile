.PHONY: run build test clean dev ranking-job ranking-job-daemon analyzer-job analyzer-job-daemon

# 개발 모드 실행
dev:
	go run cmd/server/main.go

# 빌드
build:
	go build -o bin/server cmd/server/main.go

# 실행
run: build
	./bin/server

# 테스트
test:
	go test -v ./...

# 랭킹 스냅샷 1회 집계
ranking-job:
	RANKING_JOB_MODE=once RANKING_MIN_GAMES=$${RANKING_MIN_GAMES:-20} go run ./cmd/ranking-job

# 랭킹 스냅샷 데몬 집계
ranking-job-daemon:
	RANKING_JOB_MODE=daemon RANKING_MIN_GAMES=$${RANKING_MIN_GAMES:-20} RANKING_JOB_INTERVAL=$${RANKING_JOB_INTERVAL:-10m} go run ./cmd/ranking-job

# 분석 스냅샷 1회 집계
analyzer-job:
	ANALYZER_JOB_MODE=once go run ./cmd/analyzer-job

# 분석 스냅샷 데몬 집계
analyzer-job-daemon:
	ANALYZER_JOB_MODE=daemon ANALYZER_JOB_INTERVAL=$${ANALYZER_JOB_INTERVAL:-10m} go run ./cmd/analyzer-job

# 의존성 정리
tidy:
	go mod tidy

# 클린
clean:
	rm -rf bin/
	rm -rf uploads/

# Docker (나중에 사용)
docker-build:
	docker build -t starcraft-stats .

docker-run:
	docker-compose up
