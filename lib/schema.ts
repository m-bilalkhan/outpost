import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  bigserial,
} from "drizzle-orm/pg-core";

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  company: text("company"),
  role: text("role"),
  notes: text("notes"),
  tags: text("tags").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TemplateKind = "outreach" | "followup";

export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  subjectTpl: text("subject_tpl").notNull(),
  bodyTpl: text("body_tpl").notNull(),
  defaultVars: jsonb("default_vars").$type<Record<string, string>>().notNull().default({}),
  kind: text("kind").$type<TemplateKind>().notNull().default("outreach"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MessageStatus =
  | "draft"
  | "scheduled"
  | "sent"
  | "failed"
  | "cancelled";

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  contactId: uuid("contact_id"),
  templateId: uuid("template_id"),
  toEmail: text("to_email").notNull(),
  toName: text("to_name"),
  subject: text("subject").notNull().default(""),
  bodyHtml: text("body_html").notNull().default(""),
  bodyText: text("body_text").notNull().default(""),
  status: text("status").$type<MessageStatus>().notNull().default("draft"),
  threadId: uuid("thread_id"),
  parentId: uuid("parent_id"),
  inReplyTo: text("in_reply_to"),
  rfcReferences: text("rfc_references"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  smtpMessageId: text("smtp_message_id"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type JobStatus = "pending" | "running" | "done" | "failed" | "cancelled";

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  runAt: timestamp("run_at", { withTimezone: true }).notNull(),
  status: text("status").$type<JobStatus>().notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  lastError: text("last_error"),
  result: jsonb("result"),
  dedupeKey: text("dedupe_key").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobEvents = pgTable("job_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  jobId: uuid("job_id").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  level: text("level").$type<"info" | "warn" | "error">().notNull().default("info"),
  message: text("message").notNull(),
  meta: jsonb("meta"),
});
