import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SqliteDb } from "../../db/sqlite.js";
import { createSqliteDb } from "../../db/sqlite.js";

let testDb: SqliteDb;

vi.mock("../../db/index.js", async () => {
  const actual = await vi.importActual<typeof import("../../db/schema.js")>("../../db/schema.js");
  return {
    ...actual,
    getDb: async () => testDb,
  };
});

const { projectTools } = await import("../../tools/project.js");

describe("project tools", () => {
  beforeEach(async () => {
    testDb = await createSqliteDb(":memory:");
  });

  it("create_project returns the new project", async () => {
    const result = await projectTools.create_project.handler({
      name: "Acme Validator",
      description: "Validate idea X",
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.id).toBe(1);
    expect(data.name).toBe("Acme Validator");
    expect(data.description).toBe("Validate idea X");
  });

  it("list_projects returns all projects", async () => {
    await projectTools.create_project.handler({ name: "P1", description: "D1" });
    await projectTools.create_project.handler({ name: "P2", description: "D2" });

    const result = await projectTools.list_projects.handler();
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe("P1");
    expect(data[1].name).toBe("P2");
  });

  it("create_hypothesis links to project", async () => {
    const proj = await projectTools.create_project.handler({ name: "P", description: "D" });
    const projectId = JSON.parse(proj.content[0].text).id;

    const result = await projectTools.create_hypothesis.handler({
      projectId,
      statement: "Users will pay $50/mo",
      acceptanceCriteria: "3 out of 5 interviewees say yes",
    });
    const hyp = JSON.parse(result.content[0].text);
    expect(hyp.projectId).toBe(projectId);
    expect(hyp.statement).toBe("Users will pay $50/mo");
    expect(hyp.status).toBe("untested");
  });

  it("update_hypothesis changes status and confidence", async () => {
    const proj = await projectTools.create_project.handler({ name: "P", description: "D" });
    const projectId = JSON.parse(proj.content[0].text).id;

    const created = await projectTools.create_hypothesis.handler({
      projectId,
      statement: "Problem exists",
      acceptanceCriteria: "Evidence from 5 calls",
    });
    const hypId = JSON.parse(created.content[0].text).id;

    const updated = await projectTools.update_hypothesis.handler({
      hypothesisId: hypId,
      status: "validated",
      confidenceScore: 0.85,
    });
    const data = JSON.parse(updated.content[0].text);
    expect(data.status).toBe("validated");
    expect(data.confidenceScore).toBe(0.85);
  });

  it("list_hypotheses returns hypotheses for a project", async () => {
    const proj = await projectTools.create_project.handler({ name: "P", description: "D" });
    const projectId = JSON.parse(proj.content[0].text).id;

    await projectTools.create_hypothesis.handler({
      projectId,
      statement: "H1",
      acceptanceCriteria: "C1",
    });
    await projectTools.create_hypothesis.handler({
      projectId,
      statement: "H2",
      acceptanceCriteria: "C2",
    });

    const result = await projectTools.list_hypotheses.handler({ projectId });
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveLength(2);
  });

  it("get_project_status returns metrics", async () => {
    const proj = await projectTools.create_project.handler({ name: "P", description: "D" });
    const projectId = JSON.parse(proj.content[0].text).id;

    await projectTools.create_hypothesis.handler({
      projectId,
      statement: "H1",
      acceptanceCriteria: "C1",
    });

    const result = await projectTools.get_project_status.handler({ projectId });
    const data = JSON.parse(result.content[0].text);
    expect(data.project.name).toBe("P");
    expect(data.metrics.totalHypotheses).toBe(1);
    expect(data.metrics.untested).toBe(1);
  });

  it("get_project_status handles missing project", async () => {
    const result = await projectTools.get_project_status.handler({ projectId: 999 });
    expect(result.content[0].text).toContain("not found");
  });
});
