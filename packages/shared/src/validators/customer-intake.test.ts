import { describe, expect, it } from "vitest";
import { createInboundChannelSchema, inboundWhatsAppWebhookSchema } from "./customer-intake.js";

describe("customer intake validators", () => {
  it("accepts a valid inbound channel configuration", () => {
    const parsed = createInboundChannelSchema.parse({
      name: "Support WhatsApp",
      webhookSecret: "super-secret",
      ackTemplate: "Ack {{issue.identifier}}",
      resolutionTemplate: "Resolved {{issue.customerResolutionSummary}}",
    });

    expect(parsed.type).toBe("whatsapp_webhook");
    expect(parsed.status).toBe("active");
  });

  it("rejects an inbound channel with a short webhook secret", () => {
    expect(() =>
      createInboundChannelSchema.parse({
        name: "Support WhatsApp",
        webhookSecret: "short",
        ackTemplate: "Ack {{issue.identifier}}",
        resolutionTemplate: "Resolved {{issue.customerResolutionSummary}}",
      }),
    ).toThrow();
  });

  it("accepts a text-only WhatsApp webhook payload", () => {
    const parsed = inboundWhatsAppWebhookSchema.parse({
      externalMessageId: "wamid.123",
      externalThreadId: "thread-123",
      requester: {
        displayName: "Acme Ops",
        phoneNumber: "+34123456789",
      },
      message: {
        body: "The export screen crashes.",
      },
    });

    expect(parsed.message.contentType).toBe("text/plain");
    expect(parsed.message.media).toEqual([]);
  });

  it("accepts a media-only WhatsApp webhook payload", () => {
    const parsed = inboundWhatsAppWebhookSchema.parse({
      externalMessageId: "wamid.456",
      externalThreadId: "thread-456",
      requester: {
        displayName: "Acme Ops",
        phoneNumber: "+34123456789",
      },
      message: {
        body: "",
        media: [
          {
            externalMediaId: "media-1",
            contentType: "image/png",
            downloadUrl: "https://example.com/image.png",
          },
        ],
      },
    });

    expect(parsed.message.media).toHaveLength(1);
  });

  it("rejects a webhook payload without text or media", () => {
    expect(() =>
      inboundWhatsAppWebhookSchema.parse({
        externalMessageId: "wamid.789",
        externalThreadId: "thread-789",
        requester: {
          displayName: "Acme Ops",
          phoneNumber: "+34123456789",
        },
        message: {
          body: "   ",
          media: [],
        },
      }),
    ).toThrow();
  });

  it("rejects media entries without downloadable content", () => {
    expect(() =>
      inboundWhatsAppWebhookSchema.parse({
        externalMessageId: "wamid.987",
        externalThreadId: "thread-987",
        requester: {
          displayName: "Acme Ops",
          phoneNumber: "+34123456789",
        },
        message: {
          body: "",
          media: [
            {
              externalMediaId: "media-1",
              contentType: "image/png",
            },
          ],
        },
      }),
    ).toThrow();
  });
});
