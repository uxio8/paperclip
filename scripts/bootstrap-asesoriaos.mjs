#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_SEED_PATH = path.join(REPO_ROOT, "doc", "companies", "asesoriaos", "bootstrap.seed.json");
const DEFAULT_API_BASE = "http://localhost:3100";

function normalizeKey(value) {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized : null;
}

function printHelp() {
  console.log(`Usage: pnpm bootstrap:asesoriaos [options]

Bootstraps the AsesoriaOS Paperclip company from doc/companies/asesoriaos/bootstrap.seed.json.
It reuses the markdown already present in doc/companies/asesoriaos as the live instructions files
for the created agents.

Options:
  --api-base <url>         Paperclip API base URL (default: ${DEFAULT_API_BASE})
  --api-key <token>        Bearer token, if your deployment requires it
  --company-id <uuid>      Reuse an existing company by ID instead of auto-discovering by name
  --company-name <name>    Override the company name used for create/reuse
  --seed <path>            Path to the bootstrap seed JSON
  --workspace-root <path>  Absolute or relative root for agent/project workspaces
  --json                   Print final summary as JSON
  --help                   Show this help

Examples:
  pnpm bootstrap:asesoriaos
  pnpm bootstrap:asesoriaos --company-id <company-id>
  pnpm bootstrap:asesoriaos --workspace-root /absolute/path/to/asesoriaos/worktrees
`);
}

