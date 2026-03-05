# Customer Intake

Paperclip V1 can receive customer issues from an external WhatsApp integration and route them into the existing issue/agent workflow.

This is a control-plane integration:

- Paperclip does not talk directly to Meta Cloud API in V1
- your backend or provider receives the real WhatsApp event
- that backend normalizes the payload and forwards it to Paperclip

## Supported V1 Flow

1. Customer sends a WhatsApp message
2. Your backend verifies provider signatures and normalizes the message
3. Your backend calls `POST /api/inbound/whatsapp/:channelId`
4. Paperclip creates or updates:
   - `external_requester`
   - `customer_thread`
   - `issue`
   - `issue_comment`
   - optional attachments/assets
5. Paperclip wakes the triage agent or assigned agent
6. The engineering agent works in the project workspace, records `branch + commit + PR`, and moves the issue to `in_review`
7. A human reviews/merges and then moves the issue to `done`
8. Paperclip emits the customer resolution message

## Production Rules

- Customers are modeled as `external_requesters`, not as members of a company
- New customer tickets enter with `customerVisibleStatus = received`
- Duplicate inbound messages are deduplicated by `externalMessageId`
- A follow-up message on a closed ticket reopens it to `todo` and routes it back to triage
- Customer-facing issues cannot move to `done` without `customerResolutionSummary`
- Delivery metadata may only be recorded when the issue is being moved to `in_review` or is already in `in_review`
- Delivery metadata requires a project whose `primaryWorkspace.cwd` is set
- V1 only sends two automatic customer messages:
  - ack on ticket creation
  - resolution on issue close

## Required Setup

## 1. Create agents

At minimum create:

- one triage agent
- one engineering agent

## 2. Create a project workspace

The project that agents will modify must have a primary workspace with:

- `cwd`: absolute local path on the Paperclip host
- `repoUrl`: canonical repo URL
- `repoRef`: default branch or ref

Without `primaryWorkspace.cwd`, delivery metadata and repo-driven execution are blocked.

## 3. Configure an inbound channel

Use the company settings UI or the internal API:

- `GET /api/companies/:companyId/inbound-channels`
- `POST /api/companies/:companyId/inbound-channels`
- `PATCH /api/inbound-channels/:id`

Channel fields:

- `type = whatsapp_webhook`
- `webhookSecret`
- `defaultProjectId`
- `triageAgentId`
- `ackTemplate`
- `resolutionTemplate`
- optional `outboundWebhookUrl`

`outboundWebhookUrl` is where Paperclip sends the generated ack/resolution payloads if you want your backend/provider to deliver them back to the customer.

## Inbound Webhook Contract

Endpoint:

```http
POST /api/inbound/whatsapp/:channelId
```

Authentication:

- `x-paperclip-channel-secret: <secret>`
- or `Authorization: Bearer <secret>`

Minimum payload:

```json
{
  "externalMessageId": "wamid.123",
  "externalThreadId": "chat-456",
  "requester": {
    "phoneNumber": "+34123456789"
  },
  "message": {
    "body": "The export screen crashes when I click generate."
  }
}
```

Full normalized payload example:

```json
{
  "externalMessageId": "wamid.123",
  "externalThreadId": "chat-456",
  "externalThreadName": "Acme support",
  "receivedAt": "2026-03-06T10:30:00.000Z",
  "subject": null,
  "requester": {
    "displayName": "Acme Ops",
    "phoneNumber": "+34123456789",
    "email": "ops@acme.test",
    "externalRef": "cust-1",
    "metadata": {
      "plan": "pro"
    }
  },
  "message": {
    "body": "The export screen crashes when I click generate.",
    "contentType": "text/plain",
    "media": [
      {
        "externalMediaId": "media-1",
        "filename": "screenshot.png",
        "contentType": "image/png",
        "downloadUrl": "https://provider.example.com/files/media-1"
      }
    ]
  },
  "metadata": {
    "provider": "your-backend"
  }
}
```

Rules:

- `message.body` or at least one `message.media[]` item is required
- media items must include either `base64Data` or `downloadUrl`
- `requester.phoneNumber` is required in V1

## Outbound Webhook Contract

If `outboundWebhookUrl` is configured, Paperclip POSTs generated customer messages there.

Example payload:

```json
{
  "channelId": "channel-uuid",
  "type": "whatsapp_webhook",
  "reason": "ack",
  "requester": {
    "id": "requester-uuid",
    "displayName": "Acme Ops",
    "phoneNumber": "+34123456789"
  },
  "issue": {
    "id": "issue-uuid",
    "identifier": "PAP-101",
    "title": "Export screen crash",
    "customerResolutionSummary": null,
    "deliveryPrUrl": null
  },
  "thread": {
    "id": "thread-uuid",
    "externalThreadId": "chat-456"
  },
  "message": {
    "id": "message-uuid",
    "body": "We have received your request as PAP-101. We will review it and follow up with an update."
  }
}
```

`reason` can be:

- `ack`
- `resolution`

If your outbound endpoint fails, Paperclip stores the outbound customer message with `deliveryStatus = failed`. The issue history is preserved.

## Recommended Backend Responsibilities

Your backend/provider integration should do the following before forwarding to Paperclip:

- verify the original WhatsApp provider signature
- map provider-specific message IDs into `externalMessageId`
- map the conversation ID into `externalThreadId`
- normalize sender identity into `requester`
- either download media and send `base64Data` or pass a stable `downloadUrl`
- forward the channel secret to Paperclip
- receive Paperclip outbound webhook calls and send the actual WhatsApp message back to the customer

## Operational Checklist

- channel secret configured
- triage agent configured
- project has primary workspace cwd
- engineering agent can access `git` and `gh`
- outbound webhook URL reachable if customer replies should be delivered
- issue close flow includes `customerResolutionSummary`

## API Surface

Internal APIs:

- `GET /api/companies/:companyId/inbound-channels`
- `POST /api/companies/:companyId/inbound-channels`
- `PATCH /api/inbound-channels/:id`
- `GET /api/issues/:id/customer-thread`
- `GET /api/customer-threads/:id`

Public webhook:

- `POST /api/inbound/whatsapp/:channelId`
