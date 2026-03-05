import { pgTable, uuid, text, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { customerThreads } from "./customer_threads.js";
import { issues } from "./issues.js";
import { issueComments } from "./issue_comments.js";

export const customerMessages = pgTable(
  "customer_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    threadId: uuid("thread_id").notNull().references(() => customerThreads.id, { onDelete: "cascade" }),
    issueId: uuid("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
    issueCommentId: uuid("issue_comment_id").references(() => issueComments.id, { onDelete: "set null" }),
    externalMessageId: text("external_message_id"),
    direction: text("direction").notNull(),
    senderRole: text("sender_role").notNull(),
    body: text("body"),
    contentType: text("content_type").notNull().default("text/plain"),
    deliveryStatus: text("delivery_status").notNull().default("received"),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown> | null>(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    threadCreatedIdx: index("customer_messages_thread_created_idx").on(table.threadId, table.createdAt),
    issueCreatedIdx: index("customer_messages_issue_created_idx").on(table.issueId, table.createdAt),
    threadExternalMessageUq: uniqueIndex("customer_messages_thread_external_message_uq").on(
      table.threadId,
      table.externalMessageId,
    ),
  }),
);
