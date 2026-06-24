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
- Claude Desktop 또는 Codex MCP 클라이언트

## 빠른 설치

소스코드를 clone하지 않고 설치하려면 npx를 사용합니다.

| 상황 | 권장 명령 |
| --- | --- |
| npm registry에 `stareplays-mcp`가 publish된 뒤 | `npx -y stareplays-mcp install --client both` |
| publish 전, GitHub에서 바로 설치 | `npx -y --package github:xungwoo/stareplays#main stareplays-mcp install --client both` |
| 회사/로컬 인증서 문제로 GitHub npx가 실패 | `curl -fsSL ... | node -` raw installer |
| 저장소를 clone한 개발자 | `node mcp/stareplays-mcp/bin/stareplays-mcp-install.mjs --client both` |

### npm 패키지 설치

```bash
npx -y stareplays-mcp install --client both --api-base-url https://stareplays-next-production.up.railway.app
```

이 명령은 MCP 실행 파일을 `~/.stareplays/mcp/stareplays-mcp` 아래에 설치하고, Claude Desktop/Codex 설정이 그 로컬 설치 경로를 바라보도록 수정합니다. Stareplays 전체 저장소를 clone할 필요는 없습니다.

### npm publish 전 GitHub 설치

npm registry에 `stareplays-mcp`가 publish되기 전에는 GitHub package spec을 사용합니다.

```bash
npx -y --package github:xungwoo/stareplays#main stareplays-mcp install --client both --api-base-url https://stareplays-next-production.up.railway.app
```

GitHub npx 방식은 저장소 전체를 checkout하지 않습니다. npm이 GitHub tarball을 임시로 받아 CLI만 실행하고, CLI가 필요한 MCP runtime 파일을 `~/.stareplays/mcp/stareplays-mcp`에 복사합니다.

설치 위치를 바꾸려면:

```bash
npx -y stareplays-mcp install --client codex --install-dir ~/.local/share/stareplays-mcp
```

로컬/스테이징 API를 바라보게 하려면:

```bash
npx -y stareplays-mcp install --client both --api-base-url http://127.0.0.1:3100
```

### npm publish 전 대체 설치

`stareplays-mcp` 패키지가 아직 npm registry에 publish되지 않은 환경에서는 GitHub raw installer를 사용할 수 있습니다.

```bash
curl -fsSL https://raw.githubusercontent.com/xungwoo/stareplays/main/mcp/stareplays-mcp/bin/stareplays-mcp-remote-install.mjs \
  | node - --client both --api-base-url https://stareplays-next-production.up.railway.app
```

```bash
curl -fsSL https://raw.githubusercontent.com/xungwoo/stareplays/main/mcp/stareplays-mcp/bin/stareplays-mcp-remote-install.mjs \
  | node - --client codex --install-dir ~/.local/share/stareplays-mcp
```

특정 브랜치나 태그의 MCP 런타임을 설치하려면:

```bash
curl -fsSL https://raw.githubusercontent.com/xungwoo/stareplays/main/mcp/stareplays-mcp/bin/stareplays-mcp-remote-install.mjs \
  | node - --ref main --client both
```

## 개발자 설치

저장소를 clone한 개발자는 로컬 파일을 직접 설정에 등록할 수 있습니다.

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

## 설치 후 생성되는 구조

기본 설치 경로:

```text
~/.stareplays/mcp/stareplays-mcp/
  bin/
    stareplays-mcp-server.mjs
  lib/
    client.mjs
    mcp-server.mjs
    prompt-bundle.mjs
    stdio.mjs
```

Claude/Codex 설정은 npx 캐시 경로가 아니라 위의 안정적인 설치 경로를 바라봅니다. npx 캐시는 삭제될 수 있으므로 MCP 클라이언트 설정에 직접 넣지 않습니다.

## 설치 확인

