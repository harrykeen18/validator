import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, hypotheses, insights, contacts, conversations } from "../db/index.js";
import { generateText } from "../ai/client.js";
import { SYSTEM_PROMPTS } from "../ai/prompts.js";

export const synthesisTools = {
  synthesize_insights: {
    description: "Analyze all insights across calls — patterns, contradictions, surprises",
    schema: z.object({
      projectId: z.number().describe("Project ID"),
    }),
    handler: async ({ projectId }: { projectId: number }) => {
      const db = getDb();
      const hyps = db.select().from(hypotheses).where(eq(hypotheses.projectId, projectId)).all();
      const allInsights = db.select().from(insights).where(eq(insights.projectId, projectId)).all();
      const convs = db.select().from(conversations).where(eq(conversations.projectId, projectId)).all();

      const userMessage = `Synthesize these customer discovery insights.

Hypotheses:
${hyps.map((h) => `- [ID:${h.id}] ${h.statement} (Status: ${h.status}, Confidence: ${h.confidenceScore})`).join("\n")}

Total conversations: ${convs.length}

All insights (${allInsights.length} total):
${allInsights
  .map(
    (i) =>
      `- [Signal: ${i.signalStrength}, Direction: ${i.direction}, Hypothesis: ${i.hypothesisId || "general"}] ${i.content}${i.verbatimQuote ? ` (Quote: "${i.verbatimQuote}")` : ""}`
  )
  .join("\n")}`;

      const synthesis = await generateText("claude-opus-4-6", SYSTEM_PROMPTS.synthesis, userMessage, 4096);
      return { content: [{ type: "text" as const, text: synthesis }] };
    },
  },

  get_validation_scorecard: {
    description: "Current state of all hypotheses with supporting/contradicting evidence",
    schema: z.object({
      projectId: z.number().describe("Project ID"),
    }),
    handler: async ({ projectId }: { projectId: number }) => {
      const db = getDb();
      const hyps = db.select().from(hypotheses).where(eq(hypotheses.projectId, projectId)).all();
      const allInsights = db.select().from(insights).where(eq(insights.projectId, projectId)).all();

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

      return { content: [{ type: "text" as const, text: JSON.stringify(scorecard, null, 2) }] };
    },
  },

  suggest_next_steps: {
    description: "Recommend what to do next based on current evidence",
    schema: z.object({
      projectId: z.number().describe("Project ID"),
    }),
    handler: async ({ projectId }: { projectId: number }) => {
      const db = getDb();
      const hyps = db.select().from(hypotheses).where(eq(hypotheses.projectId, projectId)).all();
      const allInsights = db.select().from(insights).where(eq(insights.projectId, projectId)).all();
      const conts = db.select().from(contacts).where(eq(contacts.projectId, projectId)).all();
      const convs = db.select().from(conversations).where(eq(conversations.projectId, projectId)).all();

      const userMessage = `Based on current validation progress, recommend next steps.

Hypotheses:
${hyps.map((h) => `- ${h.statement} (Status: ${h.status}, Confidence: ${h.confidenceScore})`).join("\n")}

Evidence summary: ${allInsights.length} insights from ${convs.length} conversations
Contacts: ${conts.length} total, ${conts.filter((c) => c.status === "completed").length} completed, ${conts.filter((c) => c.status === "scheduled").length} scheduled

Insight breakdown:
${allInsights.map((i) => `- [${i.signalStrength}/${i.direction}] ${i.content}`).join("\n")}`;

      const nextSteps = await generateText("claude-sonnet-4-6", SYSTEM_PROMPTS.nextSteps, userMessage);
      return { content: [{ type: "text" as const, text: nextSteps }] };
    },
  },

  detect_pivot_signals: {
    description: "Flag when evidence points to a different problem/customer than expected",
    schema: z.object({
      projectId: z.number().describe("Project ID"),
    }),
    handler: async ({ projectId }: { projectId: number }) => {
      const db = getDb();
      const hyps = db.select().from(hypotheses).where(eq(hypotheses.projectId, projectId)).all();
      const allInsights = db.select().from(insights).where(eq(insights.projectId, projectId)).all();

      const userMessage = `Analyze this customer discovery evidence for pivot signals.

Hypotheses:
${hyps.map((h) => `- ${h.statement} (Status: ${h.status}, Confidence: ${h.confidenceScore})`).join("\n")}

All insights:
${allInsights
  .map(
    (i) =>
      `- [Signal: ${i.signalStrength}, Direction: ${i.direction}] ${i.content}${i.verbatimQuote ? ` (Quote: "${i.verbatimQuote}")` : ""}`
  )
  .join("\n")}`;

      const analysis = await generateText("claude-opus-4-6", SYSTEM_PROMPTS.pivotDetection, userMessage, 4096);
      return { content: [{ type: "text" as const, text: analysis }] };
    },
  },

  get_progress_report: {
    description: "Calls done, hypotheses tested, key learnings — good for check-ins",
    schema: z.object({
      projectId: z.number().describe("Project ID"),
    }),
    handler: async ({ projectId }: { projectId: number }) => {
      const db = getDb();
      const hyps = db.select().from(hypotheses).where(eq(hypotheses.projectId, projectId)).all();
      const allInsights = db.select().from(insights).where(eq(insights.projectId, projectId)).all();
      const conts = db.select().from(contacts).where(eq(contacts.projectId, projectId)).all();
      const convs = db.select().from(conversations).where(eq(conversations.projectId, projectId)).all();

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
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }] };
    },
  },

  prioritize_hypotheses: {
    description: "Rank hypotheses by importance and testability using AI analysis",
    schema: z.object({
      projectId: z.number().describe("Project ID"),
    }),
    handler: async ({ projectId }: { projectId: number }) => {
      const db = getDb();
      const hyps = db.select().from(hypotheses).where(eq(hypotheses.projectId, projectId)).all();
      const allInsights = db.select().from(insights).where(eq(insights.projectId, projectId)).all();

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

      const ranking = await generateText("claude-sonnet-4-6", SYSTEM_PROMPTS.prioritizeHypotheses, userMessage);
      return { content: [{ type: "text" as const, text: ranking }] };
    },
  },
};
