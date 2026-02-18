.PHONY: run build test clean dev

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
