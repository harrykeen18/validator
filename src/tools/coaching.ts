import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, hypotheses, contacts, conversations, insights } from "../db/index.js";
import { generateText } from "../ai/client.js";
import { SYSTEM_PROMPTS } from "../ai/prompts.js";
import { MOM_TEST_PRINCIPLES } from "../resources/methodology.js";

export const coachingTools = {
  generate_call_guide: {
    description:
      "Create a discussion guide tailored to a specific contact and current untested hypotheses. Follows Mom Test principles.",
    schema: z.object({
      projectId: z.number().describe("Project ID"),
      contactId: z.number().describe("Contact ID for this call"),
    }),
    handler: async (args: { projectId: number; contactId: number }) => {
      const db = getDb();
      const contact = db.select().from(contacts).where(eq(contacts.id, args.contactId)).get();
      if (!contact) return { content: [{ type: "text" as const, text: "Contact not found" }] };

      const hyps = db
        .select()
        .from(hypotheses)
        .where(eq(hypotheses.projectId, args.projectId))
        .all()
        .filter((h) => h.status === "untested" || h.status === "testing");

      const userMessage = `Create a discussion guide for an upcoming customer discovery call.

Contact: ${contact.name}
Company: ${contact.company || "Unknown"}
Role: ${contact.role || "Unknown"}
Notes: ${contact.notes || "None"}

Hypotheses to test:
${hyps.map((h, i) => `${i + 1}. ${h.statement} (Acceptance criteria: ${h.acceptanceCriteria})`).join("\n")}`;

      const guide = await generateText("claude-sonnet-4-6", SYSTEM_PROMPTS.callGuide, userMessage);
      return { content: [{ type: "text" as const, text: guide }] };
    },
  },

  get_call_principles: {
    description: "Return Mom Test principles and anti-patterns as reminders before a call",
    schema: z.object({}),
    handler: async () => {
      return { content: [{ type: "text" as const, text: MOM_TEST_PRINCIPLES }] };
    },
  },

  start_debrief: {
    description: "Begin structured post-call debrief — returns targeted questions based on what was supposed to be tested",
    schema: z.object({
      projectId: z.number().describe("Project ID"),
      contactId: z.number().describe("Contact ID for this call"),
      date: z.string().optional().describe("Date of the call (YYYY-MM-DD). Defaults to today."),
    }),
    handler: async (args: { projectId: number; contactId: number; date?: string }) => {
      const db = getDb();
      const contact = db.select().from(contacts).where(eq(contacts.id, args.contactId)).get();
      const hyps = db
        .select()
        .from(hypotheses)
        .where(eq(hypotheses.projectId, args.projectId))
        .all()
        .filter((h) => h.status === "untested" || h.status === "testing");

      // Create conversation record
      const conv = db
        .insert(conversations)
        .values({
          projectId: args.projectId,
          contactId: args.contactId,
          date: args.date || new Date().toISOString().split("T")[0],
        })
        .returning()
        .get();

      const debriefQuestions = `# Post-Call Debrief — ${contact?.name || "Unknown"}
## Conversation ID: ${conv.id}

For each hypothesis you were testing, capture what you learned:

${hyps
  .map(
    (h, i) => `### Hypothesis ${i + 1}: ${h.statement}
- What specific things did they say that relate to this?
- Any verbatim quotes worth capturing?
- Does this evidence support, contradict, or say nothing about the hypothesis?
- How strong is the signal? (strong = past behavior/money spent, medium = specific preference, weak = opinion/future promise)`
  )
  .join("\n\n")}

### General
- What surprised you most?
- What did you learn that you didn't expect?
- Did they mention any problems/workflows you hadn't considered?
- Were there any moments where you caught yourself pitching instead of listening?

Use \`record_insight\` to capture each individual insight with its hypothesis mapping and signal strength.`;

      return { content: [{ type: "text" as const, text: debriefQuestions }] };
    },
  },

  record_insight: {
    description: "Capture a specific insight, tagged to hypotheses and contact, with signal strength",
    schema: z.object({
      conversationId: z.number().optional().describe("Conversation ID (from debrief)"),
      projectId: z.number().describe("Project ID"),
      hypothesisId: z.number().optional().describe("Hypothesis this insight relates to"),
      content: z.string().describe("The insight itself"),
      verbatimQuote: z.string().optional().describe("Exact quote from the conversation"),
      signalStrength: z.enum(["strong", "medium", "weak"]).describe("How strong is this evidence?"),
      direction: z.enum(["supports", "contradicts", "neutral"]).describe("Does this support or contradict the hypothesis?"),
    }),
    handler: async (args: {
      conversationId?: number;
      projectId: number;
      hypothesisId?: number;
      content: string;
      verbatimQuote?: string;
      signalStrength: "strong" | "medium" | "weak";
      direction: "supports" | "contradicts" | "neutral";
    }) => {
      const db = getDb();
      const result = db.insert(insights).values(args).returning().get();

      // If linked to a hypothesis and direction is clear, update hypothesis status to "testing"
      if (args.hypothesisId) {
        const hyp = db.select().from(hypotheses).where(eq(hypotheses.id, args.hypothesisId)).get();
        if (hyp && hyp.status === "untested") {
          db.update(hypotheses)
            .set({ status: "testing", updatedAt: new Date().toISOString() })
            .where(eq(hypotheses.id, args.hypothesisId))
            .run();
        }
      }

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  },

  analyze_transcript: {
    description: "Upload/paste call transcript — extracts structured insights, quotes, hypothesis evidence, and flags bias",
    schema: z.object({
      projectId: z.number().describe("Project ID"),
      conversationId: z.number().optional().describe("Conversation ID to link insights to"),
      transcript: z.string().describe("The call transcript text"),
    }),
    handler: async (args: { projectId: number; conversationId?: number; transcript: string }) => {
      const db = getDb();
      const hyps = db.select().from(hypotheses).where(eq(hypotheses.projectId, args.projectId)).all();

      const userMessage = `Analyze this customer discovery transcript.

Hypotheses being tested:
${hyps.map((h) => `- [ID:${h.id}] ${h.statement}`).join("\n")}

Transcript:
${args.transcript}`;

      const analysis = await generateText(
        "claude-opus-4-6",
        SYSTEM_PROMPTS.transcriptAnalysis,
        userMessage,
        4096
      );

      // Store transcript in conversation if we have one
      if (args.conversationId) {
        db.update(conversations)
          .set({ rawTranscript: args.transcript, summary: analysis })
          .where(eq(conversations.id, args.conversationId))
          .run();
      }

      // Try to auto-save structured insights
      try {
        const parsed = JSON.parse(analysis);
        if (parsed.insights && Array.isArray(parsed.insights)) {
          for (const insight of parsed.insights) {
            db.insert(insights)
              .values({
                conversationId: args.conversationId,
                projectId: args.projectId,
                hypothesisId: insight.hypothesisId || null,
                content: insight.content,
                verbatimQuote: insight.verbatimQuote || null,
                signalStrength: insight.signalStrength,
                direction: insight.direction,
              })
              .run();
          }
        }
      } catch {
        // If not valid JSON, return raw analysis
      }

      return { content: [{ type: "text" as const, text: analysis }] };
    },
  },
};
