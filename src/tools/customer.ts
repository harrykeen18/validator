import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, icps, contacts } from "../db/index.js";

export const customerTools = {
  create_icp: {
    description:
      "Define an ideal customer profile for a project. Requires: projectId (number), name, demographics, behaviors, painPoints, channels (all strings). Call create_project first if you don't have a projectId.",
    schema: z.object({
      projectId: z.number().describe("Project ID — get this from list_projects or create_project"),
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
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                ...result,
                _nextStep:
                  "ICP created. Next: use suggest_channels to find where these people hang out, or search_linkedin to find specific people to talk to, or add_contact to add people you already know.",
              },
              null,
              2
            ),
          },
        ],
      };
    },
  },

  add_contact: {
    description:
      "Add a potential interviewee to the target list. Requires: projectId (number), name (string). Optional: icpId, company, role, channel, linkedinUrl, notes. Use create_icp first to get an icpId to tag the contact.",
    schema: z.object({
      projectId: z.number().describe("Project ID — get this from list_projects or create_project"),
      icpId: z.number().optional().describe("ICP segment ID — get this from create_icp"),
      name: z.string().describe("Contact name"),
      company: z.string().optional().describe("Company name"),
      role: z.string().optional().describe("Job title/role"),
      channel: z.string().optional().describe("How you found them or plan to reach them"),
      linkedinUrl: z.string().optional().describe("LinkedIn profile URL"),
      notes: z.string().optional().describe("Any notes about this contact — the more context, the better the outreach"),
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
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                ...result,
                _nextStep:
                  "Contact added. Next: use generate_outreach to draft a personalized message for this contact, or add more contacts first.",
              },
              null,
              2
            ),
          },
        ],
      };
    },
  },

  list_contacts: {
    description:
      "List contacts with outreach status. Requires: projectId (number). Optional: filter by status (identified/contacted/scheduled/completed/declined).",
    schema: z.object({
      projectId: z.number().describe("Project ID — get this from list_projects or create_project"),
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
    description:
      "Track contact progress. Requires: contactId (number), status (identified/contacted/scheduled/completed/declined). Use list_contacts first to get the contactId.",
    schema: z.object({
      contactId: z.number().describe("Contact ID — get this from list_contacts or add_contact"),
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

      const nextStepMap: Record<string, string> = {
        contacted: "Nice, let me know when they respond and I'll update their status. If no response in a few days, consider using suggest_outreach_variant for a follow-up.",
        scheduled: "Great, a call is booked! Use generate_call_guide before the call to prepare a discussion guide tailored to this person.",
        completed: "Call done! Use start_debrief to capture structured insights while the conversation is fresh, or analyze_transcript if you have a recording.",
        declined: "No worries — not everyone will say yes. Focus on other contacts, or use search_linkedin to find more people matching your ICP.",
        identified: "Contact status reset. Use generate_outreach when you're ready to reach out.",
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
};
