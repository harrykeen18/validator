import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const hypotheses = sqliteTable("hypotheses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id),
  statement: text("statement").notNull(),
  acceptanceCriteria: text("acceptance_criteria").notNull(),
  status: text("status", {
    enum: ["untested", "testing", "validated", "invalidated"],
  })
    .notNull()
    .default("untested"),
  confidenceScore: real("confidence_score").default(0),
  priority: integer("priority").default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const icps = sqliteTable("icps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id),
  name: text("name").notNull(),
  demographics: text("demographics").notNull(),
  behaviors: text("behaviors").notNull(),
  painPoints: text("pain_points").notNull(),
  channels: text("channels").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const contacts = sqliteTable("contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id),
  icpId: integer("icp_id").references(() => icps.id),
  name: text("name").notNull(),
  company: text("company"),
  role: text("role"),
  channel: text("channel"),
  linkedinUrl: text("linkedin_url"),
  status: text("status", {
    enum: ["identified", "contacted", "scheduled", "completed", "declined"],
  })
    .notNull()
    .default("identified"),
  notes: text("notes"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const outreachMessages = sqliteTable("outreach_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  contactId: integer("contact_id")
    .notNull()
    .references(() => contacts.id),
  channel: text("channel", {
    enum: ["email", "linkedin", "twitter", "community"],
  }).notNull(),
  content: text("content").notNull(),
  status: text("status", {
    enum: ["draft", "sent", "responded", "no_response", "booked"],
  })
    .notNull()
    .default("draft"),
  sentAt: text("sent_at"),
  respondedAt: text("responded_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const conversations = sqliteTable("conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id),
  contactId: integer("contact_id").references(() => contacts.id),
  date: text("date").notNull(),
  rawTranscript: text("raw_transcript"),
  summary: text("summary"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const insights = sqliteTable("insights", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id").references(() => conversations.id),
  hypothesisId: integer("hypothesis_id").references(() => hypotheses.id),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id),
  content: text("content").notNull(),
  verbatimQuote: text("verbatim_quote"),
  signalStrength: text("signal_strength", {
    enum: ["strong", "medium", "weak"],
  }).notNull(),
  direction: text("direction", {
    enum: ["supports", "contradicts", "neutral"],
  }).notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