function parseArgs(argv) {
  const opts = {
    apiBase: process.env.PAPERCLIP_API_URL?.trim() || DEFAULT_API_BASE,
    apiKey: process.env.PAPERCLIP_API_KEY?.trim() || null,
    companyId: null,
    companyName: null,
    seedPath: DEFAULT_SEED_PATH,
    workspaceRoot: null,
    json: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      opts.help = true;
      continue;
    }
    if (arg === "--json") {
      opts.json = true;
      continue;
    }
    if (arg === "--api-base") {
      opts.apiBase = argv[++i];
      continue;
    }
    if (arg === "--api-key") {
      opts.apiKey = argv[++i];
      continue;
    }
    if (arg === "--company-id") {
      opts.companyId = argv[++i];
      continue;
    }
    if (arg === "--company-name") {
      opts.companyName = argv[++i];
      continue;
    }
    if (arg === "--seed") {
      opts.seedPath = argv[++i];
      continue;
    }
    if (arg === "--workspace-root") {
      opts.workspaceRoot = argv[++i];
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return opts;
}

class ApiClient {
  constructor(apiBase, apiKey) {
    this.apiBase = apiBase.replace(/\/+$/, "");
    this.apiKey = apiKey || null;
  }

  async request(method, route, body) {
    const url = `${this.apiBase}${route.startsWith("/") ? route : `/${route}`}`;
    const headers = { accept: "application/json" };
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;
    if (body !== undefined) headers["content-type"] = "application/json";

    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    const parsed = text.trim().length > 0 ? safeJsonParse(text) : null;
    if (!response.ok) {
      const message =
        parsed && typeof parsed === "object" && !Array.isArray(parsed) && typeof parsed.error === "string"
          ? parsed.error
          : `Request failed (${response.status}) for ${route}`;
      const err = new Error(message);
      err.status = response.status;
      err.body = parsed;
      throw err;
    }
    return parsed;
  }

  get(route) {
    return this.request("GET", route);
  }

  post(route, body) {
    return this.request("POST", route, body);
  }

  patch(route, body) {
    return this.request("PATCH", route, body);
  }
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function log(message, opts) {
  if (!opts.json) {
    console.log(message);
  }
}

function resolveAbsolutePath(seedDir, value) {
  return path.isAbsolute(value) ? value : path.resolve(seedDir, value);
}

function applyAdapterDefaults(agentSeed, adapterConfig) {
  const next = { ...adapterConfig };
  if (agentSeed.adapterType === "codex_local") {
    const hasBypassFlag =
      typeof next.dangerouslyBypassApprovalsAndSandbox === "boolean" ||
      typeof next.dangerouslyBypassSandbox === "boolean";
    if (!hasBypassFlag) {
      next.dangerouslyBypassApprovalsAndSandbox = true;
    }
  }
  return next;
}

async function loadSeed(seedPath) {
  const raw = await readFile(seedPath, "utf8");
  return JSON.parse(raw);
}

async function resolveCompany(api, seed, opts) {
  if (opts.companyId) {
    const company = await api.get(`/api/companies/${opts.companyId}`);
    if (!company) throw new Error(`Company not found: ${opts.companyId}`);
    return { company, action: "reused_by_id" };
  }

  const desiredName = (opts.companyName || seed.company.name).trim();
  const companies = (await api.get("/api/companies")) ?? [];
  const existing = companies.find((company) => company.name.trim().toLowerCase() === desiredName.toLowerCase()) ?? null;
  if (existing) {
    return { company: existing, action: "reused_by_name" };
  }

  const created = await api.post("/api/companies", {
    name: desiredName,
    description: seed.company.description,
    budgetMonthlyCents: 0,
  });
  return { company: created, action: "created" };
}

async function upsertAgents(api, companyId, seed, seedDir, workspaceRoot, opts) {
  const existingAgents = (await api.get(`/api/companies/${companyId}/agents`)) ?? [];
  const existingBySlug = new Map(
    existingAgents
      .map((agent) => [normalizeKey(agent.name), agent])
      .filter(([slug]) => slug),
  );

  const agentIdsBySlug = new Map();
  const summary = { created: [], updated: [], reused: [] };

  for (const agentSeed of seed.agents) {
    const existing = existingBySlug.get(agentSeed.slug) ?? null;
    const adapterConfig = applyAdapterDefaults(agentSeed, {
      ...(agentSeed.adapterConfig ?? {}),
      cwd: path.resolve(workspaceRoot, "agents", agentSeed.slug),
      instructionsFilePath: resolveAbsolutePath(seedDir, agentSeed.instructionsPath),
    });
    const basePayload = {
      name: agentSeed.name,
      role: agentSeed.role,
      title: agentSeed.title,
      capabilities: agentSeed.capabilities,
      reportsTo: null,
      adapterType: agentSeed.adapterType,
      adapterConfig,
      runtimeConfig: agentSeed.runtimeConfig ?? {},
      budgetMonthlyCents: agentSeed.budgetMonthlyCents ?? 0,
    };

    let agent;
    if (existing) {
      agent = await api.patch(`/api/agents/${existing.id}`, basePayload);
      const existingCanCreate = Boolean(existing.permissions?.canCreateAgents);
      const desiredCanCreate = Boolean(agentSeed.permissions?.canCreateAgents);
      if (existingCanCreate !== desiredCanCreate) {
        await api.patch(`/api/agents/${existing.id}/permissions`, {
          canCreateAgents: desiredCanCreate,
        });
      }
      summary.updated.push(agent.name);
      log(`Updated agent ${agent.name}`, opts);
    } else {
      agent = await api.post(`/api/companies/${companyId}/agents`, {
        ...basePayload,
        permissions: agentSeed.permissions ?? {},
      });
      summary.created.push(agent.name);
      log(`Created agent ${agent.name}`, opts);
    }

    agentIdsBySlug.set(agentSeed.slug, agent.id);
  }

  for (const agentSeed of seed.agents) {
    const agentId = agentIdsBySlug.get(agentSeed.slug);
    if (!agentId || !agentSeed.reportsToSlug) continue;
    const managerId = agentIdsBySlug.get(agentSeed.reportsToSlug);
    if (!managerId || managerId === agentId) continue;
    await api.patch(`/api/agents/${agentId}`, { reportsTo: managerId });
  }

  return { agentIdsBySlug, summary };
}

async function upsertGoals(api, companyId, seed, agentIdsBySlug, opts) {
  const existingGoals = (await api.get(`/api/companies/${companyId}/goals`)) ?? [];
  const existingByTitle = new Map(existingGoals.map((goal) => [goal.title, goal]));
  const goalIdsByKey = new Map();
  const summary = { created: [], updated: [] };

  for (const goalSeed of seed.goals) {
    const existing = existingByTitle.get(goalSeed.title) ?? null;
    const payload = {
      title: goalSeed.title,
      description: goalSeed.description ?? null,
      level: goalSeed.level,
      status: goalSeed.status,
      parentId: goalSeed.parentKey ? goalIdsByKey.get(goalSeed.parentKey) ?? null : null,
      ownerAgentId: goalSeed.ownerAgentSlug ? agentIdsBySlug.get(goalSeed.ownerAgentSlug) ?? null : null,
    };

    let goal;
    if (existing) {
      goal = await api.patch(`/api/goals/${existing.id}`, payload);
      summary.updated.push(goal.title);
      log(`Updated goal ${goal.title}`, opts);
    } else {
      goal = await api.post(`/api/companies/${companyId}/goals`, payload);
      summary.created.push(goal.title);
      log(`Created goal ${goal.title}`, opts);
    }
    goalIdsByKey.set(goalSeed.key, goal.id);
  }

  return { goalIdsByKey, summary };
}

function resolveWorkspaceCwd(workspaceRoot, workspaceSeed) {
  return path.resolve(workspaceRoot, workspaceSeed.cwdRelative ?? workspaceSeed.name);
}

async function ensureProjectWorkspace(api, projectId, project, workspaceSeed, workspaceRoot, opts) {
  const desiredCwd = resolveWorkspaceCwd(workspaceRoot, workspaceSeed);
  const workspaces = Array.isArray(project.workspaces)
    ? project.workspaces
    : (await api.get(`/api/projects/${projectId}/workspaces`)) ?? [];
  const existing = workspaces.find((workspace) =>
    workspace.name === workspaceSeed.name ||
    workspace.cwd === desiredCwd,
  ) ?? null;

  if (existing) {
    await api.patch(`/api/projects/${projectId}/workspaces/${existing.id}`, {
      name: workspaceSeed.name,
      cwd: desiredCwd,
      isPrimary: Boolean(workspaceSeed.isPrimary),
    });
    log(`Updated workspace ${workspaceSeed.name} for project ${project.name}`, opts);
    return;
  }

  await api.post(`/api/projects/${projectId}/workspaces`, {
    name: workspaceSeed.name,
    cwd: desiredCwd,
    isPrimary: Boolean(workspaceSeed.isPrimary),
  });
  log(`Created workspace ${workspaceSeed.name} for project ${project.name}`, opts);
}

async function upsertProjects(api, companyId, seed, agentIdsBySlug, goalIdsByKey, seedDir, workspaceRoot, opts) {
  const existingProjects = (await api.get(`/api/companies/${companyId}/projects`)) ?? [];
  const existingByName = new Map(existingProjects.map((project) => [project.name, project]));
  const projectIdsByKey = new Map();
  const summary = { created: [], updated: [] };

  for (const projectSeed of seed.projects) {
    const existing = existingByName.get(projectSeed.name) ?? null;
    const goalIds = Array.isArray(projectSeed.goalKeys)
      ? projectSeed.goalKeys.map((key) => goalIdsByKey.get(key)).filter(Boolean)
      : [];
    const payload = {
      name: projectSeed.name,
      description: projectSeed.description ?? null,
      status: projectSeed.status ?? "planned",
      color: projectSeed.color ?? null,
      leadAgentId: projectSeed.leadAgentSlug ? agentIdsBySlug.get(projectSeed.leadAgentSlug) ?? null : null,
      goalIds,
      workspace: projectSeed.workspace
        ? {
            name: projectSeed.workspace.name,
            cwd: resolveWorkspaceCwd(workspaceRoot, projectSeed.workspace),
            isPrimary: Boolean(projectSeed.workspace.isPrimary),
          }
        : undefined,
    };

    let project;
    if (existing) {
      project = await api.patch(`/api/projects/${existing.id}`, {
        name: payload.name,
        description: payload.description,
        status: payload.status,
        color: payload.color,
        leadAgentId: payload.leadAgentId,
        goalIds: payload.goalIds,
      });
      summary.updated.push(project.name);
      log(`Updated project ${project.name}`, opts);
      if (projectSeed.workspace) {
        await ensureProjectWorkspace(api, project.id, project, projectSeed.workspace, workspaceRoot, opts);
      }
    } else {
      project = await api.post(`/api/companies/${companyId}/projects`, payload);
      summary.created.push(project.name);
      log(`Created project ${project.name}`, opts);
    }
    projectIdsByKey.set(projectSeed.key, project.id);
  }

  return { projectIdsByKey, summary };
}

async function upsertLabels(api, companyId, seed, opts) {
  const existingLabels = (await api.get(`/api/companies/${companyId}/labels`)) ?? [];
  const labelIdsByName = new Map(existingLabels.map((label) => [label.name.toLowerCase(), label.id]));
  const summary = { created: [], reused: [] };

  for (const labelSeed of seed.labels) {
    const existingId = labelIdsByName.get(labelSeed.name.toLowerCase()) ?? null;
    if (existingId) {
      summary.reused.push(labelSeed.name);
      continue;
    }
    const created = await api.post(`/api/companies/${companyId}/labels`, labelSeed);
    labelIdsByName.set(created.name.toLowerCase(), created.id);
    summary.created.push(created.name);
    log(`Created label ${created.name}`, opts);
  }

  return { labelIdsByName, summary };
}

async function seedIssues(api, companyId, seed, projectIdsByKey, goalIdsByKey, agentIdsBySlug, labelIdsByName, opts) {
  const existingIssues = (await api.get(`/api/companies/${companyId}/issues`)) ?? [];
  const existingByProjectAndTitle = new Map();
  for (const issue of existingIssues) {
    const key = `${issue.projectId ?? "none"}::${issue.title}`;
    existingByProjectAndTitle.set(key, issue);
  }

  const issueIdsByKey = new Map();
  const summary = { created: [], reused: [] };

  for (const issueSeed of seed.issues) {
    const projectId = issueSeed.projectKey ? projectIdsByKey.get(issueSeed.projectKey) ?? null : null;
    const existing = existingByProjectAndTitle.get(`${projectId ?? "none"}::${issueSeed.title}`) ?? null;
    if (existing) {
      issueIdsByKey.set(issueSeed.key, existing.id);
      summary.reused.push(existing.title);
      continue;
    }

    const payload = {
      projectId,
      goalId: issueSeed.goalKey ? goalIdsByKey.get(issueSeed.goalKey) ?? null : null,
      title: issueSeed.title,
      description: issueSeed.description ?? null,
      status: issueSeed.status ?? "backlog",
      priority: issueSeed.priority ?? "medium",
      assigneeAgentId: issueSeed.assigneeSlug ? agentIdsBySlug.get(issueSeed.assigneeSlug) ?? null : null,
      billingCode: issueSeed.billingCode ?? null,
      labelIds: Array.isArray(issueSeed.labels)
        ? issueSeed.labels
            .map((name) => labelIdsByName.get(name.toLowerCase()) ?? null)
            .filter(Boolean)
        : undefined,
    };

    const created = await api.post(`/api/companies/${companyId}/issues`, payload);
    issueIdsByKey.set(issueSeed.key, created.id);
    summary.created.push(created.title);
    log(`Created issue ${created.identifier ?? created.title}`, opts);
  }

  return { issueIdsByKey, summary };
}

async function ensureApproval(api, companyId, seed, agentIdsBySlug, issueIdsByKey, opts) {
  if (!seed.approval) return { created: false, approvalId: null };
  const approvals = (await api.get(`/api/companies/${companyId}/approvals`)) ?? [];
  const existing = approvals.find((approval) =>
    approval.type === seed.approval.type &&
    approval.payload &&
    typeof approval.payload === "object" &&
    approval.payload.templateId === seed.approval.templateId,
  ) ?? null;
  if (existing) {
    log(`Reused approval ${existing.id}`, opts);
    return { created: false, approvalId: existing.id };
  }

  const created = await api.post(`/api/companies/${companyId}/approvals`, {
    type: seed.approval.type,
    requestedByAgentId: seed.approval.requestedByAgentSlug
      ? agentIdsBySlug.get(seed.approval.requestedByAgentSlug) ?? null
      : null,
    issueIds: seed.approval.linkIssueKey
      ? [issueIdsByKey.get(seed.approval.linkIssueKey)].filter(Boolean)
      : undefined,
    payload: seed.approval.payload,
  });
  log(`Created approval ${created.id}`, opts);
  return { created: true, approvalId: created.id };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  const seedPath = path.resolve(opts.seedPath);
  const seedDir = path.dirname(seedPath);
  const seed = await loadSeed(seedPath);
  const workspaceRoot = path.resolve(
    opts.workspaceRoot || path.join(seedDir, seed.workspaceRootRelative || "worktrees"),
  );
  const api = new ApiClient(opts.apiBase, opts.apiKey);

  const { company, action: companyAction } = await resolveCompany(api, seed, opts);
  log(`Using company ${company.name} (${company.id}) via ${companyAction}`, opts);

  const desiredCompanyName = opts.companyName || seed.company.name;
  await api.patch(`/api/companies/${company.id}`, {
    name: desiredCompanyName,
    description: seed.company.description,
    brandColor: seed.company.brandColor ?? null,
    requireBoardApprovalForNewAgents: seed.company.requireBoardApprovalForNewAgents,
  });
  await api.patch(`/api/companies/${company.id}/budgets`, {
    budgetMonthlyCents: seed.company.budgetMonthlyCents,
  });

  const { agentIdsBySlug, summary: agentSummary } = await upsertAgents(
    api,
    company.id,
    seed,
    seedDir,
    workspaceRoot,
    opts,
  );
  const { goalIdsByKey, summary: goalSummary } = await upsertGoals(
    api,
    company.id,
    seed,
    agentIdsBySlug,
    opts,
  );
  const { projectIdsByKey, summary: projectSummary } = await upsertProjects(
    api,
    company.id,
    seed,
    agentIdsBySlug,
    goalIdsByKey,
    seedDir,
    workspaceRoot,
    opts,
  );
  const { labelIdsByName, summary: labelSummary } = await upsertLabels(api, company.id, seed, opts);
  const { issueIdsByKey, summary: issueSummary } = await seedIssues(
    api,
    company.id,
    seed,
    projectIdsByKey,
    goalIdsByKey,
    agentIdsBySlug,
    labelIdsByName,
    opts,
  );
  const approval = await ensureApproval(
    api,
    company.id,
    seed,
    agentIdsBySlug,
    issueIdsByKey,
    opts,
  );

  const summary = {
    company: {
      id: company.id,
      name: desiredCompanyName,
      action: companyAction,
      workspaceRoot,
      seedPath,
    },
    agents: agentSummary,
    goals: goalSummary,
    projects: projectSummary,
    labels: labelSummary,
    issues: issueSummary,
    approval,
  };

  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log("");
  console.log("Bootstrap summary");
  console.log(`- company: ${summary.company.name} (${summary.company.id})`);
  console.log(`- workspace root: ${summary.company.workspaceRoot}`);
  console.log(`- agents created: ${summary.agents.created.length}, updated: ${summary.agents.updated.length}`);
  console.log(`- goals created: ${summary.goals.created.length}, updated: ${summary.goals.updated.length}`);
  console.log(`- projects created: ${summary.projects.created.length}, updated: ${summary.projects.updated.length}`);
  console.log(`- labels created: ${summary.labels.created.length}, reused: ${summary.labels.reused.length}`);
  console.log(`- issues created: ${summary.issues.created.length}, reused: ${summary.issues.reused.length}`);
  console.log(`- approval created: ${summary.approval.created ? "yes" : "no"}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
