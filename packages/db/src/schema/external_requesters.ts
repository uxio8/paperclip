import { pgTable, uuid, text, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const externalRequesters = pgTable(
  "external_requesters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    displayName: text("display_name"),
    phoneNumber: text("phone_number"),
    email: text("email"),
    externalRef: text("external_ref"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCreatedIdx: index("external_requesters_company_created_idx").on(table.companyId, table.createdAt),
    companyPhoneUq: uniqueIndex("external_requesters_company_phone_uq").on(table.companyId, table.phoneNumber),
    companyExternalRefUq: uniqueIndex("external_requesters_company_external_ref_uq").on(
      table.companyId,
      table.externalRef,
    ),
  }),
);
