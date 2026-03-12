import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, icps, contacts } from "../db/index.js";

export const customerTools = {
  create_icp: {
    description: "Define an ideal customer profile",
    schema: z.object({
      projectId: z.number().describe("Project ID"),
      name: z.string().describe("ICP segment name (e.g., 'Early-stage SaaS founders')"),
      demographics: z.string().describe("Who they are: role, company size, industry, etc."),
      behaviors: z.string().describe("What they do: tools used, workflows, habits"),
      painPoints: z.string().describe("Problems they experience"),
      channels: z.string().describe("Where they hang out: communities, platforms, events"),
    }),
    handler: async (args: {
      projectId: number;
      name: string;
      demographics: string;
      behaviors: string;
      painPoints: string;
      channels: string;
    }) => {
      const db = getDb();
      const result = db
        .insert(icps)
        .values({
          projectId: args.projectId,
          name: args.name,
          demographics: args.demographics,
          behaviors: args.behaviors,
          painPoints: args.painPoints,
          channels: args.channels,
        })
        .returning()
        .get();
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  },

  add_contact: {
    description: "Add a potential interviewee to the target list",
    schema: z.object({
      projectId: z.number().describe("Project ID"),
      icpId: z.number().optional().describe("ICP segment this contact belongs to"),
      name: z.string().describe("Contact name"),
      company: z.string().optional().describe("Company name"),
      role: z.string().optional().describe("Job title/role"),
      channel: z.string().optional().describe("How you found them or plan to reach them"),
      linkedinUrl: z.string().optional().describe("LinkedIn profile URL"),
      notes: z.string().optional().describe("Any notes about this contact"),
    }),
    handler: async (args: {
      projectId: number;
      icpId?: number;
      name: string;
      company?: string;
      role?: string;
      channel?: string;
      linkedinUrl?: string;
      notes?: string;
    }) => {
      const db = getDb();
      const result = db.insert(contacts).values(args).returning().get();
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  },

  list_contacts: {
    description: "List contacts with outreach status",
    schema: z.object({
      projectId: z.number().describe("Project ID"),
      status: z
        .enum(["identified", "contacted", "scheduled", "completed", "declined"])
        .optional()
        .describe("Filter by status"),
    }),
    handler: async ({ projectId, status }: { projectId: number; status?: string }) => {
      const db = getDb();
      let query = db.select().from(contacts).where(eq(contacts.projectId, projectId));
      const result = query.all();
      const filtered = status ? result.filter((c) => c.status === status) : result;
      return { content: [{ type: "text" as const, text: JSON.stringify(filtered, null, 2) }] };
    },
  },

  update_contact_status: {
    description: "Track contact progress (identified/contacted/scheduled/completed/declined)",
    schema: z.object({
      contactId: z.number().describe("Contact ID"),
      status: z.enum(["identified", "contacted", "scheduled", "completed", "declined"]),
      notes: z.string().optional().describe("Additional notes"),
    }),
    handler: async (args: { contactId: number; status: string; notes?: string }) => {
      const db = getDb();
      const updates: Record<string, unknown> = { status: args.status };
      if (args.notes) updates.notes = args.notes;
      const result = db
        .update(contacts)
        .set(updates)
        .where(eq(contacts.id, args.contactId))
        .returning()
        .get();
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  },
};
