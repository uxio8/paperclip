import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { companiesApi } from "../api/companies";
import { accessApi } from "../api/access";
import { agentsApi } from "../api/agents";
import { customerIntakeApi } from "../api/customerIntake";
import { projectsApi } from "../api/projects";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { CompanyPatternIcon } from "../components/CompanyPatternIcon";
import { Field, ToggleField, HintIcon } from "../components/agent-config-primitives";
import type { CreateInboundChannel, InboundChannel, UpdateInboundChannel } from "@paperclipai/shared";

const DEFAULT_ACK_TEMPLATE =
  "We have received your request as {{issue.identifier}}. We will review it and follow up with an update.";
const DEFAULT_RESOLUTION_TEMPLATE =
  "Your request {{issue.identifier}} has been resolved. Summary: {{issue.customerResolutionSummary}} {{issue.deliveryPrUrl}}";

type InboundChannelDraft = {
  name: string;
  status: InboundChannel["status"];
  defaultProjectId: string;
  triageAgentId: string;
  webhookSecret: string;
  ackTemplate: string;
  resolutionTemplate: string;
  outboundWebhookUrl: string;
};

function toChannelDraft(channel: InboundChannel): InboundChannelDraft {
  return {
    name: channel.name,
    status: channel.status,
    defaultProjectId: channel.defaultProjectId ?? "",
    triageAgentId: channel.triageAgentId ?? "",
    webhookSecret: "",
    ackTemplate: channel.ackTemplate,
    resolutionTemplate: channel.resolutionTemplate,
    outboundWebhookUrl: channel.outboundWebhookUrl ?? "",
  };
}

function emptyInboundChannel(): CreateInboundChannel {
  return {
    name: "",
    type: "whatsapp_webhook",
    status: "active",
    defaultProjectId: null,
    triageAgentId: null,
    webhookSecret: "",
    ackTemplate: DEFAULT_ACK_TEMPLATE,
    resolutionTemplate: DEFAULT_RESOLUTION_TEMPLATE,
    outboundWebhookUrl: null,
    metadata: null,
  };
}

function channelTypeLabel(value: string) {
  return value.replace(/_/g, " ");
}

