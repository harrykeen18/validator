import { eq } from "drizzle-orm";
import { z } from "zod";
import { generateText } from "../ai/client.js";
import { SYSTEM_PROMPTS } from "../ai/prompts.js";
import { contacts, conversations, getDb, hypotheses, insights } from "../db/index.js";

export const synthesisTools = {
  synthesize_insights: {
    description:
      "Analyze all insights across calls — finds patterns, contradictions, and surprises. Requires: projectId (number). Works best after 3+ conversations with recorded insights. Use record_insight or analyze_transcript first to build up evidence.",
    schema: z.object({
      projectId: z.number().describe("Project ID — get this from list_projects or create_project"),
    }),
    handler: async ({ projectId }: { projectId: number }) => {
      const db = await getDb();
      const hyps = db.select().from(hypotheses).where(eq(hypotheses.projectId, projectId)).all();
      const allInsights = db.select().from(insights).where(eq(insights.projectId, projectId)).all();
      const convs = db
        .select()
        .from(conversations)
        .where(eq(conversations.projectId, projectId))
        .all();

      if (allInsights.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No insights recorded yet. Do some customer discovery calls first, then use record_insight or analyze_transcript to capture what you learn.",
            },
          ],
        };
      }

      const userMessage = `Synthesize these customer discovery insights.

Hypotheses:
${hyps.map((h) => `- [ID:${h.id}] ${h.statement} (Status: ${h.status}, Confidence: ${h.confidenceScore})`).join("\n")}

Total conversations: ${convs.length}

All insights (${allInsights.length} total):
${allInsights
  .map(
    (i) =>
      `- [Signal: ${i.signalStrength}, Direction: ${i.direction}, Hypothesis: ${i.hypothesisId || "general"}] ${i.content}${i.verbatimQuote ? ` (Quote: "${i.verbatimQuote}")` : ""}`,
  )
  .join("\n")}`;

      const synthesis = await generateText(
        "claude-opus-4-6",
        SYSTEM_PROMPTS.synthesis,
        userMessage,
        4096,
      );
      return {
        content: [
          {
            type: "text" as const,
            text:
              synthesis +
              "\n\n---\n_Next: use suggest_next_steps for specific actions, or detect_pivot_signals if the evidence is pointing in an unexpected direction._",
          },
        ],
      };
    },
  },

  get_validation_scorecard: {
    description:
      "Current state of all hypotheses with supporting and contradicting evidence. Requires: projectId (number). Shows each hypothesis with its evidence for and against — good for seeing where you stand at a glance.",
    schema: z.object({
      projectId: z.number().describe("Project ID — get this from list_projects or create_project"),
    }),
    handler: async ({ projectId }: { projectId: number }) => {
      const db = await getDb();
      const hyps = db.select().from(hypotheses).where(eq(hypotheses.projectId, projectId)).all();
      const allInsights = db.select().from(insights).where(eq(insights.projectId, projectId)).all();

      if (hyps.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No hypotheses found. Use create_hypothesis to add hypotheses to your project first.",
            },
          ],
        };
      }

      const scorecard = hyps.map((h) => {
        const related = allInsights.filter((i) => i.hypothesisId === h.id);
        const supporting = related.filter((i) => i.direction === "supports");
        const contradicting = related.filter((i) => i.direction === "contradicts");
        const neutral = related.filter((i) => i.direction === "neutral");

        return {
          hypothesis: h.statement,
          status: h.status,
          confidence: h.confidenceScore,
          evidence: {
            supporting: supporting.map((i) => ({
              content: i.content,
              strength: i.signalStrength,
              quote: i.verbatimQuote,
            })),
            contradicting: contradicting.map((i) => ({
              content: i.content,
              strength: i.signalStrength,
              quote: i.verbatimQuote,
            })),
            neutral: neutral.length,
          },
          totalEvidence: related.length,
          strongSignals: related.filter((i) => i.signalStrength === "strong").length,
        };
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                scorecard,
                _nextStep:
                  "Review your evidence. Hypotheses with strong contradicting signals may need to be invalidated via update_hypothesis. If you're unsure what to do next, use suggest_next_steps or detect_pivot_signals.",
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  },

  suggest_next_steps: {
    description:
      "AI-powered recommendations for what to do next based on current evidence. Requires: projectId (number). Works best after a few conversations and recorded insights.",
    schema: z.object({
      projectId: z.number().describe("Project ID — get this from list_projects or create_project"),
    }),
    handler: async ({ projectId }: { projectId: number }) => {
      const db = await getDb();
      const hyps = db.select().from(hypotheses).where(eq(hypotheses.projectId, projectId)).all();
      const allInsights = db.select().from(insights).where(eq(insights.projectId, projectId)).all();
      const conts = db.select().from(contacts).where(eq(contacts.projectId, projectId)).all();
      const convs = db
        .select()
        .from(conversations)
        .where(eq(conversations.projectId, projectId))
        .all();

      const userMessage = `Based on current validation progress, recommend next steps.

Hypotheses:
${hyps.map((h) => `- ${h.statement} (Status: ${h.status}, Confidence: ${h.confidenceScore})`).join("\n")}

Evidence summary: ${allInsights.length} insights from ${convs.length} conversations
Contacts: ${conts.length} total, ${conts.filter((c) => c.status === "completed").length} completed, ${conts.filter((c) => c.status === "scheduled").length} scheduled

Insight breakdown:
${allInsights.map((i) => `- [${i.signalStrength}/${i.direction}] ${i.content}`).join("\n")}`;

      const nextSteps = await generateText(
        "claude-sonnet-4-6",
        SYSTEM_PROMPTS.nextSteps,
        userMessage,
      );
      return { content: [{ type: "text" as const, text: nextSteps }] };
    },
  },

  detect_pivot_signals: {
    description:
      "Analyze whether evidence points to a different problem or customer than expected. Requires: projectId (number). Best used after 5+ conversations when you have enough evidence to spot patterns. Uses deep analysis to weigh contradictory evidence.",
    schema: z.object({
      projectId: z.number().describe("Project ID — get this from list_projects or create_project"),
    }),
    handler: async ({ projectId }: { projectId: number }) => {
      const db = await getDb();
      const hyps = db.select().from(hypotheses).where(eq(hypotheses.projectId, projectId)).all();
      const allInsights = db.select().from(insights).where(eq(insights.projectId, projectId)).all();

      if (allInsights.length < 3) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Only ${allInsights.length} insight(s) recorded — not enough evidence to detect pivot signals reliably. Do more discovery calls and record insights first.`,
            },
          ],
        };
      }

      const userMessage = `Analyze this customer discovery evidence for pivot signals.

Hypotheses:
${hyps.map((h) => `- ${h.statement} (Status: ${h.status}, Confidence: ${h.confidenceScore})`).join("\n")}

All insights:
${allInsights
  .map(
    (i) =>
      `- [Signal: ${i.signalStrength}, Direction: ${i.direction}] ${i.content}${i.verbatimQuote ? ` (Quote: "${i.verbatimQuote}")` : ""}`,
  )
  .join("\n")}`;

      const analysis = await generateText(
        "claude-opus-4-6",
        SYSTEM_PROMPTS.pivotDetection,
        userMessage,
        4096,
      );
      return { content: [{ type: "text" as const, text: analysis }] };
    },
  },

  get_progress_report: {
    description:
      "Summary of validation progress: calls done, hypotheses tested, insights collected. Requires: projectId (number). Good for weekly check-ins and tracking momentum.",
    schema: z.object({
      projectId: z.number().describe("Project ID — get this from list_projects or create_project"),
    }),
    handler: async ({ projectId }: { projectId: number }) => {
      const db = await getDb();
      const hyps = db.select().from(hypotheses).where(eq(hypotheses.projectId, projectId)).all();
      const allInsights = db.select().from(insights).where(eq(insights.projectId, projectId)).all();
      const conts = db.select().from(contacts).where(eq(contacts.projectId, projectId)).all();
      const convs = db
        .select()
        .from(conversations)
        .where(eq(conversations.projectId, projectId))
        .all();

      const report = {
        conversations: {
          total: convs.length,
          contacts: {
            total: conts.length,
            byStatus: {
              identified: conts.filter((c) => c.status === "identified").length,
              contacted: conts.filter((c) => c.status === "contacted").length,
              scheduled: conts.filter((c) => c.status === "scheduled").length,
              completed: conts.filter((c) => c.status === "completed").length,
              declined: conts.filter((c) => c.status === "declined").length,
            },
          },
        },
        hypotheses: {
          total: hyps.length,
          byStatus: {
            untested: hyps.filter((h) => h.status === "untested").length,
            testing: hyps.filter((h) => h.status === "testing").length,
            validated: hyps.filter((h) => h.status === "validated").length,
            invalidated: hyps.filter((h) => h.status === "invalidated").length,
          },
        },
        insights: {
          total: allInsights.length,
          byStrength: {
            strong: allInsights.filter((i) => i.signalStrength === "strong").length,
            medium: allInsights.filter((i) => i.signalStrength === "medium").length,
            weak: allInsights.filter((i) => i.signalStrength === "weak").length,
          },
          byDirection: {
            supports: allInsights.filter((i) => i.direction === "supports").length,
            contradicts: allInsights.filter((i) => i.direction === "contradicts").length,
            neutral: allInsights.filter((i) => i.direction === "neutral").length,
          },
        },
        _nextStep:
          convs.length === 0
            ? "No conversations yet. Start by finding contacts with search_linkedin or add_contact, then generate_outreach to reach out."
            : hyps.filter((h) => h.status === "untested").length > 0
              ? "You still have untested hypotheses. Use prioritize_hypotheses to figure out which to tackle next."
              : "Good progress. Use synthesize_insights for a cross-conversation analysis, or get_validation_scorecard to see your evidence summary.",
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }] };
    },
  },

  prioritize_hypotheses: {
    description:
      "AI-ranked hypotheses by risk, testability, and dependencies. Requires: projectId (number). The project should have hypotheses created via create_hypothesis.",
    schema: z.object({
      projectId: z.number().describe("Project ID — get this from list_projects or create_project"),
    }),
    handler: async ({ projectId }: { projectId: number }) => {
      const db = await getDb();
      const hyps = db.select().from(hypotheses).where(eq(hypotheses.projectId, projectId)).all();
      const allInsights = db.select().from(insights).where(eq(insights.projectId, projectId)).all();

      if (hyps.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No hypotheses found. Use create_hypothesis to add hypotheses to your project first.",
            },
          ],
        };
      }

      const userMessage = `Prioritize these hypotheses for testing.

Hypotheses:
${hyps
  .map((h) => {
    const related = allInsights.filter((i) => i.hypothesisId === h.id);
    return `- [ID:${h.id}] ${h.statement}
  Status: ${h.status}, Confidence: ${h.confidenceScore}, Current evidence: ${related.length} insights
  Acceptance criteria: ${h.acceptanceCriteria}`;
  })
  .join("\n")}`;

      const ranking = await generateText(
        "claude-sonnet-4-6",
        SYSTEM_PROMPTS.prioritizeHypotheses,
        userMessage,
      );
      return {
        content: [
          {
            type: "text" as const,
            text:
              ranking +
              "\n\n---\n_Next: focus your upcoming calls on the top-priority hypothesis. Use generate_call_guide to build a discussion guide targeting it._",
          },
        ],
      };
    },
  },
};
