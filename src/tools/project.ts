import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, projects, hypotheses, contacts, insights, conversations } from "../db/index.js";

export const projectTools = {
  create_project: {
    description: "Initialize a new validation project with idea description",
    schema: z.object({
      name: z.string().describe("Project name"),
      description: z.string().describe("Describe the idea you want to validate"),
    }),
    handler: async ({ name, description }: { name: string; description: string }) => {
      const db = getDb();
      const result = db.insert(projects).values({ name, description }).returning().get();
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  },

  list_projects: {
    description: "List all active validation projects",
    schema: z.object({}),
    handler: async () => {
      const db = getDb();
      const result = db.select().from(projects).all();
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  },

  get_project_status: {
    description: "Full project overview: hypotheses, progress, key metrics",
    schema: z.object({
      projectId: z.number().describe("Project ID"),
    }),
    handler: async ({ projectId }: { projectId: number }) => {
      const db = getDb();
      const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
      if (!project) return { content: [{ type: "text" as const, text: "Project not found" }] };

      const hyps = db.select().from(hypotheses).where(eq(hypotheses.projectId, projectId)).all();
      const conts = db.select().from(contacts).where(eq(contacts.projectId, projectId)).all();
      const convs = db.select().from(conversations).where(eq(conversations.projectId, projectId)).all();
      const ins = db.select().from(insights).where(eq(insights.projectId, projectId)).all();

      const status = {
        project,
        metrics: {
          totalHypotheses: hyps.length,
          validated: hyps.filter((h) => h.status === "validated").length,
          invalidated: hyps.filter((h) => h.status === "invalidated").length,
          testing: hyps.filter((h) => h.status === "testing").length,
          untested: hyps.filter((h) => h.status === "untested").length,
          totalContacts: conts.length,
          completedCalls: conts.filter((c) => c.status === "completed").length,
          totalConversations: convs.length,
          totalInsights: ins.length,
        },
        hypotheses: hyps,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(status, null, 2) }] };
    },
  },

  create_hypothesis: {
    description: "Add a testable hypothesis with acceptance criteria",
    schema: z.object({
      projectId: z.number().describe("Project ID"),
      statement: z.string().describe("The hypothesis statement to test"),
      acceptanceCriteria: z.string().describe("What evidence would validate or invalidate this"),
      priority: z.number().optional().describe("Priority ranking (higher = more important)"),
    }),
    handler: async (args: { projectId: number; statement: string; acceptanceCriteria: string; priority?: number }) => {
      const db = getDb();
      const result = db
        .insert(hypotheses)
        .values({
          projectId: args.projectId,
          statement: args.statement,
          acceptanceCriteria: args.acceptanceCriteria,
          priority: args.priority ?? 0,
        })
        .returning()
        .get();
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  },

  update_hypothesis: {
    description: "Update hypothesis status with evidence",
    schema: z.object({
      hypothesisId: z.number().describe("Hypothesis ID"),
      status: z.enum(["untested", "testing", "validated", "invalidated"]).optional(),
      confidenceScore: z.number().min(0).max(1).optional().describe("Confidence from 0 to 1"),
      priority: z.number().optional(),
    }),
    handler: async (args: { hypothesisId: number; status?: string; confidenceScore?: number; priority?: number }) => {
      const db = getDb();
      const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (args.status) updates.status = args.status;
      if (args.confidenceScore !== undefined) updates.confidenceScore = args.confidenceScore;
      if (args.priority !== undefined) updates.priority = args.priority;

      const result = db
        .update(hypotheses)
        .set(updates)
        .where(eq(hypotheses.id, args.hypothesisId))
        .returning()
        .get();
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  },

  list_hypotheses: {
    description: "List all hypotheses with current confidence scores",
    schema: z.object({
      projectId: z.number().describe("Project ID"),
    }),
    handler: async ({ projectId }: { projectId: number }) => {
      const db = getDb();
      const result = db.select().from(hypotheses).where(eq(hypotheses.projectId, projectId)).all();
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  },
};
