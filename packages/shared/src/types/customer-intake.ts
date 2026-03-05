import type {
  CustomerMessageDeliveryStatus,
  CustomerMessageDirection,
  CustomerVisibleStatus,
  InboundChannelStatus,
  InboundChannelType,
} from "../constants.js";
import type { IssueAttachment } from "./issue.js";

export interface InboundChannel {
  id: string;
  companyId: string;
  name: string;
  type: InboundChannelType;
  status: InboundChannelStatus;
  defaultProjectId: string | null;
  triageAgentId: string | null;
  ackTemplate: string;
  resolutionTemplate: string;
  outboundWebhookUrl: string | null;
  metadata: Record<string, unknown> | null;
  lastInboundAt: Date | null;
  hasWebhookSecret: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExternalRequester {
  id: string;
  companyId: string;
  displayName: string | null;
  phoneNumber: string | null;
  email: string | null;
  externalRef: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerMessage {
  id: string;
  companyId: string;
  threadId: string;
  issueId: string;
  issueCommentId: string | null;
  externalMessageId: string | null;
  direction: CustomerMessageDirection;
  senderRole: string;
  body: string | null;
  contentType: string;
  deliveryStatus: CustomerMessageDeliveryStatus;
  rawPayload: Record<string, unknown> | null;
  sentAt: Date | null;
  receivedAt: Date | null;
  attachments?: IssueAttachment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerThread {
  id: string;
  companyId: string;
  issueId: string;
  inboundChannelId: string;
  externalRequesterId: string;
  sourceChannel: InboundChannelType;
  externalThreadId: string;
  externalThreadName: string | null;
  lastInboundAt: Date | null;
  lastOutboundAt: Date | null;
  customerVisibleStatus?: CustomerVisibleStatus | null;
  requester?: ExternalRequester | null;
  channel?: InboundChannel | null;
  messages?: CustomerMessage[];
  createdAt: Date;
  updatedAt: Date;
}
