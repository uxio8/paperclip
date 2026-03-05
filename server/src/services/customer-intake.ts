import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  assets,
  companies,
  customerMessages,
  customerThreads,
  externalRequesters,
  inboundChannels,
  issueAttachments,
  issueComments,
  issues,
} from "@paperclipai/db";
import type {
  CustomerMessage,
  CustomerThread,
  ExternalRequester,
  InboundChannel,
  InboundWhatsAppWebhook,
} from "@paperclipai/shared";
import { badRequest, conflict, notFound, unauthorized, unprocessable } from "../errors.js";
import type { StorageService } from "../storage/types.js";
import { logActivity } from "./activity-log.js";

type RawInboundChannel = typeof inboundChannels.$inferSelect;
type RawExternalRequester = typeof externalRequesters.$inferSelect;
type RawCustomerThread = typeof customerThreads.$inferSelect;
type RawCustomerMessage = typeof customerMessages.$inferSelect;
type RawIssue = typeof issues.$inferSelect;

const CUSTOMER_OPEN_ISSUE_STATUSES = new Set(["backlog", "todo", "in_progress", "in_review", "blocked"]);

export function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function truncate(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function requesterLabel(requester: Pick<RawExternalRequester, "displayName" | "phoneNumber" | "email">) {
  return requester.displayName || requester.phoneNumber || requester.email || "Unknown requester";
}

function toInboundChannel(row: RawInboundChannel): InboundChannel {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    type: row.type as InboundChannel["type"],
    status: row.status as InboundChannel["status"],
    defaultProjectId: row.defaultProjectId ?? null,
    triageAgentId: row.triageAgentId ?? null,
    ackTemplate: row.ackTemplate,
    resolutionTemplate: row.resolutionTemplate,
    outboundWebhookUrl: row.outboundWebhookUrl ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    lastInboundAt: row.lastInboundAt ?? null,
    hasWebhookSecret: Boolean(row.webhookSecretHash),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toExternalRequester(row: RawExternalRequester): ExternalRequester {
  return {
    id: row.id,
    companyId: row.companyId,
    displayName: row.displayName ?? null,
    phoneNumber: row.phoneNumber ?? null,
    email: row.email ?? null,
    externalRef: row.externalRef ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toCustomerMessage(
  row: RawCustomerMessage,
  attachmentsByCommentId: Map<string, CustomerMessage["attachments"]>,
): CustomerMessage {
  const issueCommentId = row.issueCommentId ?? null;
  return {
    id: row.id,
    companyId: row.companyId,
    threadId: row.threadId,
    issueId: row.issueId,
    issueCommentId,
    externalMessageId: row.externalMessageId ?? null,
    direction: row.direction as CustomerMessage["direction"],
    senderRole: row.senderRole,
    body: row.body ?? null,
    contentType: row.contentType,
    deliveryStatus: row.deliveryStatus as CustomerMessage["deliveryStatus"],
    rawPayload: (row.rawPayload as Record<string, unknown> | null) ?? null,
    sentAt: row.sentAt ?? null,
    receivedAt: row.receivedAt ?? null,
    attachments: issueCommentId ? attachmentsByCommentId.get(issueCommentId) ?? [] : [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function renderTemplate(
  template: string,
  context: {
    requester: ExternalRequester;
    issue: RawIssue;
    thread: RawCustomerThread;
    channel: InboundChannel;
  },
) {
  const values: Record<string, string> = {
    "requester.displayName": context.requester.displayName ?? "",
    "requester.phoneNumber": context.requester.phoneNumber ?? "",
    "requester.email": context.requester.email ?? "",
    "requester.externalRef": context.requester.externalRef ?? "",
    "issue.id": context.issue.id,
    "issue.identifier": context.issue.identifier ?? "",
    "issue.title": context.issue.title,
    "issue.customerResolutionSummary": context.issue.customerResolutionSummary ?? "",
    "issue.deliveryPrUrl": context.issue.deliveryPrUrl ?? "",
    "thread.externalThreadId": context.thread.externalThreadId,
    "channel.name": context.channel.name,
  };
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_match, key: string) => values[key] ?? "");
}

export function buildIssueTitle(payload: InboundWhatsAppWebhook, requester: RawExternalRequester) {
  const subject = readNonEmptyString(payload.subject);
  if (subject) return truncate(subject, 140);
  const body = readNonEmptyString(payload.message.body);
  if (body) return truncate(`${requesterLabel(requester)}: ${body.split("\n")[0]}`, 140);
  return truncate(`Customer message from ${requesterLabel(requester)}`, 140);
}

export function buildInitialIssueDescription(
  payload: InboundWhatsAppWebhook,
  requester: RawExternalRequester,
  channel: RawInboundChannel,
) {
  const lines = [
    `External customer intake from ${channel.name}.`,
    `Requester: ${requesterLabel(requester)}`,
    requester.phoneNumber ? `Phone: ${requester.phoneNumber}` : null,
    payload.externalThreadId ? `External thread: ${payload.externalThreadId}` : null,
    "",
    readNonEmptyString(payload.message.body) ?? "Media-only message received.",
  ];
  return lines.filter((line): line is string => line !== null).join("\n");
}

export function buildInboundCommentBody(input: {
  requester: RawExternalRequester;
  payload: InboundWhatsAppWebhook;
  importedMediaCount: number;
  failedMediaCount: number;
}) {
  const requesterSummary = `${requesterLabel(input.requester)}${
    input.requester.phoneNumber ? ` (${input.requester.phoneNumber})` : ""
  }`;
  const body = readNonEmptyString(input.payload.message.body);
  const lines = [
    `Customer message via WhatsApp from ${requesterSummary}.`,
    "",
    body ?? "Media attachment received from customer.",
  ];
  if (input.importedMediaCount > 0) {
    lines.push("", `Imported ${input.importedMediaCount} attachment${input.importedMediaCount === 1 ? "" : "s"}.`);
  }
  if (input.failedMediaCount > 0) {
    lines.push("", `Paperclip warning: ${input.failedMediaCount} attachment${input.failedMediaCount === 1 ? "" : "s"} failed to import.`);
  }
  return lines.join("\n");
}

function webhookErrorMessage(status: number) {
  if (status >= 200 && status < 300) return null;
  return `Outbound webhook returned status ${status}`;
}

type PreparedMediaUpload = {
  originalFilename: string | null;
  stored: Awaited<ReturnType<StorageService["putFile"]>>;
};

async function fetchMediaBuffer(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download media (${res.status})`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function prepareInboundMediaUploads(input: {
  companyId: string;
  storage: StorageService;
  threadKey: string;
  media: InboundWhatsAppWebhook["message"]["media"];
}) {
  const uploads: PreparedMediaUpload[] = [];
  const warnings: string[] = [];

  for (const mediaItem of input.media) {
    try {
      const body = mediaItem.base64Data
        ? Buffer.from(mediaItem.base64Data, "base64")
        : await fetchMediaBuffer(mediaItem.downloadUrl!);
      const stored = await input.storage.putFile({
        companyId: input.companyId,
        namespace: `customer-intake/${input.threadKey}`,
        originalFilename: mediaItem.filename ?? mediaItem.externalMediaId ?? "attachment",
        contentType: mediaItem.contentType,
        body,
      });
      uploads.push({
        originalFilename: mediaItem.filename ?? mediaItem.externalMediaId ?? null,
        stored,
      });
    } catch (err) {
      warnings.push(err instanceof Error ? err.message : String(err));
    }
  }

  return { uploads, warnings };
}

type HydratedThreadRow = {
  thread: RawCustomerThread;
  requester: RawExternalRequester;
  channel: RawInboundChannel;
  issue: RawIssue;
};

export function customerIntakeService(db: Db, storage: StorageService) {
  async function getChannelById(id: string) {
    return db
      .select()
      .from(inboundChannels)
      .where(eq(inboundChannels.id, id))
      .then((rows) => rows[0] ?? null);
  }

  async function getHydratedThreadByIssue(issueId: string): Promise<HydratedThreadRow | null> {
    const row = await db
      .select({
        thread: customerThreads,
        requester: externalRequesters,
        channel: inboundChannels,
        issue: issues,
      })
      .from(customerThreads)
      .innerJoin(externalRequesters, eq(customerThreads.externalRequesterId, externalRequesters.id))
      .innerJoin(inboundChannels, eq(customerThreads.inboundChannelId, inboundChannels.id))
      .innerJoin(issues, eq(customerThreads.issueId, issues.id))
      .where(eq(customerThreads.issueId, issueId))
      .then((rows) => rows[0] ?? null);
    return row;
  }

  async function getHydratedThreadById(threadId: string): Promise<HydratedThreadRow | null> {
    const row = await db
      .select({
        thread: customerThreads,
        requester: externalRequesters,
        channel: inboundChannels,
        issue: issues,
      })
      .from(customerThreads)
      .innerJoin(externalRequesters, eq(customerThreads.externalRequesterId, externalRequesters.id))
      .innerJoin(inboundChannels, eq(customerThreads.inboundChannelId, inboundChannels.id))
      .innerJoin(issues, eq(customerThreads.issueId, issues.id))
      .where(eq(customerThreads.id, threadId))
      .then((rows) => rows[0] ?? null);
    return row;
  }

  async function hydrateThread(row: HydratedThreadRow): Promise<CustomerThread> {
    const messageRows = await db
      .select()
      .from(customerMessages)
      .where(eq(customerMessages.threadId, row.thread.id))
      .orderBy(asc(customerMessages.createdAt), asc(customerMessages.id));

    const commentIds = messageRows
      .map((message) => message.issueCommentId)
      .filter((value): value is string => Boolean(value));

    const attachmentRows =
      commentIds.length === 0
        ? []
        : await db
          .select({
            id: issueAttachments.id,
            companyId: issueAttachments.companyId,
            issueId: issueAttachments.issueId,
            issueCommentId: issueAttachments.issueCommentId,
            assetId: issueAttachments.assetId,
            provider: assets.provider,
            objectKey: assets.objectKey,
            contentType: assets.contentType,
            byteSize: assets.byteSize,
            sha256: assets.sha256,
            originalFilename: assets.originalFilename,
            createdByAgentId: assets.createdByAgentId,
            createdByUserId: assets.createdByUserId,
            createdAt: issueAttachments.createdAt,
            updatedAt: issueAttachments.updatedAt,
          })
          .from(issueAttachments)
          .innerJoin(assets, eq(issueAttachments.assetId, assets.id))
          .where(inArray(issueAttachments.issueCommentId, commentIds));

    const attachmentsByCommentId = new Map<string, CustomerMessage["attachments"]>();
    for (const attachment of attachmentRows) {
      if (!attachment.issueCommentId) continue;
      const existing = attachmentsByCommentId.get(attachment.issueCommentId) ?? [];
      existing.push({
        ...attachment,
        contentPath: `/api/attachments/${attachment.id}/content`,
      });
      attachmentsByCommentId.set(attachment.issueCommentId, existing);
    }

    return {
      id: row.thread.id,
      companyId: row.thread.companyId,
      issueId: row.thread.issueId,
      inboundChannelId: row.thread.inboundChannelId,
      externalRequesterId: row.thread.externalRequesterId,
      sourceChannel: row.thread.sourceChannel as CustomerThread["sourceChannel"],
      externalThreadId: row.thread.externalThreadId,
      externalThreadName: row.thread.externalThreadName ?? null,
      lastInboundAt: row.thread.lastInboundAt ?? null,
      lastOutboundAt: row.thread.lastOutboundAt ?? null,
      customerVisibleStatus: row.issue.customerVisibleStatus as CustomerThread["customerVisibleStatus"],
      requester: toExternalRequester(row.requester),
      channel: toInboundChannel(row.channel),
      messages: messageRows.map((message) => toCustomerMessage(message, attachmentsByCommentId)),
      createdAt: row.thread.createdAt,
      updatedAt: row.thread.updatedAt,
    };
  }

  async function queueOutboundMessage(input: {
    thread: RawCustomerThread;
    requester: RawExternalRequester;
    channel: RawInboundChannel;
    issue: RawIssue;
    body: string;
    reason: "ack" | "resolution";
  }) {
    const inserted = await db
      .insert(customerMessages)
      .values({
        companyId: input.thread.companyId,
        threadId: input.thread.id,
        issueId: input.thread.issueId,
        issueCommentId: null,
        externalMessageId: null,
        direction: "outbound",
        senderRole: "system",
        body: input.body,
        contentType: "text/plain",
        deliveryStatus: "queued",
        rawPayload: {
          reason: input.reason,
          channelType: input.channel.type,
          externalThreadId: input.thread.externalThreadId,
        },
        sentAt: null,
        receivedAt: null,
      })
      .returning()
      .then((rows) => rows[0]);

    await logActivity(db, {
      companyId: input.thread.companyId,
      actorType: "system",
      actorId: "customer-intake",
      action: "customer.message_queued",
      entityType: "customer_message",
      entityId: inserted.id,
      details: {
        issueId: input.issue.id,
        reason: input.reason,
      },
    });

    if (!input.channel.outboundWebhookUrl) {
      return { message: inserted, deliveryError: null as string | null };
    }

    let deliveryError: string | null = null;
    try {
      const response = await fetch(input.channel.outboundWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: input.channel.id,
          type: input.channel.type,
          reason: input.reason,
          requester: toExternalRequester(input.requester),
          issue: {
            id: input.issue.id,
            identifier: input.issue.identifier,
            title: input.issue.title,
            customerResolutionSummary: input.issue.customerResolutionSummary,
            deliveryPrUrl: input.issue.deliveryPrUrl,
          },
          thread: {
            id: input.thread.id,
            externalThreadId: input.thread.externalThreadId,
          },
          message: {
            id: inserted.id,
            body: inserted.body,
          },
        }),
      });
      deliveryError = webhookErrorMessage(response.status);
    } catch (err) {
      deliveryError = err instanceof Error ? err.message : String(err);
    }

    const delivered = deliveryError == null;
    await db
      .update(customerMessages)
      .set({
        deliveryStatus: delivered ? "sent" : "failed",
        sentAt: delivered ? new Date() : null,
        updatedAt: new Date(),
        rawPayload: {
          ...(inserted.rawPayload as Record<string, unknown> | null),
          deliveryError,
        },
      })
      .where(eq(customerMessages.id, inserted.id));

    await db
      .update(customerThreads)
      .set({
        lastOutboundAt: delivered ? new Date() : input.thread.lastOutboundAt,
        updatedAt: new Date(),
      })
      .where(eq(customerThreads.id, input.thread.id));

    await logActivity(db, {
      companyId: input.thread.companyId,
      actorType: "system",
      actorId: "customer-intake",
      action: delivered ? "customer.message_sent" : "customer.message_failed",
      entityType: "customer_message",
      entityId: inserted.id,
      details: {
        issueId: input.issue.id,
        reason: input.reason,
        deliveryError,
      },
    });

    return { message: inserted, deliveryError };
  }

  return {
    async listChannels(companyId: string) {
      const rows = await db
        .select()
        .from(inboundChannels)
        .where(eq(inboundChannels.companyId, companyId))
        .orderBy(desc(inboundChannels.createdAt));
      return rows.map(toInboundChannel);
    },

    async getChannel(id: string) {
      const row = await getChannelById(id);
      return row ? toInboundChannel(row) : null;
    },

    async createChannel(
      companyId: string,
      input: {
        name: string;
        type: string;
        status: string;
        defaultProjectId?: string | null;
        triageAgentId?: string | null;
        webhookSecret: string;
        ackTemplate: string;
        resolutionTemplate: string;
        outboundWebhookUrl?: string | null;
        metadata?: Record<string, unknown> | null;
      },
    ) {
      const [created] = await db
        .insert(inboundChannels)
        .values({
          companyId,
          name: input.name.trim(),
          type: input.type,
          status: input.status,
          defaultProjectId: input.defaultProjectId ?? null,
          triageAgentId: input.triageAgentId ?? null,
          webhookSecretHash: hashSecret(input.webhookSecret),
          ackTemplate: input.ackTemplate,
          resolutionTemplate: input.resolutionTemplate,
          outboundWebhookUrl: input.outboundWebhookUrl ?? null,
          metadata: input.metadata ?? null,
        })
        .returning();
      return toInboundChannel(created);
    },

    async updateChannel(
      id: string,
      input: {
        name?: string;
        type?: string;
        status?: string;
        defaultProjectId?: string | null;
        triageAgentId?: string | null;
        webhookSecret?: string;
        ackTemplate?: string;
        resolutionTemplate?: string;
        outboundWebhookUrl?: string | null;
        metadata?: Record<string, unknown> | null;
      },
    ) {
      const patch: Partial<typeof inboundChannels.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.name !== undefined) patch.name = input.name.trim();
      if (input.type !== undefined) patch.type = input.type;
      if (input.status !== undefined) patch.status = input.status;
      if (input.defaultProjectId !== undefined) patch.defaultProjectId = input.defaultProjectId;
      if (input.triageAgentId !== undefined) patch.triageAgentId = input.triageAgentId;
      if (input.webhookSecret !== undefined) patch.webhookSecretHash = hashSecret(input.webhookSecret);
      if (input.ackTemplate !== undefined) patch.ackTemplate = input.ackTemplate;
      if (input.resolutionTemplate !== undefined) patch.resolutionTemplate = input.resolutionTemplate;
      if (input.outboundWebhookUrl !== undefined) patch.outboundWebhookUrl = input.outboundWebhookUrl;
      if (input.metadata !== undefined) patch.metadata = input.metadata;

      const updated = await db
        .update(inboundChannels)
        .set(patch)
        .where(eq(inboundChannels.id, id))
        .returning()
        .then((rows) => rows[0] ?? null);
      return updated ? toInboundChannel(updated) : null;
    },

    async assertWebhookAccess(channelId: string, presentedSecret: string | null, expectedType = "whatsapp_webhook") {
      const row = await getChannelById(channelId);
      if (!row || row.type !== expectedType) throw notFound("Inbound channel not found");
      if (row.status !== "active") throw conflict("Inbound channel is not active");
      if (!row.webhookSecretHash) throw unauthorized("Inbound channel has no webhook secret configured");
      if (!presentedSecret || hashSecret(presentedSecret) !== row.webhookSecretHash) {
        throw unauthorized("Invalid inbound channel secret");
      }
      return row;
    },

    async getThreadByIssue(issueId: string) {
      const row = await getHydratedThreadByIssue(issueId);
      return row ? hydrateThread(row) : null;
    },

    async getThread(threadId: string) {
      const row = await getHydratedThreadById(threadId);
      return row ? hydrateThread(row) : null;
    },

    async buildCustomerReopenPatch(issueId: string) {
      const row = await getHydratedThreadByIssue(issueId);
      if (!row) return null;
      return {
        status: "todo",
        assigneeAgentId: row.channel.triageAgentId ?? row.issue.assigneeAgentId ?? null,
        assigneeUserId: null,
        customerVisibleStatus: "received",
        customerResolutionSummary: null,
        deliveryBranch: null,
        deliveryCommitSha: null,
        deliveryPrUrl: null,
      } as const;
    },

    async ingestWhatsAppWebhook(channelId: string, payload: InboundWhatsAppWebhook) {
      const channel = await getChannelById(channelId);
      if (!channel) throw notFound("Inbound channel not found");
      if (channel.status !== "active") throw conflict("Inbound channel is not active");

      const existingThread = await db
        .select()
        .from(customerThreads)
        .where(and(eq(customerThreads.inboundChannelId, channelId), eq(customerThreads.externalThreadId, payload.externalThreadId)))
        .then((rows) => rows[0] ?? null);

      if (existingThread) {
        const duplicate = await db
          .select({ id: customerMessages.id })
          .from(customerMessages)
          .where(
            and(
              eq(customerMessages.threadId, existingThread.id),
              eq(customerMessages.externalMessageId, payload.externalMessageId),
            ),
          )
          .then((rows) => rows[0] ?? null);
        if (duplicate) {
          const issue = await db
            .select()
            .from(issues)
            .where(eq(issues.id, existingThread.issueId))
            .then((rows) => rows[0] ?? null);
          if (!issue) throw notFound("Issue not found for existing customer thread");
          return {
            duplicate: true,
            issueId: issue.id,
            threadId: existingThread.id,
            ackMessage: null as string | null,
            wakeAgentId: null as string | null,
          };
        }
      }

      const mediaPreparation = await prepareInboundMediaUploads({
        companyId: channel.companyId,
        storage,
        threadKey: payload.externalThreadId,
        media: payload.message.media,
      });

      const now = payload.receivedAt ? new Date(payload.receivedAt) : new Date();

      const result = await db.transaction(async (tx) => {
        let requester =
          await tx
            .select()
            .from(externalRequesters)
            .where(
              and(
                eq(externalRequesters.companyId, channel.companyId),
                eq(externalRequesters.phoneNumber, payload.requester.phoneNumber),
              ),
            )
            .then((rows) => rows[0] ?? null);

        if (!requester && payload.requester.externalRef) {
          requester = await tx
            .select()
            .from(externalRequesters)
            .where(
              and(
                eq(externalRequesters.companyId, channel.companyId),
                eq(externalRequesters.externalRef, payload.requester.externalRef),
              ),
            )
            .then((rows) => rows[0] ?? null);
        }

        if (requester) {
          requester = await tx
            .update(externalRequesters)
            .set({
              displayName: payload.requester.displayName ?? requester.displayName,
              phoneNumber: payload.requester.phoneNumber,
              email: payload.requester.email ?? requester.email,
              externalRef: payload.requester.externalRef ?? requester.externalRef,
              metadata: payload.requester.metadata ?? requester.metadata,
              updatedAt: new Date(),
            })
            .where(eq(externalRequesters.id, requester.id))
            .returning()
            .then((rows) => rows[0] ?? requester);
        } else {
          requester = await tx
            .insert(externalRequesters)
            .values({
              companyId: channel.companyId,
              displayName: payload.requester.displayName ?? null,
              phoneNumber: payload.requester.phoneNumber,
              email: payload.requester.email ?? null,
              externalRef: payload.requester.externalRef ?? null,
              metadata: payload.requester.metadata ?? null,
            })
            .returning()
            .then((rows) => rows[0]);
        }

        let issue: RawIssue;
        let thread = existingThread;
        let createdIssue = false;
        let reopened = false;

        if (thread) {
          issue = await tx
            .select()
            .from(issues)
            .where(eq(issues.id, thread.issueId))
            .then((rows) => rows[0] ?? null as RawIssue | null);
          if (!issue) throw notFound("Issue not found for customer thread");

          if (!CUSTOMER_OPEN_ISSUE_STATUSES.has(issue.status)) {
            reopened = true;
            issue = await tx
              .update(issues)
              .set({
                status: "todo",
                assigneeAgentId: channel.triageAgentId ?? issue.assigneeAgentId ?? null,
                assigneeUserId: null,
                checkoutRunId: null,
                executionRunId: null,
                executionLockedAt: null,
                completedAt: null,
                cancelledAt: null,
                customerVisibleStatus: "received",
                customerResolutionSummary: null,
                deliveryBranch: null,
                deliveryCommitSha: null,
                deliveryPrUrl: null,
                updatedAt: new Date(),
              })
              .where(eq(issues.id, issue.id))
              .returning()
              .then((rows) => rows[0]!);
          }
        } else {
          createdIssue = true;
          const [company] = await tx
            .update(companies)
            .set({ issueCounter: sql`${companies.issueCounter} + 1` })
            .where(eq(companies.id, channel.companyId))
            .returning({ issueCounter: companies.issueCounter, issuePrefix: companies.issuePrefix });
          const issueNumber = company.issueCounter;
          const identifier = `${company.issuePrefix}-${issueNumber}`;
          const status = channel.triageAgentId ? "todo" : "backlog";
          issue = await tx
            .insert(issues)
            .values({
              companyId: channel.companyId,
              projectId: channel.defaultProjectId ?? null,
              goalId: null,
              parentId: null,
              title: buildIssueTitle(payload, requester),
              description: buildInitialIssueDescription(payload, requester, channel),
              status,
              priority: "medium",
              assigneeAgentId: channel.triageAgentId ?? null,
              assigneeUserId: null,
              createdByAgentId: null,
              createdByUserId: null,
              issueNumber,
              identifier,
              externalRequesterId: requester.id,
              sourceChannel: "whatsapp_webhook",
              customerVisibleStatus: "received",
              intakeKind: null,
              requestDepth: 0,
              billingCode: null,
            })
            .returning()
            .then((rows) => rows[0]);

          thread = await tx
            .insert(customerThreads)
            .values({
              companyId: channel.companyId,
              issueId: issue.id,
              inboundChannelId: channel.id,
              externalRequesterId: requester.id,
              sourceChannel: "whatsapp_webhook",
              externalThreadId: payload.externalThreadId,
              externalThreadName: payload.externalThreadName ?? null,
              lastInboundAt: now,
            })
            .returning()
            .then((rows) => rows[0]);
        }

        const commentBody = buildInboundCommentBody({
          requester,
          payload,
          importedMediaCount: mediaPreparation.uploads.length,
          failedMediaCount: mediaPreparation.warnings.length,
        });
        const [comment] = await tx
          .insert(issueComments)
          .values({
            companyId: channel.companyId,
            issueId: issue.id,
            authorAgentId: null,
            authorUserId: null,
            body: commentBody,
          })
          .returning();

        await tx
          .update(issues)
          .set({ updatedAt: new Date() })
          .where(eq(issues.id, issue.id));

        const [customerMessage] = await tx
          .insert(customerMessages)
          .values({
            companyId: channel.companyId,
            threadId: thread.id,
            issueId: issue.id,
            issueCommentId: comment.id,
            externalMessageId: payload.externalMessageId,
            direction: "inbound",
            senderRole: "customer",
            body: readNonEmptyString(payload.message.body),
            contentType: payload.message.contentType,
            deliveryStatus: "received",
            rawPayload: payload as Record<string, unknown>,
            receivedAt: now,
          })
          .returning();

        for (const upload of mediaPreparation.uploads) {
          const [asset] = await tx
            .insert(assets)
            .values({
              companyId: channel.companyId,
              provider: upload.stored.provider,
              objectKey: upload.stored.objectKey,
              contentType: upload.stored.contentType,
              byteSize: upload.stored.byteSize,
              sha256: upload.stored.sha256,
              originalFilename: upload.originalFilename,
              createdByAgentId: null,
              createdByUserId: null,
            })
            .returning();
          await tx
            .insert(issueAttachments)
            .values({
              companyId: channel.companyId,
              issueId: issue.id,
              issueCommentId: comment.id,
              assetId: asset.id,
            });
        }

        thread = await tx
          .update(customerThreads)
          .set({
            externalRequesterId: requester.id,
            externalThreadName: payload.externalThreadName ?? thread.externalThreadName ?? null,
            lastInboundAt: now,
            updatedAt: new Date(),
          })
          .where(eq(customerThreads.id, thread.id))
          .returning()
          .then((rows) => rows[0]!);

        await tx
          .update(inboundChannels)
          .set({ lastInboundAt: now, updatedAt: new Date() })
          .where(eq(inboundChannels.id, channel.id));

        return {
          issue,
          thread,
          requester,
          customerMessage,
          createdIssue,
          reopened,
        };
      });

      await logActivity(db, {
        companyId: channel.companyId,
        actorType: "system",
        actorId: "customer-intake",
        action: result.createdIssue ? "issue.created" : "issue.updated",
        entityType: "issue",
        entityId: result.issue.id,
        details: {
          sourceChannel: "whatsapp_webhook",
          externalRequesterId: result.requester.id,
          reopened: result.reopened,
        },
      });
      await logActivity(db, {
        companyId: channel.companyId,
        actorType: "system",
        actorId: "customer-intake",
        action: "issue.comment_added",
        entityType: "issue",
        entityId: result.issue.id,
        details: {
          customerMessageId: result.customerMessage.id,
          identifier: result.issue.identifier,
          sourceChannel: "whatsapp_webhook",
        },
      });
      await logActivity(db, {
        companyId: channel.companyId,
        actorType: "system",
        actorId: "customer-intake",
        action: "customer.message_received",
        entityType: "customer_message",
        entityId: result.customerMessage.id,
        details: {
          issueId: result.issue.id,
          warningCount: mediaPreparation.warnings.length,
        },
      });

      const ackMessage =
        result.createdIssue
          ? renderTemplate(channel.ackTemplate, {
            requester: toExternalRequester(result.requester),
            issue: result.issue,
            thread: result.thread,
            channel: toInboundChannel(channel),
          })
          : null;

      if (ackMessage) {
        await queueOutboundMessage({
          thread: result.thread,
          requester: result.requester,
          channel,
          issue: result.issue,
          body: ackMessage,
          reason: "ack",
        });
      }

      return {
        duplicate: false,
        issueId: result.issue.id,
        threadId: result.thread.id,
        ackMessage,
        wakeAgentId: result.issue.assigneeAgentId ?? channel.triageAgentId ?? null,
        warnings: mediaPreparation.warnings,
      };
    },

    async notifyIssueResolved(issueId: string) {
      const row = await getHydratedThreadByIssue(issueId);
      if (!row) return null;
      if (row.issue.status !== "done") {
        throw unprocessable("Issue must be done before sending customer resolution");
      }
      if (!readNonEmptyString(row.issue.customerResolutionSummary)) {
        throw unprocessable("Customer-facing issues require customerResolutionSummary before resolution");
      }

      const rendered = renderTemplate(row.channel.resolutionTemplate, {
        requester: toExternalRequester(row.requester),
        issue: row.issue,
        thread: row.thread,
        channel: toInboundChannel(row.channel),
      });
      await db
        .update(issues)
        .set({
          customerVisibleStatus: "resolved",
          updatedAt: new Date(),
        })
        .where(eq(issues.id, row.issue.id));

      const outbound = await queueOutboundMessage({
        thread: row.thread,
        requester: row.requester,
        channel: row.channel,
        issue: {
          ...row.issue,
          customerVisibleStatus: "resolved",
        },
        body: rendered,
        reason: "resolution",
      });

      return {
        messageId: outbound.message.id,
        deliveryError: outbound.deliveryError,
      };
    },
  };
}
