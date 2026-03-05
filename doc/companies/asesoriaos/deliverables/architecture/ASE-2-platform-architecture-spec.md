# ASE-2: Canonical Domain, Event, and Action Architecture (AsesoriaOS)

Date: 2026-03-05
Owner: CTO / Platform Architect
Source: Workspace snapshot
Scope: Spain-first fiscal/accounting workflows for autonomos and micro-SL with operator-supervised automation.

## 1) Architecture Principles

1. API-first contract shared by operator UI and agents.
2. Event-sourced auditability for every material decision and side effect.
3. Explicit action boundaries: no implicit regulated side effects.
4. Multi-tenant isolation by company as hard boundary.
5. Provider/runtime portability for AI and integrations.

## 2) System Boundaries

### 2.1 In-platform (authoritative)

- Tenant and identity graph (company, users, agents, memberships, permissions).
- Client and engagement graph (client entities, tax profile, obligations, periods).
- Evidence graph (documents, extracted fields, provenance, confidence, validation status).
- Accounting normalization graph (journal candidates, tax classification, reconciliation status).
- Workflow graph (tasks, checkpoints, approvals, actions, outcomes).
- Immutable audit/event log and replay engine.

### 2.2 Out-of-platform (integrated, not authoritative)

- AEAT/TGSS endpoints.
- Banking feeds and payment rails.
- Qualified e-signature providers.
- OCR/LLM providers.

Rule: external states are mirrored as snapshots + events; source-of-truth for process decisions remains internal.

## 3) Canonical Domain Model

All core records include: `id`, `company_id`, `created_at`, `updated_at`, `version`, `created_by`, `updated_by`.

### 3.1 Tenant + Access

- `Company`
- `Workspace` (operator surface, API surface config)
- `Principal` (`user` or `agent`)
- `Membership` (role + scoped permissions)
- `PolicyGrant` (fine-grained action permissions)

### 3.2 Client + Fiscal Scope

- `ClientAccount` (autonomo|sl, nif/cif, residency)
- `TaxProfile` (IVA regime, IRPF/IS regime, filing obligations)
- `Obligation` (model, cadence, due-date rules)
- `FilingPeriod` (quarter/month/year window + lifecycle)

### 3.3 Evidence + Accounting

- `EvidenceBundle` (set of source docs for one workflow decision)
- `Document` (binary + checksum + source channel)
- `Extraction` (field/value/provenance/confidence)
- `LedgerEntryCandidate` (normalized accounting intent)
- `TaxTreatmentDecision` (classification with rationale)

### 3.4 Workflow + Control

- `WorkflowRun` (process instance by client + period + obligation)
- `Checkpoint` (gated step requiring evidence or approval)
- `ActionRequest` (proposed side-effecting operation)
- `ApprovalRequest` (human governance gate)
- `ActionExecution` (result, receipt, external reference)

### 3.5 Audit

- `DomainEvent` (append-only, immutable)
- `DecisionRecord` (why a decision was made + evidence refs)
- `ReplayCursor` (deterministic rebuild checkpoints)

## 4) Event Model

Envelope (required for every event):

```json
{
  "event_id": "uuid",
  "event_type": "client.tax_profile.updated.v1",
  "company_id": "uuid",
  "aggregate_type": "tax_profile",
  "aggregate_id": "uuid",
  "aggregate_version": 7,
  "occurred_at": "2026-03-05T20:00:00Z",
  "actor": { "type": "user|agent|system", "id": "..." },
  "correlation_id": "uuid",
  "causation_id": "uuid|null",
  "payload": {},
  "evidence_refs": ["evb_..."],
  "schema_version": 1
}
```

### 4.1 Core event families

- Intake: `document.received`, `document.classified`, `extraction.produced`, `extraction.validated`.
- Accounting: `ledger_candidate.created`, `tax_treatment.proposed`, `tax_treatment.confirmed`.
- Workflow: `workflow.started`, `checkpoint.completed`, `workflow.blocked`, `workflow.completed`.
- Actions: `action.requested`, `action.approval_requested`, `action.approved|rejected`, `action.executed`, `action.failed`.
- Governance: `policy.changed`, `approval_policy.changed`, `retention_policy.changed`.

### 4.2 Replay guarantees

