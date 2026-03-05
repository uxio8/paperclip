import { z } from "zod";
import {
  CUSTOMER_MESSAGE_DELIVERY_STATUSES,
  CUSTOMER_VISIBLE_STATUSES,
  INBOUND_CHANNEL_STATUSES,
  INBOUND_CHANNEL_TYPES,
} from "../constants.js";

const recordSchema = z.record(z.unknown());

export const createInboundChannelSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(INBOUND_CHANNEL_TYPES).optional().default("whatsapp_webhook"),
  status: z.enum(INBOUND_CHANNEL_STATUSES).optional().default("active"),
  defaultProjectId: z.string().uuid().optional().nullable(),
  triageAgentId: z.string().uuid().optional().nullable(),
  webhookSecret: z.string().min(8).max(256),
  ackTemplate: z.string().trim().min(1).max(2000),
  resolutionTemplate: z.string().trim().min(1).max(4000),
  outboundWebhookUrl: z.string().url().optional().nullable(),
  metadata: recordSchema.optional().nullable(),
});

export type CreateInboundChannel = z.infer<typeof createInboundChannelSchema>;

export const updateInboundChannelSchema = createInboundChannelSchema.partial().extend({
  webhookSecret: z.string().min(8).max(256).optional(),
});

export type UpdateInboundChannel = z.infer<typeof updateInboundChannelSchema>;

export const inboundMediaSchema = z
  .object({
    externalMediaId: z.string().trim().min(1).max(200).optional().nullable(),
    filename: z.string().trim().min(1).max(255).optional().nullable(),
    contentType: z.string().trim().min(1).max(255),
    caption: z.string().trim().min(1).max(4000).optional().nullable(),
    base64Data: z.string().min(1).optional(),
    downloadUrl: z.string().url().optional(),
  })
  .refine((value) => Boolean(value.base64Data || value.downloadUrl), {
    message: "Media requires either base64Data or downloadUrl",
    path: ["base64Data"],
  });

export const inboundRequesterSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional().nullable(),
  phoneNumber: z.string().trim().min(1).max(64),
  email: z.string().email().optional().nullable(),
  externalRef: z.string().trim().min(1).max(120).optional().nullable(),
  metadata: recordSchema.optional().nullable(),
});

export const inboundWhatsAppWebhookSchema = z
  .object({
    externalMessageId: z.string().trim().min(1).max(200),
    externalThreadId: z.string().trim().min(1).max(200),
    externalThreadName: z.string().trim().min(1).max(200).optional().nullable(),
    receivedAt: z.string().datetime().optional(),
    subject: z.string().trim().min(1).max(200).optional().nullable(),
    requester: inboundRequesterSchema,
    message: z.object({
      body: z.string().max(10000).optional().default(""),
      contentType: z.string().trim().min(1).max(255).optional().default("text/plain"),
      media: z.array(inboundMediaSchema).optional().default([]),
    }),
    metadata: recordSchema.optional().nullable(),
  })
  .refine((value) => value.message.body.trim().length > 0 || value.message.media.length > 0, {
    message: "Webhook requires a body or at least one media item",
    path: ["message", "body"],
  });

export type InboundWhatsAppWebhook = z.infer<typeof inboundWhatsAppWebhookSchema>;

export const updateCustomerVisibleStatusSchema = z.object({
  customerVisibleStatus: z.enum(CUSTOMER_VISIBLE_STATUSES),
});

export type UpdateCustomerVisibleStatus = z.infer<typeof updateCustomerVisibleStatusSchema>;

export const customerMessageDeliveryStatusSchema = z.enum(CUSTOMER_MESSAGE_DELIVERY_STATUSES);