export function CompanySettings() {
  const { companies, selectedCompany, selectedCompanyId, setSelectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  // General settings local state
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [brandColor, setBrandColor] = useState("");
  const [newChannel, setNewChannel] = useState<CreateInboundChannel>(() => emptyInboundChannel());
  const [channelDrafts, setChannelDrafts] = useState<Record<string, InboundChannelDraft>>({});

  // Sync local state from selected company
  useEffect(() => {
    if (!selectedCompany) return;
    setCompanyName(selectedCompany.name);
    setDescription(selectedCompany.description ?? "");
    setBrandColor(selectedCompany.brandColor ?? "");
  }, [selectedCompany]);

  useEffect(() => {
    setNewChannel(emptyInboundChannel());
    setChannelDrafts({});
  }, [selectedCompanyId]);

  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const { data: inboundChannels = [] } = useQuery({
    queryKey: queryKeys.customerIntake.channels(selectedCompanyId!),
    queryFn: () => customerIntakeApi.listChannels(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: projects = [] } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    setChannelDrafts((current) => {
      const next: Record<string, InboundChannelDraft> = {};
      for (const channel of inboundChannels) {
        next[channel.id] = current[channel.id] ?? toChannelDraft(channel);
      }
      return next;
    });
  }, [inboundChannels]);

  const generalDirty =
    !!selectedCompany &&
    (companyName !== selectedCompany.name ||
      description !== (selectedCompany.description ?? "") ||
      brandColor !== (selectedCompany.brandColor ?? ""));

  const generalMutation = useMutation({
    mutationFn: (data: { name: string; description: string | null; brandColor: string | null }) =>
      companiesApi.update(selectedCompanyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    },
  });

  const settingsMutation = useMutation({
    mutationFn: (requireApproval: boolean) =>
      companiesApi.update(selectedCompanyId!, {
        requireBoardApprovalForNewAgents: requireApproval,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      accessApi.createCompanyInvite(selectedCompanyId!, {
        allowedJoinTypes: "both",
        expiresInHours: 72,
      }),
    onSuccess: (invite) => {
      setInviteError(null);
      const base = window.location.origin.replace(/\/+$/, "");
      const absoluteUrl = invite.inviteUrl.startsWith("http")
        ? invite.inviteUrl
        : `${base}${invite.inviteUrl}`;
      setInviteLink(absoluteUrl);
      queryClient.invalidateQueries({ queryKey: queryKeys.sidebarBadges(selectedCompanyId!) });
    },
    onError: (err) => {
      setInviteError(err instanceof Error ? err.message : "Failed to create invite");
    },
  });
  const archiveMutation = useMutation({
    mutationFn: ({
      companyId,
      nextCompanyId,
    }: {
      companyId: string;
      nextCompanyId: string | null;
    }) => companiesApi.archive(companyId).then(() => ({ nextCompanyId })),
    onSuccess: async ({ nextCompanyId }) => {
      if (nextCompanyId) {
        setSelectedCompanyId(nextCompanyId);
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies.stats });
    },
  });

  const createInboundChannel = useMutation({
    mutationFn: (data: CreateInboundChannel) => customerIntakeApi.createChannel(selectedCompanyId!, data),
    onSuccess: async () => {
      setNewChannel(emptyInboundChannel());
      await queryClient.invalidateQueries({
        queryKey: queryKeys.customerIntake.channels(selectedCompanyId!),
      });
    },
  });

  const updateInboundChannel = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInboundChannel }) =>
      customerIntakeApi.updateChannel(id, data),
    onSuccess: async (channel) => {
      setChannelDrafts((current) => ({
        ...current,
        [channel.id]: toChannelDraft(channel),
      }));
      await queryClient.invalidateQueries({
        queryKey: queryKeys.customerIntake.channels(channel.companyId),
      });
    },
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company", href: "/dashboard" },
      { label: "Settings" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  if (!selectedCompany) {
    return (
      <div className="text-sm text-muted-foreground">
        No company selected. Select a company from the switcher above.
      </div>
    );
  }

  function handleSaveGeneral() {
    generalMutation.mutate({
      name: companyName.trim(),
      description: description.trim() || null,
      brandColor: brandColor || null,
    });
  }

  function patchDraft(id: string, patch: Partial<InboundChannelDraft>) {
    setChannelDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? {
          name: "",
          status: "active",
          defaultProjectId: "",
          triageAgentId: "",
          webhookSecret: "",
          ackTemplate: DEFAULT_ACK_TEMPLATE,
          resolutionTemplate: DEFAULT_RESOLUTION_TEMPLATE,
          outboundWebhookUrl: "",
        }),
        ...patch,
      },
    }));
  }

  function saveChannel(id: string) {
    const draft = channelDrafts[id];
    if (!draft) return;
    const payload: UpdateInboundChannel = {
      name: draft.name.trim(),
      status: draft.status,
      defaultProjectId: draft.defaultProjectId || null,
      triageAgentId: draft.triageAgentId || null,
      ackTemplate: draft.ackTemplate.trim(),
      resolutionTemplate: draft.resolutionTemplate.trim(),
      outboundWebhookUrl: draft.outboundWebhookUrl.trim() || null,
    };
    if (draft.webhookSecret.trim()) {
      payload.webhookSecret = draft.webhookSecret.trim();
    }
    updateInboundChannel.mutate({ id, data: payload });
  }

  function createChannel() {
    createInboundChannel.mutate({
      ...newChannel,
      name: newChannel.name.trim(),
      defaultProjectId: newChannel.defaultProjectId || null,
      triageAgentId: newChannel.triageAgentId || null,
      webhookSecret: newChannel.webhookSecret.trim(),
      ackTemplate: newChannel.ackTemplate.trim(),
      resolutionTemplate: newChannel.resolutionTemplate.trim(),
      outboundWebhookUrl: newChannel.outboundWebhookUrl?.trim() || null,
      metadata: null,
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Company Settings</h1>
      </div>

      {/* General */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          General
        </div>
        <div className="space-y-3 rounded-md border border-border px-4 py-4">
          <Field label="Company name" hint="The display name for your company.">
            <input
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </Field>
          <Field label="Description" hint="Optional description shown in the company profile.">
            <input
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              type="text"
              value={description}
              placeholder="Optional company description"
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>
      </div>

      {/* Appearance */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Appearance
        </div>
        <div className="space-y-3 rounded-md border border-border px-4 py-4">
          <div className="flex items-start gap-4">
            <div className="shrink-0">
              <CompanyPatternIcon
                companyName={companyName || selectedCompany.name}
                brandColor={brandColor || null}
                className="rounded-[14px]"
              />
            </div>
            <div className="flex-1 space-y-2">
              <Field label="Brand color" hint="Sets the hue for the company icon. Leave empty for auto-generated color.">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandColor || "#6366f1"}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent p-0"
                  />
                  <input
                    type="text"
                    value={brandColor}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^#[0-9a-fA-F]{0,6}$/.test(v)) {
                        setBrandColor(v);
                      }
                    }}
                    placeholder="Auto"
                    className="w-28 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm font-mono outline-none"
                  />
                  {brandColor && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setBrandColor("")}
                      className="text-xs text-muted-foreground"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </Field>
            </div>
          </div>
        </div>
      </div>

      {/* Save button for General + Appearance */}
      {generalDirty && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSaveGeneral}
            disabled={generalMutation.isPending || !companyName.trim()}
          >
            {generalMutation.isPending ? "Saving..." : "Save changes"}
          </Button>
          {generalMutation.isSuccess && (
            <span className="text-xs text-muted-foreground">Saved</span>
          )}
          {generalMutation.isError && (
            <span className="text-xs text-destructive">
              {generalMutation.error instanceof Error
                ? generalMutation.error.message
                : "Failed to save"}
            </span>
          )}
        </div>
      )}

      {/* Hiring */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Hiring
        </div>
        <div className="rounded-md border border-border px-4 py-3">
          <ToggleField
            label="Require board approval for new hires"
            hint="New agent hires stay pending until approved by board."
            checked={!!selectedCompany.requireBoardApprovalForNewAgents}
            onChange={(v) => settingsMutation.mutate(v)}
          />
        </div>
      </div>

      {/* Invites */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Invites
        </div>
        <div className="space-y-3 rounded-md border border-border px-4 py-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Generate a link to invite humans or agents to this company.</span>
            <HintIcon text="Invite links expire after 72 hours and allow both human and agent joins." />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => inviteMutation.mutate()} disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? "Creating..." : "Create invite link"}
            </Button>
            {inviteLink && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(inviteLink);
                }}
              >
                Copy link
              </Button>
            )}
          </div>
          {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
          {inviteLink && (
            <div className="rounded-md border border-border bg-muted/30 p-2">
              <div className="text-xs text-muted-foreground">Share link</div>
              <div className="mt-1 break-all font-mono text-xs">{inviteLink}</div>
            </div>
          )}
        </div>
      </div>

      {/* Archive */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-amber-700 uppercase tracking-wide">
          Archive
        </div>
        <div className="space-y-3 rounded-md border border-amber-300/60 bg-amber-100/30 px-4 py-4">
          <p className="text-sm text-muted-foreground">
            Archive this company to hide it from the sidebar. This persists in the database.
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={archiveMutation.isPending || selectedCompany.status === "archived"}
              onClick={() => {
                if (!selectedCompanyId) return;
                const confirmed = window.confirm(
                  `Archive company "${selectedCompany.name}"? It will be hidden from the sidebar.`,
                );
                if (!confirmed) return;
                const nextCompanyId = companies.find((company) =>
                  company.id !== selectedCompanyId && company.status !== "archived")?.id ?? null;
                archiveMutation.mutate({ companyId: selectedCompanyId, nextCompanyId });
              }}
            >
              {archiveMutation.isPending
                ? "Archiving..."
                : selectedCompany.status === "archived"
                  ? "Already archived"
                  : "Archive company"}
            </Button>
            {archiveMutation.isError && (
              <span className="text-xs text-destructive">
                {archiveMutation.error instanceof Error
                  ? archiveMutation.error.message
                  : "Failed to archive company"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Customer Intake
        </div>
        <div className="space-y-4 rounded-md border border-border px-4 py-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              Configure inbound customer channels and the triage agent that will receive new WhatsApp requests.
            </span>
            <HintIcon text="The webhook endpoint is public, but every request must present the configured secret." />
          </div>

          <div className="rounded-md border border-dashed border-border p-4 space-y-3">
            <div className="text-sm font-medium">New inbound channel</div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Name" hint="Internal name shown in Paperclip.">
                <input
                  className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                  type="text"
                  value={newChannel.name}
                  onChange={(e) => setNewChannel((current) => ({ ...current, name: e.target.value }))}
                  placeholder="Support WhatsApp"
                />
              </Field>
              <Field label="Type" hint="V1 ships with a normalized WhatsApp webhook adapter.">
                <input
                  className="w-full rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-sm text-muted-foreground outline-none"
                  type="text"
                  value={channelTypeLabel(newChannel.type)}
                  disabled
                />
              </Field>
              <Field label="Status">
                <select
                  className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                  value={newChannel.status}
                  onChange={(e) =>
                    setNewChannel((current) => ({
                      ...current,
                      status: e.target.value as InboundChannel["status"],
                    }))
                  }
                >
                  <option value="active">active</option>
                  <option value="paused">paused</option>
                  <option value="archived">archived</option>
                </select>
              </Field>
              <Field label="Webhook secret" hint="Clients must send this secret in the webhook request.">
                <input
                  className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                  type="password"
                  value={newChannel.webhookSecret}
                  onChange={(e) => setNewChannel((current) => ({ ...current, webhookSecret: e.target.value }))}
                  placeholder="At least 8 characters"
                />
              </Field>
              <Field label="Default project">
                <select
                  className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                  value={newChannel.defaultProjectId ?? ""}
                  onChange={(e) =>
                    setNewChannel((current) => ({
                      ...current,
                      defaultProjectId: e.target.value || null,
                    }))
                  }
                >
                  <option value="">None</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Triage agent" hint="New and reopened threads wake this agent first.">
                <select
                  className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                  value={newChannel.triageAgentId ?? ""}
                  onChange={(e) =>
                    setNewChannel((current) => ({
                      ...current,
                      triageAgentId: e.target.value || null,
                    }))
                  }
                >
                  <option value="">None</option>
                  {agents
                    .filter((agent) => agent.status !== "terminated")
                    .map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Outbound webhook URL" hint="Optional URL that receives ack and resolution messages.">
                <input
                  className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                  type="url"
                  value={newChannel.outboundWebhookUrl ?? ""}
                  onChange={(e) =>
                    setNewChannel((current) => ({
                      ...current,
                      outboundWebhookUrl: e.target.value || null,
                    }))
                  }
                  placeholder="https://..."
                />
              </Field>
            </div>
            <Field label="Ack template" hint="Variables: {{issue.identifier}}, {{issue.title}}, {{channel.name}}.">
              <textarea
                className="min-h-24 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                value={newChannel.ackTemplate}
                onChange={(e) => setNewChannel((current) => ({ ...current, ackTemplate: e.target.value }))}
              />
            </Field>
            <Field label="Resolution template" hint="Also supports {{issue.customerResolutionSummary}} and {{issue.deliveryPrUrl}}.">
              <textarea
                className="min-h-28 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                value={newChannel.resolutionTemplate}
                onChange={(e) => setNewChannel((current) => ({ ...current, resolutionTemplate: e.target.value }))}
              />
            </Field>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={createChannel}
                disabled={
                  createInboundChannel.isPending ||
                  !newChannel.name.trim() ||
                  !newChannel.webhookSecret.trim() ||
                  !newChannel.ackTemplate.trim() ||
                  !newChannel.resolutionTemplate.trim()
                }
              >
                {createInboundChannel.isPending ? "Creating..." : "Create channel"}
              </Button>
              {createInboundChannel.isError && (
                <span className="text-xs text-destructive">
                  {createInboundChannel.error instanceof Error
                    ? createInboundChannel.error.message
                    : "Failed to create inbound channel"}
                </span>
              )}
            </div>
          </div>

          {inboundChannels.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No inbound channels configured yet.
            </p>
          ) : (
            <div className="space-y-3">
              {inboundChannels.map((channel) => {
                const draft = channelDrafts[channel.id] ?? toChannelDraft(channel);
                return (
                  <div key={channel.id} className="rounded-md border border-border px-4 py-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-medium">{channel.name}</div>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                        {channelTypeLabel(channel.type)}
                      </span>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                        {channel.status}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        Last inbound {channel.lastInboundAt ? new Date(channel.lastInboundAt).toLocaleString() : "never"}
                      </span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="Name">
                        <input
                          className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                          type="text"
                          value={draft.name}
                          onChange={(e) => patchDraft(channel.id, { name: e.target.value })}
                        />
                      </Field>
                      <Field label="Status">
                        <select
                          className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                          value={draft.status}
                          onChange={(e) =>
                            patchDraft(channel.id, { status: e.target.value as InboundChannel["status"] })
                          }
                        >
                          <option value="active">active</option>
                          <option value="paused">paused</option>
                          <option value="archived">archived</option>
                        </select>
                      </Field>
                      <Field label="Default project">
                        <select
                          className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                          value={draft.defaultProjectId}
                          onChange={(e) => patchDraft(channel.id, { defaultProjectId: e.target.value })}
                        >
                          <option value="">None</option>
                          {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Triage agent">
                        <select
                          className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                          value={draft.triageAgentId}
                          onChange={(e) => patchDraft(channel.id, { triageAgentId: e.target.value })}
                        >
                          <option value="">None</option>
                          {agents
                            .filter((agent) => agent.status !== "terminated")
                            .map((agent) => (
                              <option key={agent.id} value={agent.id}>
                                {agent.name}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <Field label="Rotate webhook secret" hint="Leave empty to keep the current secret.">
                        <input
                          className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                          type="password"
                          value={draft.webhookSecret}
                          onChange={(e) => patchDraft(channel.id, { webhookSecret: e.target.value })}
                          placeholder={channel.hasWebhookSecret ? "Secret configured" : "Set a secret"}
                        />
                      </Field>
                      <Field label="Outbound webhook URL">
                        <input
                          className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                          type="url"
                          value={draft.outboundWebhookUrl}
                          onChange={(e) => patchDraft(channel.id, { outboundWebhookUrl: e.target.value })}
                          placeholder="https://..."
                        />
                      </Field>
                    </div>
                    <Field label="Ack template">
                      <textarea
                        className="min-h-24 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                        value={draft.ackTemplate}
                        onChange={(e) => patchDraft(channel.id, { ackTemplate: e.target.value })}
                      />
                    </Field>
                    <Field label="Resolution template">
                      <textarea
                        className="min-h-28 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                        value={draft.resolutionTemplate}
                        onChange={(e) => patchDraft(channel.id, { resolutionTemplate: e.target.value })}
                      />
                    </Field>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => saveChannel(channel.id)}
                        disabled={
                          updateInboundChannel.isPending ||
                          !draft.name.trim() ||
                          !draft.ackTemplate.trim() ||
                          !draft.resolutionTemplate.trim()
                        }
                      >
                        {updateInboundChannel.isPending ? "Saving..." : "Save channel"}
                      </Button>
                      {updateInboundChannel.isError && (
                        <span className="text-xs text-destructive">
                          {updateInboundChannel.error instanceof Error
                            ? updateInboundChannel.error.message
                            : "Failed to save inbound channel"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
