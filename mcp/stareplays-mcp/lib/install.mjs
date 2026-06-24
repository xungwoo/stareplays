import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_API_BASE_URL, DEFAULT_CACHE_TTL_SECONDS, DEFAULT_TIMEOUT_MS } from "./client.mjs";

const markerStart = "# >>> stareplays-mcp >>>";
const markerEnd = "# <<< stareplays-mcp <<<";

function jsonString(value) {
  return JSON.stringify(value);
}

function defaultServerPath() {
  return fileURLToPath(new URL("../bin/stareplays-mcp-server.mjs", import.meta.url));
}

async function readJsonIfExists(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function readTextIfExists(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

const defaultExtraCaCertPaths = [
  "/opt/homebrew/etc/ca-certificates/cert.pem",
  "/usr/local/etc/ca-certificates/cert.pem",
  "/etc/ssl/cert.pem",
  "/etc/ssl/certs/ca-certificates.crt"
];

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function detectExtraCaCerts() {
  for (const path of defaultExtraCaCertPaths) {
    if (await fileExists(path)) return path;
  }
  return null;
}

function mcpEnv({ apiBaseUrl, cacheTtlSeconds, timeoutMs, extraCaCerts }) {
  const env = {
    STAREPLAYS_API_BASE_URL: apiBaseUrl,
    STAREPLAYS_MCP_CACHE_TTL_SECONDS: String(cacheTtlSeconds),
    STAREPLAYS_MCP_TIMEOUT_MS: String(timeoutMs)
  };

  if (extraCaCerts) {
    env.NODE_EXTRA_CA_CERTS = extraCaCerts;
  }

  return env;
}

async function writeClaudeConfig({ homeDir, serverPath, apiBaseUrl, cacheTtlSeconds, timeoutMs, extraCaCerts }) {
  const configPath = join(homeDir, "Library", "Application Support", "Claude", "claude_desktop_config.json");
  const config = await readJsonIfExists(configPath, {});
  config.mcpServers = {
    ...(config.mcpServers ?? {}),
    stareplays: {
      command: "node",
      args: [serverPath],
      env: mcpEnv({ apiBaseUrl, cacheTtlSeconds, timeoutMs, extraCaCerts })
    }
  };

  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

  return configPath;
}

function replaceMarkedBlock(text, block) {
  const pattern = new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}\\n?`, "m");
  const nextBlock = `${markerStart}\n${block}\n${markerEnd}\n`;

  return pattern.test(text) ? text.replace(pattern, nextBlock) : `${text.trimEnd()}\n\n${nextBlock}`;
}

async function writeCodexConfig({ homeDir, serverPath, apiBaseUrl, cacheTtlSeconds, timeoutMs, extraCaCerts }) {
  const configPath = join(homeDir, ".codex", "config.toml");
  const current = await readTextIfExists(configPath);
  const block = [
    "[mcp_servers.stareplays]",
    "command = \"node\"",
    `args = [${jsonString(serverPath)}]`,
    `[mcp_servers.stareplays.env]`,
    `STAREPLAYS_API_BASE_URL = ${jsonString(apiBaseUrl)}`,
    `STAREPLAYS_MCP_CACHE_TTL_SECONDS = ${jsonString(String(cacheTtlSeconds))}`,
    `STAREPLAYS_MCP_TIMEOUT_MS = ${jsonString(String(timeoutMs))}`,
    ...(extraCaCerts ? [`NODE_EXTRA_CA_CERTS = ${jsonString(extraCaCerts)}`] : [])
  ].join("\n");

  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, replaceMarkedBlock(current, block));

  return configPath;
}

async function writeClaudeCodeConfig({ homeDir, projectDir, serverPath, apiBaseUrl, cacheTtlSeconds, timeoutMs, extraCaCerts }) {
  const configPath = join(homeDir, ".claude.json");
  const config = await readJsonIfExists(configPath, {});
  const currentProject = config.projects?.[projectDir] ?? {};

  config.projects = {
    ...(config.projects ?? {}),
    [projectDir]: {
      ...currentProject,
      mcpServers: {
        ...(currentProject.mcpServers ?? {}),
        stareplays: {
          type: "stdio",
          command: "node",
          args: [serverPath],
          env: mcpEnv({ apiBaseUrl, cacheTtlSeconds, timeoutMs, extraCaCerts })
        }
      }
    }
  };

  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

  return configPath;
}

function selectedClients(client) {
  switch (client) {
    case "claude":
    case "claude-desktop":
      return { claudeDesktop: true, codex: false, claudeCode: false };
    case "codex":
      return { claudeDesktop: false, codex: true, claudeCode: false };
    case "claude-code":
      return { claudeDesktop: false, codex: false, claudeCode: true };
    case "both":
      return { claudeDesktop: true, codex: true, claudeCode: false };
    case "all":
      return { claudeDesktop: true, codex: true, claudeCode: true };
    default:
      throw new Error(`Unsupported client: ${client}. Use claude-desktop, claude-code, codex, both, or all.`);
  }
}

export async function installMcpConfig({
  client = "both",
  homeDir = process.env.HOME,
  projectDir = process.cwd(),
  serverPath = defaultServerPath(),
  apiBaseUrl = DEFAULT_API_BASE_URL,
  cacheTtlSeconds = DEFAULT_CACHE_TTL_SECONDS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  extraCaCerts = process.env.STAREPLAYS_MCP_EXTRA_CA_CERTS || process.env.NODE_EXTRA_CA_CERTS || undefined
} = {}) {
  if (!homeDir) throw new Error("HOME directory is required");

  const resolvedExtraCaCerts = extraCaCerts === undefined ? await detectExtraCaCerts() : extraCaCerts;

  const result = {
    claudeConfigPath: null,
    codexConfigPath: null,
    claudeCodeConfigPath: null,
    extraCaCerts: resolvedExtraCaCerts || null
  };
  const targets = selectedClients(client);

  if (targets.claudeDesktop) {
    result.claudeConfigPath = await writeClaudeConfig({ homeDir, serverPath, apiBaseUrl, cacheTtlSeconds, timeoutMs, extraCaCerts: resolvedExtraCaCerts });
  }

  if (targets.codex) {
    result.codexConfigPath = await writeCodexConfig({ homeDir, serverPath, apiBaseUrl, cacheTtlSeconds, timeoutMs, extraCaCerts: resolvedExtraCaCerts });
  }

  if (targets.claudeCode) {
    result.claudeCodeConfigPath = await writeClaudeCodeConfig({ homeDir, projectDir, serverPath, apiBaseUrl, cacheTtlSeconds, timeoutMs, extraCaCerts: resolvedExtraCaCerts });
  }

  return result;
}
