import { loadConfig } from "../config.js";
import { createSqliteDb, type SqliteDb } from "./sqlite.js";

export type Db = SqliteDb;

let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (!db) {
    const config = loadConfig();
    if (config.dbMode === "sqlite") {
      db = await createSqliteDb(config.dbPath);
    } else {
      throw new Error("PostgreSQL support not yet implemented. Use DB_MODE=sqlite.");
    }
  }
  return db;
}

export * from "./schema.js";
