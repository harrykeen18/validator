import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import * as schema from "../../db/schema.js";

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  sqlite.exec(`
    CREATE TABLE projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE hypotheses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      statement TEXT NOT NULL,
      acceptance_criteria TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'untested',
      confidence_score REAL DEFAULT 0,
      priority INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE icps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      name TEXT NOT NULL,
      demographics TEXT NOT NULL,
      behaviors TEXT NOT NULL,
      pain_points TEXT NOT NULL,
      channels TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      icp_id INTEGER REFERENCES icps(id),
      name TEXT NOT NULL,
      company TEXT,
      role TEXT,
      channel TEXT,
      linkedin_url TEXT,
      status TEXT NOT NULL DEFAULT 'identified',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE outreach_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL REFERENCES contacts(id),
      channel TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      sent_at TEXT,
      responded_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      contact_id INTEGER REFERENCES contacts(id),
      date TEXT NOT NULL,
      raw_transcript TEXT,
      summary TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE insights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER REFERENCES conversations(id),
      hypothesis_id INTEGER REFERENCES hypotheses(id),
      project_id INTEGER NOT NULL REFERENCES projects(id),
      content TEXT NOT NULL,
      verbatim_quote TEXT,
      signal_strength TEXT NOT NULL,
      direction TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return drizzle(sqlite, { schema });
}

describe("database schema", () => {
  it("creates all tables", () => {
    const db = createTestDb();
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

  it("enforces foreign key from hypotheses to projects", () => {
    const db = createTestDb();

    // Insert a project first
    const project = db
      .insert(schema.projects)
      .values({ name: "Test", description: "Desc" })
      .returning()
      .get();

    // Should succeed with valid project_id
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

    // Should fail with invalid project_id
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

  it("enforces foreign key from contacts to projects and icps", () => {
    const db = createTestDb();
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

    // Valid contact with ICP
    const contact = db
      .insert(schema.contacts)
      .values({ projectId: project.id, icpId: icp.id, name: "Alice" })
      .returning()
      .get();
    expect(contact.icpId).toBe(icp.id);

    // Invalid ICP reference should fail
    expect(() =>
      db
        .insert(schema.contacts)
        .values({ projectId: project.id, icpId: 999, name: "Bob" })
        .returning()
        .get(),
    ).toThrow();
  });

  it("sets default values for status and timestamps", () => {
    const db = createTestDb();
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
});
