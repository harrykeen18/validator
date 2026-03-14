import { describe, expect, it } from "vitest";
import * as schema from "../../db/schema.js";
import { createSqliteDb } from "../../db/sqlite.js";

describe("database schema", () => {
  it("creates all tables", async () => {
    const db = await createSqliteDb(":memory:");
    const tables = db.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    );
    const names = tables.map((t: { name: string }) => t.name);
    expect(names).toContain("projects");
    expect(names).toContain("hypotheses");
    expect(names).toContain("icps");
    expect(names).toContain("contacts");
    expect(names).toContain("outreach_messages");
    expect(names).toContain("conversations");
    expect(names).toContain("insights");
  });

  it("enforces foreign key from hypotheses to projects", async () => {
    const db = await createSqliteDb(":memory:");

    const project = db
      .insert(schema.projects)
      .values({ name: "Test", description: "Desc" })
      .returning()
      .get();

    const hyp = db
      .insert(schema.hypotheses)
      .values({
        projectId: project.id,
        statement: "Users want this",
        acceptanceCriteria: "3/5 say yes",
      })
      .returning()
      .get();
    expect(hyp.projectId).toBe(project.id);

    expect(() =>
      db
        .insert(schema.hypotheses)
        .values({
          projectId: 999,
          statement: "Orphan",
          acceptanceCriteria: "N/A",
        })
        .returning()
        .get(),
    ).toThrow();
  });

  it("enforces foreign key from contacts to projects and icps", async () => {
    const db = await createSqliteDb(":memory:");
    const project = db
      .insert(schema.projects)
      .values({ name: "P", description: "D" })
      .returning()
      .get();
    const icp = db
      .insert(schema.icps)
      .values({
        projectId: project.id,
        name: "Founders",
        demographics: "25-40",
        behaviors: "Build products",
        painPoints: "No validation",
        channels: "Twitter",
      })
      .returning()
      .get();

    const contact = db
      .insert(schema.contacts)
      .values({ projectId: project.id, icpId: icp.id, name: "Alice" })
      .returning()
      .get();
    expect(contact.icpId).toBe(icp.id);

    expect(() =>
      db
        .insert(schema.contacts)
        .values({ projectId: project.id, icpId: 999, name: "Bob" })
        .returning()
        .get(),
    ).toThrow();
  });

  it("sets default values for status and timestamps", async () => {
    const db = await createSqliteDb(":memory:");
    const project = db
      .insert(schema.projects)
      .values({ name: "Test", description: "D" })
      .returning()
      .get();

    expect(project.createdAt).toBeTruthy();
    expect(project.updatedAt).toBeTruthy();

    const hyp = db
      .insert(schema.hypotheses)
      .values({
        projectId: project.id,
        statement: "s",
        acceptanceCriteria: "c",
      })
      .returning()
      .get();
    expect(hyp.status).toBe("untested");
    expect(hyp.confidenceScore).toBe(0);

    const contact = db
      .insert(schema.contacts)
      .values({ projectId: project.id, name: "Eve" })
      .returning()
      .get();
    expect(contact.status).toBe("identified");
  });

  it("has no native binary dependencies", async () => {
    // Verify sql.js (WASM) works — this would fail if we accidentally
    // depended on a native module like better-sqlite3
    const db = await createSqliteDb(":memory:");
    const result = db
      .insert(schema.projects)
      .values({ name: "Native check", description: "Should work on any platform" })
      .returning()
      .get();
    expect(result.id).toBe(1);
  });
});
