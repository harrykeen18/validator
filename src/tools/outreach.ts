import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { getDb, outreachMessages, contacts } from "../db/index.js";
import { generateText } from "../ai/client.js";
import { SYSTEM_PROMPTS } from "../ai/prompts.js";

export const outreachTools = {
  generate_outreach: {
    description:
      "Generate a personalized outreach message for a contact. Requires: contactId (number), channel (email/linkedin/twitter/community). The contact must already exist — use add_contact first. Follows best practices: short, specific, no pitch, easy to say yes.",
    schema: z.object({
      contactId: z.number().describe("Contact ID — get this from add_contact or list_contacts"),
      channel: z.enum(["email", "linkedin", "twitter", "community"]).describe("Outreach channel"),
      context: z.string().optional().describe("Additional context: something specific about this person that can personalize the message (e.g., a blog post they wrote, a talk they gave)"),
    }),
    handler: async (args: { contactId: number; channel: string; context?: string }) => {
      const db = getDb();
      const contact = db.select().from(contacts).where(eq(contacts.id, args.contactId)).get();
      if (!contact) return { content: [{ type: "text" as const, text: "Contact not found. Use add_contact to add them first, or list_contacts to find the right contactId." }] };

      const userMessage = `Generate a ${args.channel} outreach message for:
Name: ${contact.name}
Company: ${contact.company || "Unknown"}
Role: ${contact.role || "Unknown"}
Channel: ${args.channel}
${contact.notes ? `Notes: ${contact.notes}` : ""}
${args.context ? `Additional context: ${args.context}` : ""}`;

      const message = await generateText("claude-sonnet-4-6", SYSTEM_PROMPTS.outreach, userMessage);

      const result = db
        .insert(outreachMessages)
        .values({
          contactId: args.contactId,
          channel: args.channel as "email" | "linkedin" | "twitter" | "community",
          content: message,
        })
        .returning()
        .get();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                ...result,
                _nextStep:
                  "Here's your draft — but you'll want to manually edit it to add a genuine personal touch. AI-generated messages are a starting point, not the final version. Once you're happy, send it yourself and let me know so I'll log it with update_outreach_status. Tip: cold outreach response rates will be low, but that's fine — the response rate itself is signal. Bolster with 1st and 2nd degree connections too. If you want a different angle, use suggest_outreach_variant.",
              },
              null,
              2
            ),
          },
        ],
      };
    },
  },

  list_outreach: {
    description:
      "View all outreach messages with send status and response tracking. Optional: filter by contactId (number).",
    schema: z.object({
      contactId: z.number().optional().describe("Filter by contact ID — get this from list_contacts"),
    }),
    handler: async ({ contactId }: { contactId?: number }) => {
      const db = getDb();
      const result = contactId
        ? db.select().from(outreachMessages).where(eq(outreachMessages.contactId, contactId)).all()
        : db.select().from(outreachMessages).all();
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  },

  update_outreach_status: {
    description:
      "Update the status of an outreach message. Requires: outreachId (number), status (draft/sent/responded/no_response/booked). Use list_outreach first to get the outreachId.",
    schema: z.object({
      outreachId: z.number().describe("Outreach message ID — get this from generate_outreach or list_outreach"),
      status: z.enum(["draft", "sent", "responded", "no_response", "booked"]),
    }),
    handler: async (args: { outreachId: number; status: string }) => {
      const db = getDb();
      const updates: Record<string, unknown> = { status: args.status };
      if (args.status === "sent") updates.sentAt = new Date().toISOString();
      if (args.status === "responded") updates.respondedAt = new Date().toISOString();

      const result = db
        .update(outreachMessages)
        .set(updates)
        .where(eq(outreachMessages.id, args.outreachId))
        .returning()
        .get();

      const nextStepMap: Record<string, string> = {
        sent: "Logged as sent. Let me know when they respond — or if no reply in a few days, I can help draft a follow-up.",
        responded: "They responded! If they're up for a call, update the contact status to 'scheduled' with update_contact_status. Then use generate_call_guide to prep.",
        no_response: "No response logged. Want me to generate a follow-up variant with suggest_outreach_variant?",
        booked: "Call booked! Use update_contact_status to mark them as 'scheduled', then generate_call_guide to prepare your discussion guide.",
        draft: "Reset to draft.",
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { ...result, _nextStep: nextStepMap[args.status] || "" },
              null,
              2
            ),
          },
        ],
      };
    },
  },

  get_outreach_stats: {
    description:
      "Response rates by channel. No parameters required. Shows how your outreach is performing across email, LinkedIn, Twitter, and community channels.",
    schema: z.object({}),
    handler: async () => {
      const db = getDb();
      const all = db.select().from(outreachMessages).all();

      const byChannel: Record<string, { total: number; sent: number; responded: number; booked: number }> = {};
      for (const msg of all) {
        if (!byChannel[msg.channel]) {
          byChannel[msg.channel] = { total: 0, sent: 0, responded: 0, booked: 0 };
        }
        byChannel[msg.channel].total++;
        if (msg.status !== "draft") byChannel[msg.channel].sent++;
        if (msg.status === "responded") byChannel[msg.channel].responded++;
        if (msg.status === "booked") byChannel[msg.channel].booked++;
      }

      const stats = Object.entries(byChannel).map(([channel, data]) => ({
        channel,
        ...data,
        responseRate: data.sent > 0 ? ((data.responded + data.booked) / data.sent * 100).toFixed(1) + "%" : "N/A",
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                stats,
                _nextStep:
                  stats.length > 0
                    ? "Review which channels are working best. Consider doubling down on high-response channels, or use suggest_outreach_variant to improve underperforming ones."
                    : "No outreach sent yet. Use generate_outreach to create your first message.",
              },
              null,
              2
            ),
          },
        ],
      };
    },
  },

  suggest_outreach_variant: {
    description:
      "Generate an A/B variant of an existing outreach message with a different angle. Requires: outreachId (number). Use list_outreach first to get the outreachId. Optional: instruction (string) for specific direction.",
    schema: z.object({
      outreachId: z.number().describe("Original outreach message ID — get this from generate_outreach or list_outreach"),
      instruction: z.string().optional().describe("Specific instruction for the variant (e.g., 'try a more casual tone', 'reference their recent blog post')"),
    }),
    handler: async (args: { outreachId: number; instruction?: string }) => {
      const db = getDb();
      const original = db.select().from(outreachMessages).where(eq(outreachMessages.id, args.outreachId)).get();
      if (!original) return { content: [{ type: "text" as const, text: "Outreach message not found. Use list_outreach to see available messages." }] };

      const contact = db.select().from(contacts).where(eq(contacts.id, original.contactId)).get();

      const userMessage = `Create an A/B variant of this outreach message:

Original message:
${original.content}

Contact: ${contact?.name || "Unknown"} at ${contact?.company || "Unknown"} (${contact?.role || "Unknown"})
Channel: ${original.channel}
${args.instruction ? `Specific instruction: ${args.instruction}` : "Try a different angle or tone while keeping it short and following best practices."}`;

      const variant = await generateText("claude-sonnet-4-6", SYSTEM_PROMPTS.outreach, userMessage);

      const result = db
        .insert(outreachMessages)
        .values({
          contactId: original.contactId,
          channel: original.channel,
          content: variant,
        })
        .returning()
        .get();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                ...result,
                _nextStep:
                  "Here's the variant. Send whichever version you prefer, then let me know and I'll log it with update_outreach_status.",
              },
              null,
              2
            ),
          },
        ],
      };
    },
  },
};
