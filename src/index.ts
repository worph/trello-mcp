import express from "express";
import { TrelloClient } from "./trello-client.js";
import { MCPServer } from "./mcp-server.js";
import { createDiscoveryResponder } from "./mcp-announce.js";
import { loadStoredConfig, saveStoredConfig, StoredConfig } from "./config-store.js";
import { getIndexHtml, getCallbackHtml } from "./web-ui.js";

let trelloClient: TrelloClient | null = null;
let mcpServer: MCPServer | null = null;
let cachedUsername: string | null = null;

function resolveConfig(): StoredConfig {
  const stored = loadStoredConfig();
  return {
    apiKey: stored.apiKey || process.env.TRELLO_API_KEY,
    token: stored.token || process.env.TRELLO_TOKEN,
    boardId: stored.boardId || process.env.TRELLO_BOARD_ID,
    workspaceId: stored.workspaceId || process.env.TRELLO_WORKSPACE_ID,
  };
}

async function initTrelloClient(config: StoredConfig): Promise<boolean> {
  cachedUsername = null;

  if (!config.apiKey || !config.token) {
    console.log("Trello credentials not configured yet");
    trelloClient = null;
    mcpServer = null;
    return false;
  }

  try {
    const client = new TrelloClient({
      apiKey: config.apiKey,
      token: config.token,
      boardId: config.boardId,
      workspaceId: config.workspaceId,
    });

    // Verify credentials by fetching current user
    const me = await client.getMe();
    cachedUsername = me.fullName || me.username;
    console.log(`Authenticated as: ${cachedUsername}`);

    trelloClient = client;
    mcpServer = new MCPServer(trelloClient);

    if (config.boardId) {
      try {
        await trelloClient.setActiveBoard(config.boardId);
        console.log(`Active board set to: ${config.boardId}`);
      } catch (err) {
        console.warn(`Could not set active board: ${err}`);
      }
    }

    if (config.workspaceId) {
      try {
        await trelloClient.setActiveWorkspace(config.workspaceId);
        console.log(`Active workspace set to: ${config.workspaceId}`);
      } catch (err) {
        console.warn(`Could not set active workspace: ${err}`);
      }
    }

    return true;
  } catch (err) {
    console.error("Failed to authenticate with Trello:", err instanceof Error ? err.message : err);
    trelloClient = null;
    mcpServer = null;
    return false;
  }
}

async function main(): Promise<void> {
  const httpPort = parseInt(process.env.WEB_PORT || "9100");
  const discoveryPort = parseInt(process.env.DISCOVERY_PORT || "9099");
  const baseUrl = process.env.BASE_URL || `http://localhost:${httpPort}`;

  // Initialize from stored config or env vars
  const config = resolveConfig();
  await initTrelloClient(config);

  const app = express();

  // Web UI
  app.get("/", (_req, res) => {
    res.type("html").send(getIndexHtml(baseUrl));
  });

  // OAuth callback page
  app.get("/callback", (_req, res) => {
    res.type("html").send(getCallbackHtml());
  });

  // Config API — GET returns current state
  app.get("/api/config", (_req, res) => {
    const cfg = resolveConfig();
    res.json({
      apiKey: cfg.apiKey || "",
      hasToken: !!cfg.token,
      boardId: cfg.boardId || "",
      workspaceId: cfg.workspaceId || "",
      connected: trelloClient !== null,
      username: cachedUsername || null,
    });
  });

  // Config API — POST saves config (token optional, merges with existing)
  app.post("/api/config", express.json(), async (req, res) => {
    try {
      const { apiKey, token, boardId, workspaceId } = req.body;
      const existing = loadStoredConfig();

      const newConfig: StoredConfig = {
        apiKey: apiKey?.trim() || existing.apiKey,
        token: token?.trim() || existing.token,
        boardId: boardId?.trim() || existing.boardId,
        workspaceId: workspaceId?.trim() || existing.workspaceId,
      };

      if (!newConfig.apiKey) {
        res.status(400).json({ error: "API Key is required" });
        return;
      }

      saveStoredConfig(newConfig);

      if (newConfig.token) {
        const connected = await initTrelloClient(newConfig);
        res.json({
          message: connected
            ? `Connected as ${cachedUsername}`
            : "Credentials saved but could not connect — check your API key and token",
          connected,
          username: cachedUsername,
        });
      } else {
        res.json({ message: "API key saved. Authorize with Trello to complete setup.", connected: false });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // Token API — POST receives token from callback (fallback for same-tab flow)
  app.post("/api/token", express.json(), async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        res.status(400).json({ error: "Token is required" });
        return;
      }

      const existing = loadStoredConfig();
      if (!existing.apiKey) {
        res.status(400).json({ error: "API key not set. Go back and enter it first." });
        return;
      }

      const newConfig: StoredConfig = { ...existing, token: token.trim() };
      saveStoredConfig(newConfig);
      const connected = await initTrelloClient(newConfig);

      res.json({
        connected,
        username: cachedUsername,
        error: connected ? undefined : "Could not connect with this token",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // MCP endpoint
  app.use("/mcp", (req, res, next) => {
    if (!mcpServer) {
      res.status(503).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Trello credentials not configured. Visit the web UI to set them up." },
        id: null,
      });
      return;
    }
    mcpServer.createRouter()(req, res, next);
  });

  const server = app.listen(httpPort, () => {
    console.log(`trello-mcp listening on http://0.0.0.0:${httpPort}`);
    console.log(`Web UI: http://0.0.0.0:${httpPort}/`);
    console.log(`MCP endpoint: http://0.0.0.0:${httpPort}/mcp`);
  });

  // Beacon UDP discovery (port 9099, announces HTTP port for MCP calls)
  const dummyServer = new MCPServer(
    new TrelloClient({ apiKey: "pending", token: "pending" })
  );
  createDiscoveryResponder({
    name: "trello-mcp",
    description:
      "Trello board management — cards, lists, checklists, comments, labels, members, and more",
    tools: dummyServer.getToolDefinitions(),
    port: httpPort,
    listenPort: discoveryPort,
  });

  // Graceful shutdown
  function shutdown(signal: string): void {
    console.log(`\nReceived ${signal}, shutting down...`);
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
