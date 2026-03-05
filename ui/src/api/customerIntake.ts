import type {
  CreateInboundChannel,
  CustomerThread,
  InboundChannel,
  UpdateInboundChannel,
} from "@paperclipai/shared";
import { api } from "./client";

export const customerIntakeApi = {
  listChannels: (companyId: string) =>
    api.get<InboundChannel[]>(`/companies/${companyId}/inbound-channels`),
  createChannel: (companyId: string, data: CreateInboundChannel) =>
    api.post<InboundChannel>(`/companies/${companyId}/inbound-channels`, data),
  updateChannel: (id: string, data: UpdateInboundChannel) =>
    api.patch<InboundChannel>(`/inbound-channels/${id}`, data),
  getThreadByIssue: (issueId: string) =>
    api.get<CustomerThread | null>(`/issues/${issueId}/customer-thread`),
  getThread: (threadId: string) =>
    api.get<CustomerThread>(`/customer-threads/${threadId}`),
};
