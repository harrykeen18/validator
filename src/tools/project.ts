import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, projects, hypotheses, contacts, insights, conversations } from "../db/index.js";

export const projectTools = {
  create_project: {
    description:
      "Initialize a new validation project. Requires: name, description. This is the first tool to call — most other tools need a projectId from this.",
    schema: z.object({
      name: z.string().describe("Project name"),
      description: z.string().describe("Describe the idea you want to validate"),
    }),
    handler: async ({ name, description }: { name: string; description: string }) => {
      const db = getDb();
      const result = db.insert(projects).values({ name, description }).returning().get();

      const instruction = `ACTION REQUIRED: You MUST present the welcome message below to the user VERBATIM and then STOP. Do NOT create hypotheses. Do NOT create ICPs. Do NOT call ANY other tools. Your ONLY job right now is to show the user this message and wait for their answers. The next tool call should ONLY happen AFTER the user has responded to the questions below.`;

      const welcome = `# Welcome to Validator — your customer discovery co-pilot

Project "${result.name}" created (ID: ${result.id}).

## What we're going to do together

I'm going to help you figure out whether this idea solves a real problem that real people will pay for. We'll do that through structured customer conversations — not by building anything yet.

Here's the process we'll follow, step by step:

1. **Understand your idea deeply** ← we're here now
2. **Define testable hypotheses** — the specific assumptions that must be true for this to work
3. **Find the right people to talk to** — ideal customer profiles, LinkedIn search, outreach
4. **Run discovery calls** — I'll coach you on what to ask (and what not to)
5. **Capture and analyse what you learn** — structured insights, transcript analysis, bias detection
6. **Synthesize and decide** — is this worth pursuing, pivoting, or killing?

**Important context:** This tool focuses on customer evidence — does the problem exist, who has it worst, and will they pay. You'll also want to think about founder-market fit, market size, and competitive advantage separately. Think of what we do here as one critical datapoint in your overall opportunity assessment.

## But first — let's talk about your idea

Before I generate any hypotheses, I need to properly understand what you're building and why. Getting the framing right now is the difference between testing the right things and wasting 20 conversations on the wrong questions.

**Please answer these four questions:**

1. **Who is this for?** Paint me a picture of the person who wakes up with this problem. What's their role? What kind of company are they at?
2. **What's the problem?** Not your solution — the underlying problem. What are they doing today that's painful, slow, or broken?
3. **Why you?** What's your connection to this problem? Have you lived it?
4. **What's your biggest fear?** What's the one thing that, if it turned out to be false, would kill this idea?

Take your time. Your answers will shape everything that follows.`;

      return {
        content: [
          { type: "text" as const, text: instruction },
          { type: "text" as const, text: welcome },
        ],
      };
    },
  },

  list_projects: {
    description: "List all active validation projects. No parameters required. Use this to find a projectId before calling other tools.",
    schema: z.object({}),
    handler: async () => {
      const db = getDb();
      const result = db.select().from(projects).all();
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  },

  get_project_status: {
    description:
      "Full project overview: hypotheses, progress, key metrics. Requires: projectId (number). Use list_projects first if you don't have the projectId.",
    schema: z.object({
      projectId: z.number().describe("Project ID — get this from list_projects or create_project"),
    }),
    handler: async ({ projectId }: { projectId: number }) => {
      const db = getDb();
      const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
      if (!project) return { content: [{ type: "text" as const, text: "Project not found. Use list_projects to see available projects." }] };

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
    description:
      "Add a testable hypothesis with acceptance criteria. Requires: projectId (number), statement (string), acceptanceCriteria (string). Call create_project first if you don't have a projectId.",
    schema: z.object({
      projectId: z.number().describe("Project ID — get this from list_projects or create_project"),
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
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                ...result,
                _nextStep:
                  "Hypothesis created. Add more hypotheses if needed, or use create_icp to define who you should be talking to about this.",
              },
              null,
              2
            ),
          },
        ],
      };
    },
  },

  update_hypothesis: {
    description:
      "Update hypothesis status or confidence. Requires: hypothesisId (number). Use list_hypotheses first to get the hypothesisId. Status options: untested, testing, validated, invalidated.",
    schema: z.object({
      hypothesisId: z.number().describe("Hypothesis ID — get this from list_hypotheses"),
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
    description:
      "List all hypotheses with current status and confidence scores. Requires: projectId (number). Use list_projects first if you don't have the projectId.",
    schema: z.object({
      projectId: z.number().describe("Project ID — get this from list_projects or create_project"),
    }),
    handler: async ({ projectId }: { projectId: number }) => {
      const db = getDb();
      const result = db.select().from(hypotheses).where(eq(hypotheses.projectId, projectId)).all();
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  },
};
