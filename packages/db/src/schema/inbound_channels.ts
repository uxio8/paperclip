import { pgTable, uuid, text, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { projects } from "./projects.js";
import { agents } from "./agents.js";

export const inboundChannels = pgTable(
  "inbound_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    type: text("type").notNull(),
    status: text("status").notNull().default("active"),
    webhookSecretHash: text("webhook_secret_hash"),
    defaultProjectId: uuid("default_project_id").references(() => projects.id, { onDelete: "set null" }),
    triageAgentId: uuid("triage_agent_id").references(() => agents.id, { onDelete: "set null" }),
    ackTemplate: text("ack_template").notNull(),
    resolutionTemplate: text("resolution_template").notNull(),
    outboundWebhookUrl: text("outbound_webhook_url"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("inbound_channels_company_status_idx").on(table.companyId, table.status, table.createdAt),
    companyTypeIdx: index("inbound_channels_company_type_idx").on(table.companyId, table.type),
    companyNameUq: uniqueIndex("inbound_channels_company_name_uq").on(table.companyId, table.name),
  }),
);
