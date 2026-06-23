# Stareplays MCP 설치 가이드

Stareplays 3x3 팀 분석 raw data를 Claude Desktop, Claude Code 호환 클라이언트, Codex MCP 클라이언트에서 로컬 도구처럼 쓰기 위한 MCP 커넥터입니다.

이 방식은 Stareplays 서버가 LLM API key를 보관하지 않습니다. 개인 Claude/Codex 클라이언트가 로컬 MCP 서버를 실행하고, MCP 서버가 Stareplays raw endpoint를 읽어서 분석용 JSON/프롬프트 번들을 제공합니다.

## 제공 기능

- Tool: `get_team_analysis_raw`
- Tool: `get_team_analysis_prompt_bundle`
- Resource: `stareplays://team-analysis/raw`
- Prompt: `analyze_team_matchups`

기본 raw endpoint:

```text
https://stareplays-next-production.up.railway.app/api/team-analysis/raw
```

## 사전 조건

- Node.js 18 이상
- 이 저장소를 로컬에 clone한 상태
- Claude Desktop 또는 Codex MCP 클라이언트

## 빠른 설치

```bash
node mcp/stareplays-mcp/bin/stareplays-mcp-install.mjs --client both --api-base-url https://stareplays-next-production.up.railway.app
```

지원 클라이언트:

- `--client claude`
- `--client codex`
- `--client both`

설치 CLI가 수정하는 파일:

- Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Codex: `~/.codex/config.toml`

설치 후 대상 클라이언트를 재시작하세요.

## 설치 확인

MCP 서버가 도구 목록을 반환하는지 로컬에서 확인할 수 있습니다.

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | node mcp/stareplays-mcp/bin/stareplays-mcp-server.mjs
```

정상이라면 `get_team_analysis_raw`, `get_team_analysis_prompt_bundle`가 포함된 JSON-RPC 응답이 출력됩니다.

운영 raw endpoint가 응답하는지도 확인할 수 있습니다.

```bash
curl -s https://stareplays-next-production.up.railway.app/api/team-analysis/raw \
  | jq '{schemaVersion, totalGames: .source.totalGames, gamesAnalyzed: .analysis.summary.gamesAnalyzed}'
```

## Claude Desktop 수동 설정

자동 설치 대신 직접 설정하려면 `~/Library/Application Support/Claude/claude_desktop_config.json`에 아래 항목을 추가합니다.

```json
{
  "mcpServers": {
    "stareplays": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/stareplays/mcp/stareplays-mcp/bin/stareplays-mcp-server.mjs"],
      "env": {
        "STAREPLAYS_API_BASE_URL": "https://stareplays-next-production.up.railway.app"
      }
    }
  }
}
```

`args` 경로는 clone한 저장소의 절대 경로로 바꿔야 합니다.

## Codex 수동 설정

자동 설치 대신 직접 설정하려면 `~/.codex/config.toml`에 아래 항목을 추가합니다.

```toml
[mcp_servers.stareplays]
command = "node"
args = ["/ABSOLUTE/PATH/TO/stareplays/mcp/stareplays-mcp/bin/stareplays-mcp-server.mjs"]

[mcp_servers.stareplays.env]
STAREPLAYS_API_BASE_URL = "https://stareplays-next-production.up.railway.app"
```

`args` 경로는 clone한 저장소의 절대 경로로 바꿔야 합니다.

## 로컬/스테이징 API 연결

다른 API 서버를 사용하려면 설치 시 base URL을 바꿉니다.

```bash
node mcp/stareplays-mcp/bin/stareplays-mcp-install.mjs --client both --api-base-url http://127.0.0.1:3100
```

또는 서버 실행 시 환경변수로 지정합니다.

```bash
STAREPLAYS_API_BASE_URL=https://stareplays-next-production.up.railway.app \
node mcp/stareplays-mcp/bin/stareplays-mcp-server.mjs
```

## 사용 예시

Claude/Codex에서 MCP가 로드된 뒤 이런 식으로 요청할 수 있습니다.

```text
Stareplays MCP의 get_team_analysis_prompt_bundle 도구로 전체 시즌 데이터를 가져와서
성우, 민혁, 성민, 기용, 명진, 필균 기준 최적 3인 조합과 리스크 조합을 분석해줘.
```

시즌별로 보고 싶다면:

```text
Stareplays MCP의 get_team_analysis_raw 도구를 seasonLabel=시즌7 인자로 호출해서
시즌7 선수별 승률 변화와 추천 조합을 분석해줘.
```

## 제거

자동 설치로 추가한 설정을 제거하려면:

- Claude Desktop: `claude_desktop_config.json`의 `mcpServers.stareplays` 항목 삭제
- Codex: `~/.codex/config.toml`의 `# >>> stareplays-mcp >>>`부터 `# <<< stareplays-mcp <<<`까지 삭제
