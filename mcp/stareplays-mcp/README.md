# Stareplays MCP 설치 가이드

Stareplays 3x3 팀 분석 데이터를 Claude Desktop, Claude Code, Codex에서 MCP 도구처럼 쓰기 위한 로컬 커넥터입니다.

## 빠른 시작

Node.js 18 이상이 필요합니다.

Claude Desktop, Claude Code, Codex를 모두 설정하려면:

```bash
npx -y --package github:xungwoo/stareplays#main stareplays-mcp install --client all
```

설치 후 사용하는 클라이언트를 재시작하세요.

정상 설치 확인:

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | node ~/.stareplays/mcp/stareplays-mcp/bin/stareplays-mcp-server.mjs
```

정상이라면 `get_team_analysis_raw`, `get_team_analysis_prompt_bundle`가 출력됩니다.

## 설치 대상 선택

```bash
# Claude Desktop + Claude Code + Codex
npx -y --package github:xungwoo/stareplays#main stareplays-mcp install --client all

# Claude Desktop + Codex만
npx -y --package github:xungwoo/stareplays#main stareplays-mcp install --client both

# 개별 설치
npx -y --package github:xungwoo/stareplays#main stareplays-mcp install --client claude-desktop
npx -y --package github:xungwoo/stareplays#main stareplays-mcp install --client claude-code
npx -y --package github:xungwoo/stareplays#main stareplays-mcp install --client codex
```

`claude`는 `claude-desktop`의 별칭입니다. `both`는 기존 호환성을 위해 Claude Desktop + Codex만 의미합니다.

설치 CLI가 수정하는 파일:

- Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Claude Code: `~/.claude.json`의 현재 프로젝트 항목
- Codex: `~/.codex/config.toml`

설치된 MCP runtime은 기본적으로 `~/.stareplays/mcp/stareplays-mcp`에 복사됩니다. 클라이언트 설정은 npx 캐시가 아니라 이 안정적인 경로를 바라봅니다.

## 제공 기능

- Tool: `get_team_analysis_raw`
- Tool: `get_team_analysis_prompt_bundle`
- Resource: `stareplays://team-analysis/raw`
- Prompt: `analyze_team_matchups`

기본 API:

```text
https://stareplays-next-production.up.railway.app/api/team-analysis/raw
```

시즌 필터:

```text
https://stareplays-next-production.up.railway.app/api/team-analysis/raw?season_label=시즌7
```

## 자주 쓰는 옵션

```bash
npx -y --package github:xungwoo/stareplays#main stareplays-mcp install \
  --client all \
  --api-base-url https://stareplays-next-production.up.railway.app \
  --cache-ttl-seconds 300 \
  --timeout-ms 10000
```

로컬/스테이징 API를 쓰려면:

```bash
npx -y --package github:xungwoo/stareplays#main stareplays-mcp install \
  --client all \
  --api-base-url http://127.0.0.1:3100
```

Node TLS 인증서 오류가 나는 환경에서는 CA bundle을 지정할 수 있습니다.

```bash
npx -y --package github:xungwoo/stareplays#main stareplays-mcp install \
  --client all \
  --extra-ca-certs /opt/homebrew/etc/ca-certificates/cert.pem
```

## 대체 설치

GitHub npx가 로컬 인증서 문제로 실패하는 환경에서는 raw installer를 사용할 수 있습니다.

```bash
curl -fsSL https://raw.githubusercontent.com/xungwoo/stareplays/main/mcp/stareplays-mcp/bin/stareplays-mcp-remote-install.mjs \
  | node - --client all --api-base-url https://stareplays-next-production.up.railway.app
```

저장소를 이미 clone한 개발자는 로컬 CLI를 직접 실행할 수 있습니다.

```bash
node mcp/stareplays-mcp/bin/stareplays-mcp-install.mjs --client all
```

## Claude Code 수동 설정

자동 설치 대신 직접 등록하려면 프로젝트 루트에서 실행합니다.

```bash
claude mcp add stareplays \
  -e STAREPLAYS_API_BASE_URL=https://stareplays-next-production.up.railway.app \
  -e STAREPLAYS_MCP_CACHE_TTL_SECONDS=300 \
  -e STAREPLAYS_MCP_TIMEOUT_MS=10000 \
  -- node /ABSOLUTE/PATH/TO/stareplays/mcp/stareplays-mcp/bin/stareplays-mcp-server.mjs
```

확인:

```bash
claude mcp get stareplays
```

## 사용 예시

```text
Stareplays MCP의 get_team_analysis_prompt_bundle 도구로 시즌7 데이터를 가져와서
선수별 승률, 최적 3인 조합, 리스크 조합을 분석해줘.
```

## 문제 해결

- MCP 도구가 안 보이면 클라이언트를 완전히 종료 후 재시작하세요.
- Claude Code에서 안 보이면 프로젝트 루트에서 `claude mcp list`를 실행하세요.
- API 호출이 느리거나 실패하면 `--timeout-ms 15000`처럼 타임아웃을 늘려 다시 설치하세요.
- TLS 오류(`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`)가 나면 `--extra-ca-certs`를 지정하거나 raw installer를 사용하세요.

## 제거

- Claude Desktop: `claude_desktop_config.json`의 `mcpServers.stareplays` 항목 삭제
- Claude Code: 프로젝트 루트에서 `claude mcp remove stareplays -s local`
- Codex: `~/.codex/config.toml`의 `# >>> stareplays-mcp >>>`부터 `# <<< stareplays-mcp <<<`까지 삭제

설치된 runtime 파일까지 제거하려면:

```bash
rm -rf ~/.stareplays/mcp/stareplays-mcp
```
