import crypto from "node:crypto";
import http from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfig } from "./config.js";
import { mcpPrompts } from "./prompts/index.js";
import { ANTI_PATTERNS, HARRY_TIPS, MOM_TEST_PRINCIPLES } from "./resources/methodology.js";
import {
  getProjectContacts,
  getProjectHypotheses,
  getProjectInsights,
  getProjectSummary,
} from "./resources/project.js";
import { coachingTools } from "./tools/coaching.js";
import { customerTools } from "./tools/customer.js";
import { linkedinTools } from "./tools/linkedin.js";
import { outreachTools } from "./tools/outreach.js";
import { projectTools } from "./tools/project.js";
import { synthesisTools } from "./tools/synthesis.js";

function createServer(): McpServer {
  const server = new McpServer({
    name: "validator",
    version: "0.1.0",
  });

  // Register all tools
  const allTools = {
    ...projectTools,
    ...customerTools,
    ...outreachTools,
    ...coachingTools,
    ...synthesisTools,
    ...linkedinTools,
  };

  for (const [name, tool] of Object.entries(allTools)) {
    const shape = tool.schema.shape;
    if (Object.keys(shape).length === 0) {
      server.tool(name, tool.description, tool.handler as any);
    } else {
      server.tool(name, tool.description, shape, tool.handler as any);
    }
  }

  // Register resources
  server.resource(
    "project-summary",
    "validator://project/{id}/summary",
    { description: "Current project state overview" },
    async (uri) => {
      const id = parseInt(uri.pathname.split("/")[2], 10);
      return {
        contents: [
          { uri: uri.href, text: await getProjectSummary(id), mimeType: "application/json" },
        ],
      };
    },
  );

  server.resource(
    "project-hypotheses",
    "validator://project/{id}/hypotheses",
    { description: "All hypotheses with status and evidence" },
    async (uri) => {
      const id = parseInt(uri.pathname.split("/")[2], 10);
      return {
        contents: [
          { uri: uri.href, text: await getProjectHypotheses(id), mimeType: "application/json" },
        ],
      };
    },
  );

  server.resource(
    "project-insights",
    "validator://project/{id}/insights",
    { description: "All recorded insights across calls" },
    async (uri) => {
      const id = parseInt(uri.pathname.split("/")[2], 10);
      return {
        contents: [
          { uri: uri.href, text: await getProjectInsights(id), mimeType: "application/json" },
        ],
      };
    },
  );

  server.resource(
    "project-contacts",
    "validator://project/{id}/contacts",
    { description: "Contact list with statuses" },
    async (uri) => {
      const id = parseInt(uri.pathname.split("/")[2], 10);
      return {
        contents: [
          { uri: uri.href, text: await getProjectContacts(id), mimeType: "application/json" },
        ],
      };
    },
  );

  server.resource(
    "mom-test",
    "validator://methodology/mom-test",
    { description: "Mom Test principles reference" },
    async (uri) => ({
      contents: [{ uri: uri.href, text: MOM_TEST_PRINCIPLES, mimeType: "text/markdown" }],
    }),
  );

  server.resource(
    "anti-patterns",
    "validator://methodology/anti-patterns",
    { description: "Common founder mistakes in discovery" },
    async (uri) => ({
      contents: [{ uri: uri.href, text: ANTI_PATTERNS, mimeType: "text/markdown" }],
    }),
  );

  server.resource(
    "harry-tips",
    "validator://methodology/harry-tips",
    { description: "Practical tips on outreach, call techniques, and staying objective" },
    async (uri) => ({
      contents: [{ uri: uri.href, text: HARRY_TIPS, mimeType: "text/markdown" }],
    }),
  );

  // Register prompts
  for (const [name, prompt] of Object.entries(mcpPrompts)) {
    server.prompt(name, prompt.description, prompt.arguments as any, (args: any) => ({
      messages: prompt.getMessages(args),
    }));
  }

  return server;
}

// Start server
const config = loadConfig();

if (config.transport === "sse") {
  const port = config.port;

  const sessions = new Map<
    string,
    { transport: StreamableHTTPServerTransport; server: McpServer }
  >();

  const httpServer = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (req.url === "/mcp" || req.url === "/mcp/") {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!;
        await session.transport.handleRequest(req, res);
        return;
      }

      if (sessionId && !sessions.has(sessionId)) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Session not found. Please reconnect." },
            id: null,
          }),
        );
        return;
      }

      if (req.method === "POST") {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
        });
        const server = createServer();

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) sessions.delete(sid);
        };

        await server.connect(transport);
        await transport.handleRequest(req, res);

        const sid = transport.sessionId;
        if (sid) {
          sessions.set(sid, { transport, server });
        }
        return;
      }

      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Bad request — no valid session" }));
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  httpServer.listen(port, () => {
    console.error(`[validator] HTTP server listening on port ${port}`);
    console.error(`[validator] MCP endpoint: http://localhost:${port}/mcp`);
  });
} else {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[validator] Server started (stdio)");
}
