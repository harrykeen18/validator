export interface Config {
  dbMode: "sqlite" | "postgres";
  dbPath: string;
  databaseUrl: string;
  anthropicApiKey: string;
  transport: "stdio" | "sse";
  port: number;
}

import os from "node:os";
import path from "node:path";

export function loadConfig(): Config {
  const defaultDbPath = path.join(os.homedir(), ".validator", "data.db");
  return {
    dbMode: (process.env.DB_MODE as "sqlite" | "postgres") || "sqlite",
    dbPath: process.env.DB_PATH || defaultDbPath,
    databaseUrl: process.env.DATABASE_URL || "",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
    transport: (process.env.TRANSPORT as "stdio" | "sse") || "stdio",
    port: parseInt(process.env.PORT || "3000", 10),
  };
}
