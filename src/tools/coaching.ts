import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, hypotheses, contacts, conversations, insights } from "../db/index.js";
import { generateText } from "../ai/client.js";
import { SYSTEM_PROMPTS } from "../ai/prompts.js";
import { MOM_TEST_PRINCIPLES } from "../resources/methodology.js";

export const coachingTools = {
  generate_call_guide: {
    description:
      "Create a discussion guide tailored to a specific contact and current untested hypotheses. Requires: projectId (number), contactId (number). Both must already exist — use create_project and add_contact first. The project should have hypotheses created via create_hypothesis.",
    schema: z.object({
      projectId: z.number().describe("Project ID — get this from list_projects or create_project"),
      contactId: z.number().describe("Contact ID — get this from list_contacts or add_contact"),
    }),
    handler: async (args: { projectId: number; contactId: number }) => {
      const db = getDb();
      const contact = db.select().from(contacts).where(eq(contacts.id, args.contactId)).get();
      if (!contact) return { content: [{ type: "text" as const, text: "Contact not found. Use add_contact to add them first, or list_contacts to find the right contactId." }] };

      const hyps = db
        .select()
        .from(hypotheses)
        .where(eq(hypotheses.projectId, args.projectId))
        .all()
        .filter((h) => h.status === "untested" || h.status === "testing");

      if (hyps.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No untested or in-progress hypotheses found. Use create_hypothesis to add hypotheses to test, or list_hypotheses to check current status.",
            },
          ],
        };
      }

      const userMessage = `Create a discussion guide for an upcoming customer discovery call.

Contact: ${contact.name}
Company: ${contact.company || "Unknown"}
Role: ${contact.role || "Unknown"}
Notes: ${contact.notes || "None"}

Hypotheses to test:
${hyps.map((h, i) => `${i + 1}. ${h.statement} (Acceptance criteria: ${h.acceptanceCriteria})`).join("\n")}`;

      const guide = await generateText("claude-sonnet-4-6", SYSTEM_PROMPTS.callGuide, userMessage);
      return {
        content: [
          {
            type: "text" as const,
            text: guide + "\n\n---\n_Next step: Review the guide, then go have your conversation. Afterwards, use start_debrief to capture what you learned while it's fresh._",
          },
        ],
      };
    },
  },

  get_call_principles: {
    description:
      "Return Mom Test principles and anti-patterns as reminders before a call. No parameters required. Good to review before any customer discovery conversation.",
    schema: z.object({}),
    handler: async () => {
      return { content: [{ type: "text" as const, text: MOM_TEST_PRINCIPLES }] };
    },
  },

  start_debrief: {
    description:
      "Begin a structured post-call debrief. Requires: projectId (number), contactId (number). Optional: date (YYYY-MM-DD string, defaults to today). Creates a conversation record and returns targeted debrief questions. Call this right after a discovery call, then use record_insight to capture each insight.",
    schema: z.object({
      projectId: z.number().describe("Project ID — get this from list_projects or create_project"),
      contactId: z.number().describe("Contact ID — get this from list_contacts or add_contact"),
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

---
_Next step: Use record_insight for each insight (pass conversationId: ${conv.id}, projectId: ${args.projectId}). When you're done, use update_contact_status to mark contact ${args.contactId} as "completed". If you have a transcript, use analyze_transcript instead for automatic extraction._`;

      return { content: [{ type: "text" as const, text: debriefQuestions }] };
    },
  },

  record_insight: {
    description:
      "Capture a specific insight from a conversation. Requires: projectId (number), content (string), signalStrength (strong/medium/weak), direction (supports/contradicts/neutral). Optional: conversationId (from start_debrief), hypothesisId (from list_hypotheses), verbatimQuote. Call start_debrief first to get a conversationId, or use without one for ad-hoc insights.",
    schema: z.object({
      conversationId: z.number().optional().describe("Conversation ID — get this from start_debrief"),
      projectId: z.number().describe("Project ID — get this from list_projects or create_project"),
      hypothesisId: z.number().optional().describe("Hypothesis ID this insight relates to — get this from list_hypotheses"),
      content: z.string().describe("The insight itself"),
      verbatimQuote: z.string().optional().describe("Exact quote from the conversation"),
      signalStrength: z.enum(["strong", "medium", "weak"]).describe("strong = past behavior/money spent, medium = specific preference, weak = opinion/future promise"),
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

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                ...result,
                _nextStep:
                  "Insight recorded. Capture more insights from this conversation, or if you're done debriefing, use update_contact_status to mark the contact as 'completed'.",
              },
              null,
              2
            ),
          },
        ],
      };
    },
  },

  analyze_transcript: {
    description:
      "Analyze a call transcript — extracts structured insights, verbatim quotes, hypothesis evidence, and flags interviewer bias. Requires: projectId (number), transcript (string). Optional: conversationId (from start_debrief) to link insights to a conversation. The project should have hypotheses so the analysis can map evidence to them.",
    schema: z.object({
      projectId: z.number().describe("Project ID — get this from list_projects or create_project"),
      conversationId: z.number().optional().describe("Conversation ID — get this from start_debrief to link insights to this call"),
      transcript: z.string().describe("The full call transcript text"),
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
      let insightsSaved = 0;
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
            insightsSaved++;
          }
        }
      } catch {
        // If not valid JSON, return raw analysis
      }

      const nextStep = insightsSaved > 0
        ? `\n\n---\n_${insightsSaved} insights auto-saved. Next: use update_contact_status to mark the contact as "completed", then get_validation_scorecard to see how your hypotheses are looking overall._`
        : "\n\n---\n_Next: use record_insight to manually save the key findings from this analysis, then update_contact_status to mark the contact as \"completed\"._";

      return { content: [{ type: "text" as const, text: analysis + nextStep }] };
    },
  },
};
