CREATE TABLE "customer_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"issue_comment_id" uuid,
	"external_message_id" text,
	"direction" text NOT NULL,
	"sender_role" text NOT NULL,
	"body" text,
	"content_type" text DEFAULT 'text/plain' NOT NULL,
	"delivery_status" text DEFAULT 'received' NOT NULL,
	"raw_payload" jsonb,
	"sent_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"inbound_channel_id" uuid NOT NULL,
	"external_requester_id" uuid NOT NULL,
	"source_channel" text NOT NULL,
	"external_thread_id" text NOT NULL,
	"external_thread_name" text,
	"last_inbound_at" timestamp with time zone,
	"last_outbound_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_requesters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"display_name" text,
	"phone_number" text,
	"email" text,
	"external_ref" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbound_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"webhook_secret_hash" text,
	"default_project_id" uuid,
	"triage_agent_id" uuid,
	"ack_template" text NOT NULL,
	"resolution_template" text NOT NULL,
	"outbound_webhook_url" text,
	"metadata" jsonb,
	"last_inbound_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "external_requester_id" uuid;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "source_channel" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "customer_visible_status" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "intake_kind" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "delivery_branch" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "delivery_commit_sha" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "delivery_pr_url" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "customer_resolution_summary" text;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_thread_id_customer_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."customer_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_issue_comment_id_issue_comments_id_fk" FOREIGN KEY ("issue_comment_id") REFERENCES "public"."issue_comments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_threads" ADD CONSTRAINT "customer_threads_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_threads" ADD CONSTRAINT "customer_threads_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_threads" ADD CONSTRAINT "customer_threads_inbound_channel_id_inbound_channels_id_fk" FOREIGN KEY ("inbound_channel_id") REFERENCES "public"."inbound_channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_threads" ADD CONSTRAINT "customer_threads_external_requester_id_external_requesters_id_fk" FOREIGN KEY ("external_requester_id") REFERENCES "public"."external_requesters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_requesters" ADD CONSTRAINT "external_requesters_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_channels" ADD CONSTRAINT "inbound_channels_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_channels" ADD CONSTRAINT "inbound_channels_default_project_id_projects_id_fk" FOREIGN KEY ("default_project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_channels" ADD CONSTRAINT "inbound_channels_triage_agent_id_agents_id_fk" FOREIGN KEY ("triage_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_messages_thread_created_idx" ON "customer_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "customer_messages_issue_created_idx" ON "customer_messages" USING btree ("issue_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_messages_thread_external_message_uq" ON "customer_messages" USING btree ("thread_id","external_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_threads_company_channel_thread_uq" ON "customer_threads" USING btree ("company_id","inbound_channel_id","external_thread_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_threads_issue_uq" ON "customer_threads" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "customer_threads_company_created_idx" ON "customer_threads" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "external_requesters_company_created_idx" ON "external_requesters" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "external_requesters_company_phone_uq" ON "external_requesters" USING btree ("company_id","phone_number");--> statement-breakpoint
CREATE UNIQUE INDEX "external_requesters_company_external_ref_uq" ON "external_requesters" USING btree ("company_id","external_ref");--> statement-breakpoint
CREATE INDEX "inbound_channels_company_status_idx" ON "inbound_channels" USING btree ("company_id","status","created_at");--> statement-breakpoint
CREATE INDEX "inbound_channels_company_type_idx" ON "inbound_channels" USING btree ("company_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_channels_company_name_uq" ON "inbound_channels" USING btree ("company_id","name");--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_external_requester_id_external_requesters_id_fk" FOREIGN KEY ("external_requester_id") REFERENCES "public"."external_requesters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issues_company_external_requester_idx" ON "issues" USING btree ("company_id","external_requester_id");--> statement-breakpoint
CREATE INDEX "issues_company_customer_visible_status_idx" ON "issues" USING btree ("company_id","customer_visible_status");