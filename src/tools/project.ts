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

      const welcome = `# Welcome to Validator — your customer discovery co-pilot

Project "${result.name}" created (ID: ${result.id}).

## What this tool does (and doesn't do)

Validator helps you answer three specific questions through real customer conversations:
1. **Does the problem actually exist?** Not in theory — do real people experience it, and how painful is it?
2. **Who has it worst?** Which customer segment feels the most pain, and what does their profile look like?
3. **Will they pay to solve it?** How much, and what would make them switch from their current workaround?

This is one piece of a bigger puzzle. Assessing a full business opportunity also means evaluating your **founder-market fit** (why are you the right person to solve this?), **market size** (is this big enough to matter?), and **competitive advantage** (what makes you defensible?). Validator gives you the customer evidence datapoint — use it alongside your broader opportunity assessment.

## The Workflow

**1. Define what you're testing**
- \`create_hypothesis\` — break your idea into 3-5 testable hypotheses (customer, problem, solution, willingness-to-pay)
- \`prioritize_hypotheses\` — I'll rank them by risk and testability so you test the scariest assumption first

**2. Find people to talk to**
- \`create_icp\` — define your ideal customer profile
- \`suggest_channels\` — I'll suggest where these people hang out
- \`search_linkedin\` — find specific people matching your ICP
- \`add_contact\` — build your interview target list

**3. Reach out**
- \`generate_outreach\` — I'll draft short, no-pitch outreach messages
- \`suggest_outreach_variant\` — A/B test different angles
- \`get_outreach_stats\` — track what's working

**4. Prepare and run calls**
- \`generate_call_guide\` — tailored discussion guide following Mom Test principles
- \`get_call_principles\` — quick reminder of what to do (and not do) on a call

**5. Capture what you learned**
- \`start_debrief\` — structured post-call debrief
- \`record_insight\` — capture individual insights with signal strength
- \`analyze_transcript\` — paste a transcript and I'll extract insights, quotes, and flag bias automatically

**6. Synthesize and decide**
- \`synthesize_insights\` — patterns and contradictions across all calls
- \`get_validation_scorecard\` — evidence for/against each hypothesis
- \`detect_pivot_signals\` — am I solving the right problem for the right customer?
- \`suggest_next_steps\` — what to do next based on current evidence

## Let's start

The first step is to break your idea into testable hypotheses. What are the core assumptions that must be true for "${result.name}" to work? Think about:
- **Customer**: Who has this problem?
- **Problem**: Is the problem real and painful enough?
- **Solution**: Does your approach actually solve it?
- **Viability**: Will people pay / switch / change behavior?

Tell me your assumptions and I'll help turn them into testable hypotheses using \`create_hypothesis\`.`;

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
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
