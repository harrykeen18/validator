import { eq } from "drizzle-orm";
import { getDb, projects, hypotheses, insights, contacts } from "../db/index.js";

export function getProjectSummary(projectId: number): string {
  const db = getDb();
  const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) return "Project not found";

  const hyps = db.select().from(hypotheses).where(eq(hypotheses.projectId, projectId)).all();
  const conts = db.select().from(contacts).where(eq(contacts.projectId, projectId)).all();
  const ins = db.select().from(insights).where(eq(insights.projectId, projectId)).all();

  return JSON.stringify(
    {
      project,
      hypothesesCount: hyps.length,
      contactsCount: conts.length,
      insightsCount: ins.length,
      hypothesesByStatus: {
        untested: hyps.filter((h) => h.status === "untested").length,
        testing: hyps.filter((h) => h.status === "testing").length,
        validated: hyps.filter((h) => h.status === "validated").length,
        invalidated: hyps.filter((h) => h.status === "invalidated").length,
      },
    },
    null,
    2
  );
}

export function getProjectHypotheses(projectId: number): string {
  const db = getDb();
  const hyps = db.select().from(hypotheses).where(eq(hypotheses.projectId, projectId)).all();
  const allInsights = db.select().from(insights).where(eq(insights.projectId, projectId)).all();

  const result = hyps.map((h) => ({
    ...h,
    evidence: allInsights.filter((i) => i.hypothesisId === h.id),
  }));

  return JSON.stringify(result, null, 2);
}

export function getProjectInsights(projectId: number): string {
  const db = getDb();
  return JSON.stringify(
    db.select().from(insights).where(eq(insights.projectId, projectId)).all(),
    null,
    2
  );
}

export function getProjectContacts(projectId: number): string {
  const db = getDb();
  return JSON.stringify(
    db.select().from(contacts).where(eq(contacts.projectId, projectId)).all(),
    null,
    2
  );
}
