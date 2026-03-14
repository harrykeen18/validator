import fs from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/sql-js";
import initSqlJs from "sql.js";
import * as schema from "./schema.js";

export async function createSqliteDb(dbPath: string) {
  const SQL = await initSqlJs();

  // Load existing database file if it exists, otherwise create new
  let sqlite: InstanceType<typeof SQL.Database>;
  if (dbPath !== ":memory:" && fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    sqlite = new SQL.Database(buffer);
  } else {
    sqlite = new SQL.Database();
  }

  sqlite.run("PRAGMA foreign_keys = ON");

  // Create tables if they don't exist
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hypotheses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      statement TEXT NOT NULL,
      acceptance_criteria TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'untested' CHECK(status IN ('untested','testing','validated','invalidated')),
      confidence_score REAL DEFAULT 0,
      priority INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS icps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      name TEXT NOT NULL,
      demographics TEXT NOT NULL,
      behaviors TEXT NOT NULL,
      pain_points TEXT NOT NULL,
      channels TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      icp_id INTEGER REFERENCES icps(id),
      name TEXT NOT NULL,
      company TEXT,
      role TEXT,
      channel TEXT,
      linkedin_url TEXT,
      status TEXT NOT NULL DEFAULT 'identified' CHECK(status IN ('identified','contacted','scheduled','completed','declined')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS outreach_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL REFERENCES contacts(id),
      channel TEXT NOT NULL CHECK(channel IN ('email','linkedin','twitter','community')),
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','responded','no_response','booked')),
      sent_at TEXT,
      responded_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      contact_id INTEGER REFERENCES contacts(id),
      date TEXT NOT NULL,
      raw_transcript TEXT,
      summary TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS insights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER REFERENCES conversations(id),
      hypothesis_id INTEGER REFERENCES hypotheses(id),
      project_id INTEGER NOT NULL REFERENCES projects(id),
      content TEXT NOT NULL,
      verbatim_quote TEXT,
      signal_strength TEXT NOT NULL CHECK(signal_strength IN ('strong','medium','weak')),
      direction TEXT NOT NULL CHECK(direction IN ('supports','contradicts','neutral')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const db = drizzle(sqlite, { schema });

  // Persist to disk after each mutation if using a file path
  if (dbPath !== ":memory:") {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const originalRun = db.run.bind(db);
    db.run = ((query: any) => {
      const result = originalRun(query);
      const data = sqlite.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
      return result;
    }) as typeof db.run;
  }

  return db;
}

export type SqliteDb = Awaited<ReturnType<typeof createSqliteDb>>;
