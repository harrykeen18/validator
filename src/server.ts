import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { projectTools } from "./tools/project.js";
import { customerTools } from "./tools/customer.js";
import { outreachTools } from "./tools/outreach.js";
import { coachingTools } from "./tools/coaching.js";
import { synthesisTools } from "./tools/synthesis.js";
import { linkedinTools } from "./tools/linkedin.js";
import { mcpPrompts } from "./prompts/index.js";
import {
  getProjectSummary,
  getProjectHypotheses,
  getProjectInsights,
  getProjectContacts,
} from "./resources/project.js";
import { MOM_TEST_PRINCIPLES, ANTI_PATTERNS } from "./resources/methodology.js";

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
  server.tool(name, tool.description, tool.schema.shape, tool.handler as any);
}

// Register resources
server.resource(
  "project-summary",
  "validator://project/{id}/summary",
  { description: "Current project state overview" },
  async (uri) => {
    const id = parseInt(uri.pathname.split("/")[2]);
    return { contents: [{ uri: uri.href, text: getProjectSummary(id), mimeType: "application/json" }] };
  }
);

server.resource(
  "project-hypotheses",
  "validator://project/{id}/hypotheses",
  { description: "All hypotheses with status and evidence" },
  async (uri) => {
    const id = parseInt(uri.pathname.split("/")[2]);
    return { contents: [{ uri: uri.href, text: getProjectHypotheses(id), mimeType: "application/json" }] };
  }
);

server.resource(
  "project-insights",
  "validator://project/{id}/insights",
  { description: "All recorded insights across calls" },
  async (uri) => {
    const id = parseInt(uri.pathname.split("/")[2]);
    return { contents: [{ uri: uri.href, text: getProjectInsights(id), mimeType: "application/json" }] };
  }
);

server.resource(
  "project-contacts",
  "validator://project/{id}/contacts",
  { description: "Contact list with statuses" },
  async (uri) => {
    const id = parseInt(uri.pathname.split("/")[2]);
    return { contents: [{ uri: uri.href, text: getProjectContacts(id), mimeType: "application/json" }] };
  }
);

server.resource(
  "mom-test",
  "validator://methodology/mom-test",
  { description: "Mom Test principles reference" },
  async (uri) => ({
    contents: [{ uri: uri.href, text: MOM_TEST_PRINCIPLES, mimeType: "text/markdown" }],
  })
);

server.resource(
  "anti-patterns",
  "validator://methodology/anti-patterns",
  { description: "Common founder mistakes in discovery" },
  async (uri) => ({
    contents: [{ uri: uri.href, text: ANTI_PATTERNS, mimeType: "text/markdown" }],
  })
);

// Register prompts
for (const [name, prompt] of Object.entries(mcpPrompts)) {
  server.prompt(name, prompt.description, prompt.arguments as any, (args: any) => ({
    messages: prompt.getMessages(args),
  }));
}

// Start server
async function main() {
  const config = loadConfig();

  if (config.transport === "stdio") {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Validator MCP server running on stdio");
  } else {
    // SSE transport for hosted mode — to be implemented
    throw new Error("SSE transport not yet implemented. Use TRANSPORT=stdio.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
