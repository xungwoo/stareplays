import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { installMcpConfig } from "../lib/install.mjs";

test("installs Claude Desktop and Codex MCP config entries", async () => {
  const homeDir = await mkdtemp(join(tmpdir(), "stareplays-mcp-"));

  try {
    const result = await installMcpConfig({
      client: "both",
      homeDir,
      serverPath: "/repo/mcp/stareplays-mcp/bin/stareplays-mcp-server.mjs",
      apiBaseUrl: "https://stareplays.example",
      cacheTtlSeconds: 60,
      timeoutMs: 1500,
      extraCaCerts: "/opt/homebrew/etc/ca-certificates/cert.pem"
    });

    const claudeConfig = JSON.parse(await readFile(result.claudeConfigPath, "utf8"));
    assert.equal(claudeConfig.mcpServers.stareplays.command, "node");
    assert.deepEqual(claudeConfig.mcpServers.stareplays.args, ["/repo/mcp/stareplays-mcp/bin/stareplays-mcp-server.mjs"]);
    assert.equal(claudeConfig.mcpServers.stareplays.env.STAREPLAYS_API_BASE_URL, "https://stareplays.example");
    assert.equal(claudeConfig.mcpServers.stareplays.env.STAREPLAYS_MCP_CACHE_TTL_SECONDS, "60");
    assert.equal(claudeConfig.mcpServers.stareplays.env.STAREPLAYS_MCP_TIMEOUT_MS, "1500");
    assert.equal(claudeConfig.mcpServers.stareplays.env.NODE_EXTRA_CA_CERTS, "/opt/homebrew/etc/ca-certificates/cert.pem");

    const codexConfig = await readFile(result.codexConfigPath, "utf8");
    assert.match(codexConfig, /\[mcp_servers\.stareplays\]/);
    assert.match(codexConfig, /command = "node"/);
    assert.match(codexConfig, /STAREPLAYS_API_BASE_URL = "https:\/\/stareplays.example"/);
    assert.match(codexConfig, /STAREPLAYS_MCP_CACHE_TTL_SECONDS = "60"/);
    assert.match(codexConfig, /STAREPLAYS_MCP_TIMEOUT_MS = "1500"/);
    assert.match(codexConfig, /NODE_EXTRA_CA_CERTS = "\/opt\/homebrew\/etc\/ca-certificates\/cert\.pem"/);
  } finally {
    await rm(homeDir, { recursive: true, force: true });
  }
});
