# AsesoriaOS Paperclip Bootstrap Template

This document turns the existing AsesoriaOS charter, agent profiles, and deliverables into a concrete Paperclip V1 company template.

Use it when you want Paperclip to run a small, auditable AI software factory that builds:

- a Spain-first advisory workflow app
- with a non-technical operator UI
- and an agent-native API/action surface
- under explicit budget and approval control

Automation:

- `doc/companies/asesoriaos/bootstrap.seed.json` contains the bootstrap data model used by the seed script
- `pnpm bootstrap:asesoriaos` applies that seed against a running Paperclip instance
- by default the script reuses the existing `doc/companies/asesoriaos` markdown files as the agents' `instructionsFilePath`
- by default the script places agent and project workspaces under `doc/companies/asesoriaos/worktrees`

## 1. Company Record

Recommended Paperclip company:

- `name`: `AsesoriaOS`
- expected issue prefix: `ASE` if no prefix conflict exists
- `description`: `AI-native operating system for Spanish advisory firms, starting with fiscal and accounting workflows for autonomos and micro-SL companies.`
- `budgetMonthlyCents`: `70000`
- `requireBoardApprovalForNewAgents`: `true`

Root company goal:

> Deliver by June 3, 2026 a Spain-only MVP for advisory firms that automates document intake, accounting normalization, and VAT-support workflows for autonomos and micro-SL companies, with human review, end-to-end auditability, and a dual UI plus agent-native interface.

Operating note:

- Paperclip V1 budgets are integer `cents` without a currency field. For this template, treat `70000` as `EUR 700.00` by operating convention.

## 2. Bootstrap Team

Start with 6 agents. That keeps the org visible and minimizes workspace collisions while still covering product, domain, safety, and execution.

### Phase 1 agents

| Name | Paperclip role | Title | Reports to | Budget | Adapter | Model | Instructions file |
|---|---|---|---|---:|---|---|---|
| `Alicia Founder` | `ceo` | CEO / Founder | root | `12000` | `codex_local` | `gpt-5.4` | `doc/companies/asesoriaos/agents/ceo-founder.md` |
| `Bruno Platform` | `cto` | CTO / Platform Architect | CEO | `18000` | `codex_local` | `gpt-5.4` | `doc/companies/asesoriaos/agents/cto-platform-architect.md` |
| `Clara Product` | `pm` | Product & UX Lead | CEO | `9000` | `codex_local` | `gpt-5.4` | `doc/companies/asesoriaos/agents/product-ux-lead.md` |
| `Diego Fiscal` | `researcher` | Fiscal Domain Lead | CEO | `10000` | `codex_local` | `gpt-5.4` | `doc/companies/asesoriaos/agents/fiscal-domain-lead.md` |
| `Elena Workflow` | `engineer` | AI Workflow Engineer | CTO | `15000` | `codex_local` | `gpt-5.4` | `doc/companies/asesoriaos/agents/ai-workflow-engineer.md` |
| `Fabio Audit` | `qa` | QA & Audit Lead | CTO | `6000` | `codex_local` | `gpt-5.4` | `doc/companies/asesoriaos/agents/qa-audit-lead.md` |

Budget total:

- `70000` cents

### Phase 2 hires

Add these only after the phase 1 team is stable:

- `Chief Compliance & Risk` using `doc/companies/asesoriaos/agents/chief-compliance-risk.md`
- `Integrations Engineer` using `doc/companies/asesoriaos/agents/integrations-engineer.md`
- `Customer Discovery & Partnerships` using `doc/companies/asesoriaos/agents/customer-discovery-partnerships.md`

Policy:

- create the phase 1 agents directly as board-created agents
- create all phase 2 agents through `POST /api/companies/:companyId/agent-hires`
- keep `requireBoardApprovalForNewAgents=true` so every later hire produces a `hire_agent` approval

## 3. Agent Runtime Defaults

Recommended shared baseline for phase 1 agents:

