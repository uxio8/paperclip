import { pgTable, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { issues } from "./issues.js";
import { inboundChannels } from "./inbound_channels.js";
import { externalRequesters } from "./external_requesters.js";

export const customerThreads = pgTable(
  "customer_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    issueId: uuid("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
    inboundChannelId: uuid("inbound_channel_id").notNull().references(() => inboundChannels.id),
    externalRequesterId: uuid("external_requester_id").notNull().references(() => externalRequesters.id),
    sourceChannel: text("source_channel").notNull(),
    externalThreadId: text("external_thread_id").notNull(),
    externalThreadName: text("external_thread_name"),
    lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
    lastOutboundAt: timestamp("last_outbound_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyThreadIdx: uniqueIndex("customer_threads_company_channel_thread_uq").on(
      table.companyId,
      table.inboundChannelId,
      table.externalThreadId,
    ),
    issueUq: uniqueIndex("customer_threads_issue_uq").on(table.issueId),
    companyCreatedIdx: index("customer_threads_company_created_idx").on(table.companyId, table.createdAt),
  }),
);
