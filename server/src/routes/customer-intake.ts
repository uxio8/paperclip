import { Router, type Request } from "express";
import type { Db } from "@paperclipai/db";
import {
  createInboundChannelSchema,
  inboundWhatsAppWebhookSchema,
  updateInboundChannelSchema,
} from "@paperclipai/shared";
import type { StorageService } from "../storage/types.js";
import { validate } from "../middleware/validate.js";
import { customerIntakeService, heartbeatService, logActivity, issueService } from "../services/index.js";
import { assertBoard, assertCompanyAccess } from "./authz.js";

function readPresentedSecret(req: Request): string | null {
  const headerSecret = req.header("x-paperclip-channel-secret");
  if (typeof headerSecret === "string" && headerSecret.trim().length > 0) return headerSecret.trim();
  const authHeader = req.header("authorization");
  if (typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice("bearer ".length).trim() || null;
  }
  return null;
}

export function customerIntakeRoutes(db: Db, storage: StorageService) {
  const router = Router();
  const svc = customerIntakeService(db, storage);
  const heartbeat = heartbeatService(db);
  const issuesSvc = issueService(db);

  router.get("/companies/:companyId/inbound-channels", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertBoard(req);
    assertCompanyAccess(req, companyId);
    const channels = await svc.listChannels(companyId);
    res.json(channels);
  });

  router.post("/companies/:companyId/inbound-channels", validate(createInboundChannelSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertBoard(req);
    assertCompanyAccess(req, companyId);
    const channel = await svc.createChannel(companyId, req.body);
    await logActivity(db, {
      companyId,
      actorType: "user",
      actorId: req.actor.userId ?? "board",
      action: "inbound_channel.created",
      entityType: "inbound_channel",
      entityId: channel.id,
      details: {
        type: channel.type,
        name: channel.name,
        triageAgentId: channel.triageAgentId,
      },
    });
    res.status(201).json(channel);
  });

  router.patch("/inbound-channels/:id", validate(updateInboundChannelSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getChannel(id);
    if (!existing) {
      res.status(404).json({ error: "Inbound channel not found" });
      return;
    }
    assertBoard(req);
    assertCompanyAccess(req, existing.companyId);
    const channel = await svc.updateChannel(id, req.body);
    if (!channel) {
      res.status(404).json({ error: "Inbound channel not found" });
      return;
    }
    await logActivity(db, {
      companyId: channel.companyId,
      actorType: "user",
      actorId: req.actor.userId ?? "board",
      action: "inbound_channel.updated",
      entityType: "inbound_channel",
      entityId: channel.id,
      details: {
        changedKeys: Object.keys(req.body).sort(),
      },
    });
    res.json(channel);
  });

  router.get("/issues/:id/customer-thread", async (req, res) => {
    const issueId = req.params.id as string;
    const issue = await issuesSvc.getById(issueId);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    assertCompanyAccess(req, issue.companyId);
    const thread = await svc.getThreadByIssue(issueId);
    res.json(thread);
  });

  router.get("/customer-threads/:id", async (req, res) => {
    const threadId = req.params.id as string;
    const thread = await svc.getThread(threadId);
    if (!thread) {
      res.status(404).json({ error: "Customer thread not found" });
      return;
    }
    assertCompanyAccess(req, thread.companyId);
    res.json(thread);
  });

  router.post("/inbound/whatsapp/:channelId", validate(inboundWhatsAppWebhookSchema), async (req, res) => {
    const channelId = req.params.channelId as string;
    await svc.assertWebhookAccess(channelId, readPresentedSecret(req));
    const result = await svc.ingestWhatsAppWebhook(channelId, req.body);

    if (result.wakeAgentId) {
      void heartbeat
        .wakeup(result.wakeAgentId, {
          source: "automation",
          triggerDetail: "system",
          reason: result.duplicate ? "customer_message_duplicate" : "customer_message_received",
          payload: { issueId: result.issueId, threadId: result.threadId },
          requestedByActorType: "system",
          requestedByActorId: "customer-intake",
          contextSnapshot: {
            issueId: result.issueId,
            taskId: result.issueId,
            customerThreadId: result.threadId,
            source: "customer.intake.whatsapp",
          },
        })
        .catch(() => undefined);
    }

    res.status(result.duplicate ? 200 : 202).json(result);
  });

  return router;
}