```json
{
  "adapterType": "codex_local",
  "adapterConfig": {
    "model": "gpt-5.4",
    "cwd": "/ABS/PATH/asesoriaos/worktrees/<agent-slug>",
    "instructionsFilePath": "/ABS/PATH/paperclip/doc/companies/asesoriaos/agents/<agent-file>.md",
    "dangerouslyBypassApprovalsAndSandbox": true,
    "timeoutSec": 1800,
    "graceSec": 30,
    "search": true
  },
  "runtimeConfig": {
    "heartbeat": {
      "enabled": true,
      "intervalSec": 1800,
      "wakeOnDemand": true,
      "cooldownSec": 10,
      "maxConcurrentRuns": 1
    }
  }
}
```

Overrides:

- CEO: `intervalSec=3600`
- QA: keep `model=gpt-5.4` unless you run Codex via API key and have validated another model for your account type
- Local Codex agents in this template should keep `dangerouslyBypassApprovalsAndSandbox=true` so they can reach the local Paperclip API and their worktrees
- any agent working on sensitive docs: keep secrets in company secrets, not inline env

Important constraint:

- give each coding agent its own absolute `cwd`
- do not point multiple autonomous code agents at the same checkout
- use one worktree per active coding agent

## 4. Projects and Workspaces

Paperclip resolves project workspaces for issues by default, so create one primary workspace per project and keep one lead per project in phase 1.

Recommended target repo shape:

- `apps/web` for operator and client UI
- `apps/api` for API, auth, workflows, and audit
- `packages/domain-fiscal` for Spanish fiscal/accounting rules
- `packages/agent-tools` for typed action contracts and orchestration
- `packages/integrations-mocks` for AEAT/TGSS/bank/signature mock adapters
- `qa/golden-datasets` for fixtures and replay cases

Recommended Paperclip projects:

| Project | Lead | Primary workspace cwd | Purpose |
|---|---|---|---|
| `operating-plan` | CEO | `/ABS/PATH/asesoriaos/worktrees/operating-plan` | strategy, staffing, sequencing, approval packages |
| `platform-core` | CTO | `/ABS/PATH/asesoriaos/worktrees/platform-core` | API, tenancy, workflow state, audit model |
| `operator-experience` | Product | `/ABS/PATH/asesoriaos/worktrees/operator-experience` | non-technical operator UI and client-facing flows |
| `fiscal-domain-model` | Fiscal | `/ABS/PATH/asesoriaos/worktrees/fiscal-domain-model` | accounting normalization, VAT logic, exception rules |
| `agent-action-layer` | AI Workflow | `/ABS/PATH/asesoriaos/worktrees/agent-action-layer` | typed tools, dry-run, approvals, explainability |
| `quality-audit` | QA | `/ABS/PATH/asesoriaos/worktrees/quality-audit` | golden datasets, release gates, audit bundles |

Add these phase 2 projects only when the related hire exists:

- `compliance-controls`
- `integration-sandbox`
- `pilot-discovery`

## 5. Goal Stack

Create this goal hierarchy:

1. Company goal
   - deliver the June 3, 2026 MVP described above
2. Team goal: Platform
   - define the canonical API, workflow, and audit model
3. Team goal: Operator UX
   - make every automation understandable to a non-technical advisory operator
4. Team goal: Fiscal domain
   - specify correct accounting and VAT-support workflows for autonomos and micro-SL
5. Team goal: Agent action layer
   - expose typed, dry-run-first actions for AI-native operation
6. Team goal: Quality and evidence
   - require evidence bundles and replayable audit trails for risky flows

## 6. Seed Labels

Create these labels before opening the backlog:

- `phase:p0`
- `phase:p1`
- `surface:web`
- `surface:api`
- `surface:agent`
- `domain:fiscal`
- `domain:audit`
- `domain:compliance`
- `risk:regulated`
- `artifact:spec`
- `artifact:implementation`
- `state:board-review`

## 7. Seed Backlog

Open these issues in this order. Every issue should link to a project and, when relevant, to a team goal.

### P0 control and planning

