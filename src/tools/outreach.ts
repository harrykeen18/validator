import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { getDb, outreachMessages, contacts } from "../db/index.js";
import { generateText } from "../ai/client.js";
import { SYSTEM_PROMPTS } from "../ai/prompts.js";

export const outreachTools = {
  generate_outreach: {
    description:
      "Generate personalized outreach message for a contact. Follows best practices: short, specific, no pitch, easy to say yes.",
    schema: z.object({
      contactId: z.number().describe("Contact ID"),
      channel: z.enum(["email", "linkedin", "twitter", "community"]).describe("Outreach channel"),
      context: z.string().optional().describe("Additional context about the contact or your project"),
    }),
    handler: async (args: { contactId: number; channel: string; context?: string }) => {
      const db = getDb();
      const contact = db.select().from(contacts).where(eq(contacts.id, args.contactId)).get();
      if (!contact) return { content: [{ type: "text" as const, text: "Contact not found" }] };

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

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  },

  list_outreach: {
    description: "View all outreach messages with send status and response tracking",
    schema: z.object({
      contactId: z.number().optional().describe("Filter by contact ID"),
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
    description: "Mark outreach as sent/responded/no-response/booked",
    schema: z.object({
      outreachId: z.number().describe("Outreach message ID"),
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
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  },

  get_outreach_stats: {
    description: "Response rates by channel, template, ICP segment",
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

      return { content: [{ type: "text" as const, text: JSON.stringify(stats, null, 2) }] };
    },
  },

  suggest_outreach_variant: {
    description: "Generate A/B variant of outreach based on what's performing",
    schema: z.object({
      outreachId: z.number().describe("Original outreach message ID to create variant of"),
      instruction: z.string().optional().describe("Specific instruction for the variant"),
    }),
    handler: async (args: { outreachId: number; instruction?: string }) => {
      const db = getDb();
      const original = db.select().from(outreachMessages).where(eq(outreachMessages.id, args.outreachId)).get();
      if (!original) return { content: [{ type: "text" as const, text: "Outreach message not found" }] };

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

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  },
};
