import { eq } from "drizzle-orm";
import { z } from "zod";
import { generateText } from "../ai/client.js";
import { SYSTEM_PROMPTS } from "../ai/prompts.js";
import { getDb, icps } from "../db/index.js";

export const linkedinTools = {
  search_linkedin: {
    description:
      "Search LinkedIn for people matching an ICP. Requires: icpId (number). Use create_icp first to define your ideal customer profile. Generates targeted search queries and checks for LinkedIn MCP availability.",
    schema: z.object({
      icpId: z.number().describe("ICP ID — get this from create_icp"),
      keywords: z.string().optional().describe("Additional search keywords"),
    }),
    handler: async (args: { icpId: number; keywords?: string }) => {
      const db = getDb();
      const icp = db.select().from(icps).where(eq(icps.id, args.icpId)).get();
      if (!icp) return { content: [{ type: "text" as const, text: "ICP not found" }] };

      // Use AI to generate proper search queries from the ICP
      const searchQueries = await generateText(
        "claude-sonnet-4-6",
        `You generate search queries to find INDIVIDUAL PEOPLE who match a customer profile.
You are NOT looking for companies, products, articles, or competitors.

Rules:
- Generate queries that find the PEOPLE, not the problem space or tools
- Use job titles, roles, and seniority levels as primary search terms
- For LinkedIn: use short keyword combos like "VP Engineering Series A" or "Head of Product fintech"
- For web search: use "site:linkedin.com/in" to find actual profiles
- Generate 3 LinkedIn keyword queries and 2 web search queries
- Each query should target a slightly different angle on the same ICP

Output JSON only:
{ "linkedinQueries": ["query1", "query2", "query3"], "webSearchQueries": ["query1", "query2"] }`,
        `Find people matching this Ideal Customer Profile:

Name: ${icp.name}
Demographics: ${icp.demographics}
Behaviors: ${icp.behaviors}
Pain Points: ${icp.painPoints}
Channels: ${icp.channels}
${args.keywords ? `Additional context: ${args.keywords}` : ""}`,
      );

      let queries: { linkedinQueries: string[]; webSearchQueries: string[] };
      try {
        queries = JSON.parse(searchQueries);
      } catch {
        queries = {
          linkedinQueries: [icp.name],
          webSearchQueries: [`site:linkedin.com/in ${icp.demographics}`],
        };
      }

      const linkedinSearchUrls = queries.linkedinQueries.map(
        (q) => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`,
      );

      const response = {
        icp: {
          name: icp.name,
          demographics: icp.demographics,
          behaviors: icp.behaviors,
          painPoints: icp.painPoints,
        },
        searchQueries: queries,
        linkedinSearchUrls,
        _instruction: `IMPORTANT: Follow these steps in order:

1. Check if you have access to a tool called "search_people" (from the LinkedIn MCP server).

2. IF "search_people" IS available:
   Run multiple searches using these LinkedIn queries to find different angles on the ICP:
   ${queries.linkedinQueries.map((q, i) => `   ${i + 1}. "${q}"`).join("\n")}
   Review the results and use add_contact to save people who genuinely match the ICP.
   IMPORTANT: Skip anyone who looks like a competitor or vendor — you want potential CUSTOMERS, not people selling similar products.

3. IF "search_people" IS NOT available, ask the user which option they'd prefer:
   a) Install the LinkedIn MCP server for direct search: https://github.com/stickerdaniel/linkedin-mcp-server
   b) Search LinkedIn manually using these links:
      ${linkedinSearchUrls.map((url, i) => `${i + 1}. ${url}`).join("\n      ")}
   c) Do a web search now to find people matching this ICP — use these queries:
      ${queries.webSearchQueries.map((q, i) => `${i + 1}. "${q}"`).join("\n      ")}
      IMPORTANT: Look for actual people's LinkedIn profiles or personal sites, NOT companies, tools, or articles about the space.

Then act on whatever the user chooses.`,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(response, null, 2) }] };
    },
  },

  get_linkedin_profile: {
    description:
      "Get details on a specific LinkedIn profile to inform outreach. Requires: linkedinUrl (string). Use this before generate_outreach to get context for personalizing the message.",
    schema: z.object({
      linkedinUrl: z
        .string()
        .describe("Full LinkedIn profile URL (e.g., https://www.linkedin.com/in/someone)"),
    }),
    handler: async ({ linkedinUrl }: { linkedinUrl: string }) => {
      const response = {
        linkedinUrl,
        _instruction: `IMPORTANT: Follow these steps in order:

1. Check if you have access to a tool called "get_person_profile" (from the LinkedIn MCP server).

2. IF "get_person_profile" IS available:
   Use it with this URL to get full profile details.
   The profile info can then be used to personalize outreach via generate_outreach.

3. IF "get_person_profile" IS NOT available, ask the user which option they'd prefer:
   a) Install the LinkedIn MCP server for direct profile access: https://github.com/stickerdaniel/linkedin-mcp-server
   b) Open the profile directly: ${linkedinUrl}
   c) Do a web search for this person to find public info about them

Then act on whatever the user chooses.`,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(response, null, 2) }] };
    },
  },

  suggest_channels: {
    description:
      "Suggest specific communities, platforms, events, and channels where your ICP congregates. Requires: icpId (number). Use create_icp first to define your ideal customer profile.",
    schema: z.object({
      icpId: z.number().describe("ICP ID — get this from create_icp"),
    }),
    handler: async ({ icpId }: { icpId: number }) => {
      const db = getDb();
      const icp = db.select().from(icps).where(eq(icps.id, icpId)).get();
      if (!icp) return { content: [{ type: "text" as const, text: "ICP not found" }] };

      const userMessage = `Suggest specific channels to find this customer segment:

ICP: ${icp.name}
Demographics: ${icp.demographics}
Behaviors: ${icp.behaviors}
Pain Points: ${icp.painPoints}
Known Channels: ${icp.channels}`;

      const suggestions = await generateText(
        "claude-sonnet-4-6",
        SYSTEM_PROMPTS.channelSuggestion,
        userMessage,
      );
      return { content: [{ type: "text" as const, text: suggestions }] };
    },
  },
};
