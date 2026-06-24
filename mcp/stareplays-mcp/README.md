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

소스코드를 clone하지 않고 설치하려면 GitHub npx 또는 raw installer를 사용합니다.

| 상황 | 권장 명령 |
| --- | --- |
| 동료가 저장소 clone 없이 설치 | `npx -y --package github:xungwoo/stareplays#main stareplays-mcp install --client both` |
| 회사/로컬 인증서 문제로 GitHub npx가 실패 | `curl -fsSL ... | node -` raw installer |
| 저장소를 clone한 개발자 | `node mcp/stareplays-mcp/bin/stareplays-mcp-install.mjs --client both` |

### GitHub npx 설치

```bash
npx -y --package github:xungwoo/stareplays#main stareplays-mcp install --client both --api-base-url https://stareplays-next-production.up.railway.app
```

이 명령은 MCP 실행 파일을 `~/.stareplays/mcp/stareplays-mcp` 아래에 설치하고, Claude Desktop/Codex 설정이 그 로컬 설치 경로를 바라보도록 수정합니다. Stareplays 전체 저장소를 clone할 필요는 없습니다.

GitHub npx 방식은 저장소 전체를 checkout하지 않습니다. npm이 GitHub tarball을 임시로 받아 CLI만 실행하고, CLI가 필요한 MCP runtime 파일을 `~/.stareplays/mcp/stareplays-mcp`에 복사합니다.

설치 위치를 바꾸려면:

```bash
npx -y --package github:xungwoo/stareplays#main stareplays-mcp install --client codex --install-dir ~/.local/share/stareplays-mcp
```

로컬/스테이징 API를 바라보게 하려면:

```bash
npx -y --package github:xungwoo/stareplays#main stareplays-mcp install --client both --api-base-url http://127.0.0.1:3100
```

### Raw installer 대체 설치

GitHub npx가 로컬 인증서 문제로 실패하는 환경에서는 GitHub raw installer를 사용할 수 있습니다.

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

## Raw endpoint 데이터

MCP 서버는 아래 Next.js route를 읽습니다.

```text
GET https://stareplays-next-production.up.railway.app/api/team-analysis/raw
GET https://stareplays-next-production.up.railway.app/api/team-analysis/raw?season_label=시즌7
```

현재 이 endpoint에는 별도 인증이 없습니다. 링크를 아는 사용자는 HTTP GET으로 JSON을 읽을 수 있습니다. 따라서 여기에 들어가는 데이터는 팀원들과 공유 가능한 3x3 시즌/전적 분석 데이터로 취급합니다.

### Query parameter

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `season_label` | 아니오 | 특정 시즌만 보고 싶을 때 사용합니다. 예: `시즌7`, `시즌8` |

### 응답 형태

최상위 schema는 아래 구조입니다.

```json
{
  "schemaVersion": "stareplays.team-analysis.raw.v1",
  "generatedAt": "2026-06-24T00:00:00.000Z",
  "scope": {
    "teamSize": "3x3",
    "seasonLabel": null
  },
  "source": {
    "totalGames": 123,
    "includedGameIds": [1, 2, 3],
    "seasons": ["시즌1", "시즌2"]
  },
  "analysis": {},
  "llm": {}
}
```

주요 필드:

| 필드 | 설명 |
| --- | --- |
| `schemaVersion` | raw payload 계약 버전입니다. 구조가 깨지는 변경이 있으면 버전을 올립니다. |
| `generatedAt` | 응답 생성 시각입니다. |
| `scope.teamSize` | 현재 MCP 분석 대상은 `3x3` 고정입니다. |
| `scope.seasonLabel` | 전체 시즌이면 `null`, 시즌 필터가 있으면 해당 시즌명입니다. |
| `source.totalGames` | 분석에 포함된 경기 수입니다. |
| `source.includedGameIds` | 분석에 포함된 game id 목록입니다. |
| `source.seasons` | payload에 포함된 시즌 라벨 목록입니다. |
| `analysis.summary` | 대시보드 상단 요약 지표입니다. 추적 조합, 최고 선수, 최강 종족, 모델 정보 등을 포함합니다. |
| `analysis.players` | 선수별 승패, 승률, 종족별 승률, APM/EAPM, Bradley-Terry, TrueSkill, 강점/약점입니다. |
| `analysis.lineups` | 3인 조합별 경기 수, 승패, 승률, 종족 조합입니다. |
| `analysis.raceCompositions` | 종족 조합별 승률과 표본 충족 여부입니다. 표본이 부족하면 dashboard에서 최강 판정에 신중하게 사용합니다. |
| `analysis.insights` | BEST/위험 조합, duo 궁합, 선수별 해설 카드 등 LLM이 참고하기 좋은 파생 insight입니다. |
| `analysis.chartData` | radar/bar/line chart 등에 쓰는 정규화된 시각화 데이터입니다. |
| `analysis.recentMatches` | 최근 경기 요약입니다. |
| `llm.promptTitle` | LLM 프롬프트 제목입니다. |
| `llm.promptContext` | LLM이 데이터를 해석할 때 따라야 할 기본 설명입니다. |
| `llm.suggestedQuestions` | Claude/Codex에서 바로 던질 수 있는 추천 질문입니다. |

### MCP 도구와 raw endpoint 매핑

| MCP surface | 내부 동작 |
| --- | --- |
| `get_team_analysis_raw` tool | raw endpoint JSON을 그대로 가져와 pretty JSON text로 반환합니다. |
| `get_team_analysis_prompt_bundle` tool | raw JSON과 `llm.promptContext`를 묶어 한국어 분석 프롬프트로 반환합니다. |
| `stareplays://team-analysis/raw` resource | 전체 시즌 raw JSON resource를 반환합니다. |
| `analyze_team_matchups` prompt | raw 데이터를 불러와 3x3 조합/선수/종족 분석 프롬프트 메시지를 생성합니다. |

### 주의사항

- raw endpoint는 snapshot 파일을 내려주는 것이 아니라 요청 시 Next route가 API 데이터를 읽고 page model을 생성해 반환합니다.
- 운영 endpoint는 현재 인증이 없으므로, 민감한 개인정보나 비공개 replay 원본 URL을 포함시키면 안 됩니다.
- Bradley-Terry와 TrueSkill은 단위가 다르므로 같은 숫자 축으로 직접 비교하지 말고 순위/상대 비교로 해석합니다.
- 종족 조합과 선수별 강점은 표본 수의 영향을 크게 받습니다. `games`, `qualified`, `note` 필드를 함께 보세요.

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
npx -y --package github:xungwoo/stareplays#main stareplays-mcp install --client both --api-base-url http://127.0.0.1:3100
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

### GitHub npx 설치가 404 또는 not found로 실패

브랜치명이나 저장소 접근 권한을 먼저 확인합니다. 그래도 실패하면 raw installer를 사용합니다.

```bash
curl -fsSL https://raw.githubusercontent.com/xungwoo/stareplays/main/mcp/stareplays-mcp/bin/stareplays-mcp-remote-install.mjs \
  | node - --client both
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