MCP 서버가 도구 목록을 반환하는지 로컬에서 확인할 수 있습니다.

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | node ~/.stareplays/mcp/stareplays-mcp/bin/stareplays-mcp-server.mjs
```

정상이라면 `get_team_analysis_raw`, `get_team_analysis_prompt_bundle`가 포함된 JSON-RPC 응답이 출력됩니다.

저장소 clone 방식으로 설치했다면 `node mcp/stareplays-mcp/bin/stareplays-mcp-server.mjs`로 확인해도 됩니다.

운영 raw endpoint가 응답하는지도 확인할 수 있습니다.

```bash
curl -s https://stareplays-next-production.up.railway.app/api/team-analysis/raw \
  | jq '{schemaVersion, totalGames: .source.totalGames, gamesAnalyzed: .analysis.summary.gamesAnalyzed}'
```

Claude Desktop 또는 Codex 안에서 확인할 때는 클라이언트를 재시작한 뒤 `get_team_analysis_raw` 또는 `get_team_analysis_prompt_bundle` 도구가 보이는지 확인합니다.

## Claude Desktop 수동 설정

자동 설치 대신 직접 설정하려면 `~/Library/Application Support/Claude/claude_desktop_config.json`에 아래 항목을 추가합니다.

```json
{
  "mcpServers": {
    "stareplays": {
      "command": "node",
      "args": ["/Users/YOU/.stareplays/mcp/stareplays-mcp/bin/stareplays-mcp-server.mjs"],
      "env": {
        "STAREPLAYS_API_BASE_URL": "https://stareplays-next-production.up.railway.app"
      }
    }
  }
}
```

`args` 경로는 원격 설치 위치 또는 clone한 저장소의 절대 경로로 바꿔야 합니다.

## Codex 수동 설정

자동 설치 대신 직접 설정하려면 `~/.codex/config.toml`에 아래 항목을 추가합니다.

```toml
[mcp_servers.stareplays]
command = "node"
args = ["/Users/YOU/.stareplays/mcp/stareplays-mcp/bin/stareplays-mcp-server.mjs"]

[mcp_servers.stareplays.env]
STAREPLAYS_API_BASE_URL = "https://stareplays-next-production.up.railway.app"
```

`args` 경로는 원격 설치 위치 또는 clone한 저장소의 절대 경로로 바꿔야 합니다.

## 로컬/스테이징 API 연결

다른 API 서버를 사용하려면 설치 시 base URL을 바꿉니다.

```bash
npx -y stareplays-mcp install --client both --api-base-url http://127.0.0.1:3100
```

또는 서버 실행 시 환경변수로 지정합니다.

```bash
STAREPLAYS_API_BASE_URL=https://stareplays-next-production.up.railway.app \
node ~/.stareplays/mcp/stareplays-mcp/bin/stareplays-mcp-server.mjs
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

설치된 runtime 파일까지 제거하려면:

```bash
rm -rf ~/.stareplays/mcp/stareplays-mcp
```

## 문제 해결

### `npx -y stareplays-mcp ...`가 404 또는 not found로 실패

아직 npm registry에 publish되지 않았을 수 있습니다. 이 경우 GitHub npx 설치를 사용합니다.

```bash
npx -y --package github:xungwoo/stareplays#main stareplays-mcp install --client both
```

### GitHub npx가 `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`로 실패

로컬 npm/Node가 GitHub TLS 인증서를 신뢰하지 못하는 환경입니다. 이 경우 raw installer를 사용하거나, 회사/로컬 CA 설정을 npm에 추가해야 합니다.

```bash
curl -fsSL https://raw.githubusercontent.com/xungwoo/stareplays/main/mcp/stareplays-mcp/bin/stareplays-mcp-remote-install.mjs \
  | node - --client both
```

### Claude/Codex에서 도구가 보이지 않음

1. Claude Desktop 또는 Codex를 완전히 재시작합니다.
2. 설정 파일에 `stareplays` 항목이 들어갔는지 확인합니다.
3. 아래 명령으로 MCP 서버가 직접 응답하는지 확인합니다.

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | node ~/.stareplays/mcp/stareplays-mcp/bin/stareplays-mcp-server.mjs
```

### 다른 API 서버를 보게 하고 싶음

다시 설치하면서 `--api-base-url`만 바꾸면 설정이 갱신됩니다.

```bash
npx -y --package github:xungwoo/stareplays#main stareplays-mcp install \
  --client both \
  --api-base-url http://127.0.0.1:3100
```