- Aggregate versions strictly monotonic per aggregate.
- Idempotency key required for command -> event emission.
- Side effects triggered only from approved `ActionRequest` state machine transitions.

## 5) Action Boundaries and Permissions

State machine for side effects:

`draft -> ready_for_review -> approved -> executing -> succeeded|failed|cancelled`

Rules:

- Regulated actions (`aeat.submit`, `tgss.submit`, `bank.transfer`, `esign.request`) require explicit approval.
- Approval policy evaluated from transparent rules, not opaque prompts.
- Every `ActionExecution` stores request snapshot, approver, external receipt, and reversible follow-up command when possible.

## 6) API Design (Human + Agent Shared)

Versioning: `/v1` + semantic event versioning in `event_type` suffix.

### 6.1 Command endpoints (side-effecting)

- `POST /v1/action-requests`
- `POST /v1/action-requests/{id}/submit-for-approval`
- `POST /v1/approvals/{id}/decide`
- `POST /v1/action-executions/{id}/retry`

All command responses return:

- `resource`
- `emitted_events[]`
- `audit_ref`

### 6.2 Query endpoints (read models)

- `GET /v1/clients/{id}/timeline`
- `GET /v1/workflows/{id}`
- `GET /v1/evidence-bundles/{id}`
- `GET /v1/action-requests/{id}`
- `GET /v1/audit/events?aggregate_id=...`

### 6.3 Agent tool contract surface

- `evidence.search`
- `workflow.inspect`
- `action.request.create`
- `approval.request.create`
- `audit.explain`

Tool contract pattern:

```json
{
  "tool": "action.request.create",
  "input_schema": {"client_id":"uuid","action_type":"string","parameters":{},"idempotency_key":"string"},
  "output_schema": {"action_request_id":"uuid","status":"draft|ready_for_review", "audit_ref":"string"},
  "requires_permissions": ["actions:create"],
  "requires_human_approval": true
}
```

## 7) Multi-tenant Isolation and Security Assumptions

- Row-level isolation by `company_id` on all tenant data.
- Tenant-scoped encryption keys for sensitive artifacts.
- Secrets (AEAT certs, bank tokens) stored in managed secret vault with per-action access grants.
- Default deny for agent permissions; explicit grants per tool/action family.
- Immutable audit trail with tamper-evident hash chaining for regulated workflows.

## 8) Build Sequence (Dependencies + Risks)

### Phase 1: Contract foundation (P0)

- Deliverables:
  - Canonical schemas for domain entities + event envelope.
  - Command/query API skeleton with idempotency and audit refs.
  - ActionRequest state machine and approval gates.
- Dependencies:
  - Permission model baseline.
  - Event store + projection framework.
- Risks:
  - Over-modeling before validating top 3 workflows.

### Phase 2: Accounting + evidence pipelines (P1)

- Deliverables:
  - Document ingestion, extraction provenance, evidence bundles.
  - Ledger candidate + tax treatment decision workflow.
- Dependencies:
  - Provider abstraction for OCR/LLM.
- Risks:
  - Confidence calibration drift across document types.

### Phase 3: Regulated action connectors in sandbox (P1)

- Deliverables:
  - AEAT/TGSS/bank/esign connector interfaces + mock adapters.
  - Explicit side-effect execution service with receipts.
- Dependencies:
  - Board-approved action policies.
- Risks:
  - Hidden provider coupling in adapter implementations.

### Phase 4: Operator inspection + replay (P2)

- Deliverables:
  - Timeline UI and agent-readable explain endpoint.
  - Replay tooling for workflow reconstruction and diff.
- Dependencies:
  - Stable projection schemas.
- Risks:
  - Read model drift if projection rebuild strategy is weak.

## 9) Open Decisions Requiring Board Validation

- Exact approval policy matrix by obligation type and risk band.
- Retention duration per evidence class and legal basis.
- Production go-live criteria for real connector side effects.
- Legal wording boundaries for operator- and client-facing outputs.

## 10) Acceptance Criteria for ASE-2

- One canonical entity/event dictionary approved.
- At least one end-to-end workflow specified (`document -> treatment -> action request -> approval -> execution -> audit`).
- All side effects represented as explicit `ActionRequest` + `ActionExecution` records.
- Operator UI and agent API consume same resource contracts.
