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
      apiBaseUrl: "https://stareplays.example"
    });

    const claudeConfig = JSON.parse(await readFile(result.claudeConfigPath, "utf8"));
    assert.equal(claudeConfig.mcpServers.stareplays.command, "node");
    assert.deepEqual(claudeConfig.mcpServers.stareplays.args, ["/repo/mcp/stareplays-mcp/bin/stareplays-mcp-server.mjs"]);
    assert.equal(claudeConfig.mcpServers.stareplays.env.STAREPLAYS_API_BASE_URL, "https://stareplays.example");

    const codexConfig = await readFile(result.codexConfigPath, "utf8");
    assert.match(codexConfig, /\[mcp_servers\.stareplays\]/);
    assert.match(codexConfig, /command = "node"/);
    assert.match(codexConfig, /STAREPLAYS_API_BASE_URL = "https:\/\/stareplays.example"/);
  } finally {
    await rm(homeDir, { recursive: true, force: true });
  }
});
