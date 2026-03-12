import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, icps, contacts } from "../db/index.js";
import { generateText } from "../ai/client.js";
import { SYSTEM_PROMPTS } from "../ai/prompts.js";

export const linkedinTools = {
  search_linkedin: {
    description:
      "Search LinkedIn for people matching an ICP. Returns guidance on using LinkedIn MCP integration for actual search.",
    schema: z.object({
      icpId: z.number().describe("ICP ID to search for"),
      keywords: z.string().optional().describe("Additional search keywords"),
    }),
    handler: async (args: { icpId: number; keywords?: string }) => {
      const db = getDb();
      const icp = db.select().from(icps).where(eq(icps.id, args.icpId)).get();
      if (!icp) return { content: [{ type: "text" as const, text: "ICP not found" }] };

      // This tool provides search parameters — the actual LinkedIn search
      // would be done via the LinkedIn MCP server integration
      const searchParams = {
        icpName: icp.name,
        suggestedKeywords: [
          icp.demographics,
          icp.behaviors,
          args.keywords,
        ].filter(Boolean).join(", "),
        suggestedFilters: {
          demographics: icp.demographics,
          behaviors: icp.behaviors,
        },
        instruction:
          "Use the LinkedIn MCP server's search_people tool with these parameters to find matching profiles. Then use add_contact to save interesting leads.",
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(searchParams, null, 2) }] };
    },
  },

  get_linkedin_profile: {
    description: "Get details on a specific LinkedIn profile to inform outreach",
    schema: z.object({
      linkedinUrl: z.string().describe("LinkedIn profile URL"),
    }),
    handler: async ({ linkedinUrl }: { linkedinUrl: string }) => {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                linkedinUrl,
                instruction:
                  "Use the LinkedIn MCP server's get_person_profile tool with this URL to get profile details. The profile information can then be used to personalize outreach via generate_outreach.",
              },
              null,
              2
            ),
          },
        ],
      };
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