1. `Approve 90-day operating plan and budget split`
   - project: `operating-plan`
   - assignee: CEO
   - priority: `critical`
   - output: strategy memo, budget split, planned hires, board risks
   - approval: create `approve_ceo_strategy`

2. `Define canonical platform architecture for AsesoriaOS`
   - project: `platform-core`
   - assignee: CTO
   - priority: `critical`
   - output: entity, event, action, and audit model
   - maps to existing deliverable: `ASE-2`

3. `Define fiscal operating model for autonomos and micro-SL`
   - project: `fiscal-domain-model`
   - assignee: Fiscal
   - priority: `critical`
   - output: workflow map, exceptions, review points

4. `Specify typed agent action layer with dry-run semantics`
   - project: `agent-action-layer`
   - assignee: AI Workflow
   - priority: `critical`
   - output: read/simulate/propose/commit contract set
   - maps to existing deliverable: `ASE-6`

5. `Define QA baseline, golden datasets, and evidence bundle standard`
   - project: `quality-audit`
   - assignee: QA
   - priority: `critical`
   - output: release gates, test corpus, audit checklist
   - maps to existing deliverable: `ASE-15`

### P0 product definition

6. `Specify operator workspace and human-review cockpit v1`
   - project: `operator-experience`
   - assignee: Product
   - priority: `high`
   - output: IA, screen specs, review UX, error UX

7. `Specify client intake and document classification flow`
   - project: `operator-experience`
   - assignee: Product
   - priority: `high`
   - output: upload, OCR review, evidence visibility, operator actions

8. `Define MVP data contracts for clients, obligations, evidence bundles, workflow runs`
   - project: `platform-core`
   - assignee: CTO
   - priority: `high`
   - output: contract set shared by UI and agents

9. `Define VAT-support workflow for quarterly and monthly periods`
   - project: `fiscal-domain-model`
   - assignee: Fiscal
   - priority: `high`
   - output: obligations, checkpoints, exception catalog

10. `Prototype explainable action requests and approval UX`
   - project: `agent-action-layer`
   - assignee: AI Workflow
   - priority: `high`
   - output: approval payloads, diff views, refusal behavior

### Phase 2 queued items

11. `Define regulatory control matrix for fiscal-impacting logic`
   - project: `compliance-controls`
   - assignee: future Chief Compliance & Risk
   - priority: `critical`
   - blocked until hire exists

12. `Define AEAT/TGSS/banking/signature mock-first integration matrix`
   - project: `integration-sandbox`
   - assignee: future Integrations Engineer
   - priority: `high`
   - blocked until hire exists
   - maps to existing deliverable: `ASE-7`

13. `Prepare pilot ICP and interview package for Spanish advisory firms`
   - project: `pilot-discovery`
   - assignee: future Customer Discovery & Partnerships
   - priority: `medium`
   - blocked until hire exists
   - maps to existing deliverable: `ASE-9`

## 8. Approval Operating Model

Use the approval types Paperclip V1 already supports:

- `approve_ceo_strategy`
  - use for the initial 90-day plan, budget envelope, roadmap phases, and phase-2 hiring plan
- `hire_agent`
  - use for every post-bootstrap hire

Because V1 does not yet support generalized approval types, use this workaround for regulated product decisions:

- create a dedicated issue
- attach supporting docs and comments
- label it `state:board-review`
- if needed, link it to the CEO strategy approval package

Use board review before:

- any logic change that affects fiscal outcomes
- any live AEAT, TGSS, banking, or signature side effect
- privacy, retention, or security policy changes
- pricing and launch claims

## 9. Bootstrap Sequence in Paperclip

Recommended setup order:

1. Create company via `/api/companies`
2. Patch company settings via `/api/companies/:companyId`
   - set `description`
   - set `requireBoardApprovalForNewAgents=true`
