import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, icps, contacts } from "../db/index.js";
import { generateText } from "../ai/client.js";
import { SYSTEM_PROMPTS } from "../ai/prompts.js";

export const linkedinTools = {
  search_linkedin: {
    description:
      "Search LinkedIn for people matching an ICP. Checks for LinkedIn MCP availability and offers fallback options.",
    schema: z.object({
      icpId: z.number().describe("ICP ID to search for"),
      keywords: z.string().optional().describe("Additional search keywords"),
    }),
    handler: async (args: { icpId: number; keywords?: string }) => {
      const db = getDb();
      const icp = db.select().from(icps).where(eq(icps.id, args.icpId)).get();
      if (!icp) return { content: [{ type: "text" as const, text: "ICP not found" }] };

      const searchKeywords = [icp.demographics, icp.behaviors, args.keywords]
        .filter(Boolean)
        .join(" ");

      const linkedinSearchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(searchKeywords)}`;

      const response = {
        icp: {
          name: icp.name,
          demographics: icp.demographics,
          behaviors: icp.behaviors,
          painPoints: icp.painPoints,
        },
        searchKeywords,
        linkedinSearchUrl,
        _instruction: `IMPORTANT: Follow these steps in order:

1. Check if you have access to a tool called "search_people" (from the LinkedIn MCP server).

2. IF "search_people" IS available:
   Use it directly with keywords: "${searchKeywords}"
   Then use add_contact to save any interesting profiles to this project.

3. IF "search_people" IS NOT available, ask the user which option they'd prefer:
   a) Install the LinkedIn MCP server for direct search integration: https://github.com/stickerdaniel/linkedin-mcp-server
   b) Search LinkedIn manually using this link: ${linkedinSearchUrl}
   c) Do a web search now to find people matching this ICP

Then act on whatever the user chooses.`,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(response, null, 2) }] };
    },
  },

  get_linkedin_profile: {
    description:
      "Get details on a specific LinkedIn profile. Checks for LinkedIn MCP availability and offers fallback options.",
    schema: z.object({
      linkedinUrl: z.string().describe("LinkedIn profile URL"),
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
    description: "Given an ICP, suggest communities, platforms, events where these people congregate",
    schema: z.object({
      icpId: z.number().describe("ICP ID"),
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
        userMessage
      );
      return { content: [{ type: "text" as const, text: suggestions }] };
    },
  },
};
