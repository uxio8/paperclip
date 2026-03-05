import { describe, expect, it } from "vitest";
import type { InboundWhatsAppWebhook } from "@paperclipai/shared";
import {
  buildInboundCommentBody,
  buildInitialIssueDescription,
  buildIssueTitle,
  hashSecret,
  renderTemplate,
} from "../services/customer-intake.js";

const basePayload: InboundWhatsAppWebhook = {
  externalMessageId: "wamid.123",
  externalThreadId: "thread-123",
  externalThreadName: "Acme support",
  subject: null,
  requester: {
    displayName: "Acme Ops",
    phoneNumber: "+34123456789",
    email: "ops@acme.test",
    externalRef: "cust-1",
    metadata: null,
  },
  message: {
    body: "The export screen crashes when I click generate.",
    contentType: "text/plain",
    media: [],
  },
  metadata: null,
};

describe("customer intake helpers", () => {
  it("hashes webhook secrets deterministically", () => {
    expect(hashSecret("super-secret")).toHaveLength(64);
    expect(hashSecret("super-secret")).toBe(hashSecret("super-secret"));
    expect(hashSecret("super-secret")).not.toBe(hashSecret("another-secret"));
  });

  it("builds issue title from subject or body", () => {
    expect(
      buildIssueTitle(
        {
          ...basePayload,
          subject: "Export screen crash",
        },
        {
          displayName: "Acme Ops",
          phoneNumber: "+34123456789",
          email: "ops@acme.test",
        } as never,
      ),
    ).toBe("Export screen crash");

    expect(
      buildIssueTitle(basePayload, {
        displayName: "Acme Ops",
        phoneNumber: "+34123456789",
        email: "ops@acme.test",
      } as never),
    ).toContain("Acme Ops");
  });

  it("builds the initial issue description with requester metadata", () => {
    const description = buildInitialIssueDescription(
      basePayload,
      {
        displayName: "Acme Ops",
        phoneNumber: "+34123456789",
        email: "ops@acme.test",
      } as never,
      {
        name: "Support WhatsApp",
      } as never,
    );

    expect(description).toContain("External customer intake from Support WhatsApp.");
    expect(description).toContain("Requester: Acme Ops");
    expect(description).toContain("Phone: +34123456789");
    expect(description).toContain("The export screen crashes");
  });

  it("includes media import outcomes in the synthesized comment body", () => {
    const body = buildInboundCommentBody({
      requester: {
        displayName: "Acme Ops",
        phoneNumber: "+34123456789",
        email: "ops@acme.test",
      } as never,
      payload: basePayload,
      importedMediaCount: 2,
      failedMediaCount: 1,
    });

    expect(body).toContain("Customer message via WhatsApp");
    expect(body).toContain("Imported 2 attachments.");
    expect(body).toContain("1 attachment failed to import.");
  });

  it("renders outbound templates with issue and requester variables", () => {
    const rendered = renderTemplate(
      "Ticket {{issue.identifier}} fixed for {{requester.displayName}}. {{issue.customerResolutionSummary}} {{issue.deliveryPrUrl}}",
      {
        requester: {
          id: "req-1",
          companyId: "company-1",
          displayName: "Acme Ops",
          phoneNumber: "+34123456789",
          email: "ops@acme.test",
          externalRef: "cust-1",
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        issue: {
          id: "issue-1",
          identifier: "PAP-101",
          title: "Export screen crash",
          customerResolutionSummary: "We fixed the null-state in export generation.",
          deliveryPrUrl: "https://github.com/acme/repo/pull/42",
        } as never,
        thread: {
          id: "thread-1",
          externalThreadId: "thread-123",
        } as never,
        channel: {
          id: "channel-1",
          companyId: "company-1",
          name: "Support WhatsApp",
          type: "whatsapp_webhook",
          status: "active",
          defaultProjectId: null,
          triageAgentId: null,
          ackTemplate: "",
          resolutionTemplate: "",
          outboundWebhookUrl: null,
          metadata: null,
          lastInboundAt: null,
          hasWebhookSecret: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );

    expect(rendered).toContain("PAP-101");
    expect(rendered).toContain("Acme Ops");
    expect(rendered).toContain("We fixed the null-state");
    expect(rendered).toContain("pull/42");
  });
});