3. Set company budget via `/api/companies/:companyId/budgets`
4. Create root company goal via `/api/companies/:companyId/goals`
5. Create the 6 phase-1 projects via `/api/companies/:companyId/projects`
6. Create the 6 phase-1 agents via `/api/companies/:companyId/agents`
7. File the CEO approval request via `/api/companies/:companyId/approvals`
8. Create the 10 phase-1 issues via `/api/companies/:companyId/issues`
9. Wake the CEO manually once the approval is in place
10. Wake specialists only after they have issues assigned or checked out

Recommended first approval payload shape:

```json
{
  "companyGoal": "Deliver June 3, 2026 MVP for Spanish advisory firms",
  "window": {
    "from": "2026-03-05",
    "to": "2026-06-03"
  },
  "budgetMonthlyCents": 70000,
  "phase1Agents": [
    "CEO / Founder",
    "CTO / Platform Architect",
    "Product & UX Lead",
    "Fiscal Domain Lead",
    "AI Workflow Engineer",
    "QA & Audit Lead"
  ],
  "phase2Hires": [
    "Chief Compliance & Risk",
    "Integrations Engineer",
    "Customer Discovery & Partnerships"
  ],
  "projects": [
    "operating-plan",
    "platform-core",
    "operator-experience",
    "fiscal-domain-model",
    "agent-action-layer",
    "quality-audit"
  ],
  "guardrails": [
    "Spain only",
    "Fiscal and accounting first",
    "Human review for regulated actions",
    "Mock-first external integrations"
  ]
}
```

## 10. Budget and Audit Rules

Enforce these operating rules from day 1:

- every substantive item of work must be an issue
- every issue must belong to a project
- every phase-1 issue should carry a billing code such as `ASE-MVP-P0`
- agents report or inherit cost data with issue, project, and goal context whenever possible
- investigate any agent paused by budget immediately instead of silently raising limits
- do not reopen a paused agent without a written board note

What you should monitor:

- company dashboard for `paused`, `error`, `pending approvals`, and `staleTasks`
- `/api/companies/:companyId/costs/by-agent` for burn concentration
- `/api/companies/:companyId/activity` for traceability
- `/api/issues/:id/runs` for execution history per issue

## 11. Known V1 Gaps

This template fits Paperclip V1, but it does not magically solve these gaps:

- approvals are still limited to `hire_agent` and `approve_ceo_strategy`
- budget records do not store currency metadata
- the current control plane does not yet include domain-native advisory entities such as `client_account`, `obligation`, or `evidence_bundle`
- auditability is operational and strong, but it is not legal or financial compliance certification
- live AEAT, TGSS, banking, and signature side effects should remain disabled until the control model is extended

## 12. Existing Repo Artifacts This Template Reuses

Charter:

- `doc/companies/asesoriaos/company-charter.md`

Agent instruction files:

- `doc/companies/asesoriaos/agents/ceo-founder.md`
- `doc/companies/asesoriaos/agents/cto-platform-architect.md`
- `doc/companies/asesoriaos/agents/product-ux-lead.md`
- `doc/companies/asesoriaos/agents/fiscal-domain-lead.md`
- `doc/companies/asesoriaos/agents/ai-workflow-engineer.md`
- `doc/companies/asesoriaos/agents/qa-audit-lead.md`
- `doc/companies/asesoriaos/agents/chief-compliance-risk.md`
- `doc/companies/asesoriaos/agents/integrations-engineer.md`
- `doc/companies/asesoriaos/agents/customer-discovery-partnerships.md`

Deliverable snapshots:

- `doc/companies/asesoriaos/deliverables/strategy/ASE-1-90-day-operating-plan.md`
- `doc/companies/asesoriaos/deliverables/architecture/ASE-2-platform-architecture-spec.md`
- `doc/companies/asesoriaos/deliverables/automation/ASE-6-typed-agent-action-layer.md`
- `doc/companies/asesoriaos/deliverables/integrations/ASE-7-external-integrations-spec.md`
- `doc/companies/asesoriaos/deliverables/discovery/ASE-9-customer-discovery-and-pilot-package.md`
- `doc/companies/asesoriaos/deliverables/quality/ASE-15-qa-audit-baseline.md`
