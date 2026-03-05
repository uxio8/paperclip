# ASE-24: Technical Release-Gate Workflow for FOLC Approvals

Date: 2026-03-05
Owner: CTO / Platform Architect
Source: Workspace snapshot
Depends on: ASE-2 canonical architecture, ASE-10 control matrix, ASE-22 FOLC rubric.

## 1) Purpose

Define an API-first, auditable, replayable release gate for Fiscal-Outcome Logic Changes (FOLC), with explicit sign-off states, blocked transitions, and traceability from logic change to evidence packet to approval decision to release.

## 2) Scope and Non-Goals

In scope:
- Classification-aware release workflow (`FOLC`, `non_FOLC`, `uncertain`).
- Required approval states and transition guards for FOLC.
- Data/event contracts linking code/config changes, evidence, and approvals.
- Agent/human API contracts for proposing and inspecting gates.

Out of scope:
- CI vendor specifics.
- Deployment infrastructure internals.
- Runtime-specific workflow engines.

## 3) Release Gate Model

### 3.1 Primary entities

All entities are tenant-scoped by `company_id`.

1. `ChangeSet`
- Represents a logical release unit (one or more commits/config migrations).
- Required fields: `id`, `company_id`, `title`, `description`, `source_refs[]`, `classification`, `classification_rationale`, `owner_principal_id`, `status`, `created_at`, `updated_at`.

2. `EvidencePacket`
- Immutable bundle of validation artifacts for a `ChangeSet`.
- Required fields: `id`, `company_id`, `change_set_id`, `artifact_refs[]`, `coverage_summary`, `determinism_result`, `traceability_samples[]`, `bypass_test_result`, `rollback_plan_ref`, `created_by`, `created_at`.

3. `ReleaseGate`
- State machine controlling whether a `ChangeSet` can be promoted.
- Required fields: `id`, `company_id`, `change_set_id`, `state`, `required_approvals[]`, `current_approvals[]`, `blocking_reasons[]`, `opened_at`, `closed_at`.

4. `ApprovalDecision`
- Signed decision record from required approvers.
- Required fields: `id`, `company_id`, `release_gate_id`, `approval_type`, `decision`, `decided_by`, `decided_at`, `comment`, `evidence_snapshot_hash`.

5. `ReleaseExecution`
- Explicit execution attempt after gate pass.
- Required fields: `id`, `company_id`, `change_set_id`, `release_gate_id`, `environment`, `status`, `executed_by`, `started_at`, `completed_at`, `receipt_ref`.

### 3.2 Classification binding

- `FOLC`: board + compliance approvals are mandatory.
- `non_FOLC`: standard engineering/product path.
- `uncertain`: hard block until reclassified.
- Rule: if any item in a bundle is `FOLC`, entire `ChangeSet` follows `FOLC` path unless split.

## 4) Gate States and Transitions

State machine:
`draft -> classified -> evidence_attached -> in_review -> approved -> releasable -> released`

Terminal failure states:
`blocked`, `rejected`, `cancelled`

### 4.1 Required sign-off states (FOLC)

A FOLC `ReleaseGate` cannot enter `approved` until all are present:
1. `compliance_signoff=approved`
2. `board_signoff=approved`
3. `engineering_owner_signoff=approved`

Optional advisory signoffs (do not unblock alone):
- `product_signoff`
- `security_signoff`

### 4.2 Blocked transitions

1. `draft -> in_review` blocked if classification missing.
2. `classified -> in_review` blocked when `classification=uncertain`.
3. `classified -> in_review` blocked for FOLC without `EvidencePacket`.
4. `in_review -> approved` blocked if any mandatory sign-off pending/rejected.
5. `approved -> releasable` blocked if evidence snapshot hash changed after approval.
6. `releasable -> released` blocked if release window policy or segregation-of-duties policy fails.
7. Any state -> `released` blocked for FOLC when board approval record is absent.

## 5) Event Contract (Audit + Replay)

All events use ASE-2 envelope and add `change_set_id` and `release_gate_id` in payload where applicable.

Required event types:
- `release.change_set.created.v1`
- `release.change_set.classified.v1`
- `release.evidence_packet.attached.v1`
- `release.gate.opened.v1`
- `release.gate.transition_blocked.v1`
- `release.approval.recorded.v1`
- `release.gate.approved.v1`
- `release.execution.requested.v1`
- `release.execution.completed.v1`
- `release.execution.failed.v1`

`release.gate.transition_blocked.v1` payload minimum:
```json
{
  "from_state": "in_review",
  "to_state": "approved",
  "reason_code": "MISSING_BOARD_SIGNOFF",
  "reason_detail": "Board approval not recorded",
  "required_action": "Create board approval decision",
  "change_set_id": "cs_...",
  "release_gate_id": "rg_..."
}
```

## 6) API Contract (Human + Agent Shared)

Version prefix: `/v1`.

### 6.1 Commands

1. `POST /v1/change-sets`
- Creates `ChangeSet` in `draft`.

2. `POST /v1/change-sets/{id}/classify`
- Input: `classification`, `checklist_answers`, `rationale`, `idempotency_key`.
- Emits: `release.change_set.classified.v1`.

3. `POST /v1/change-sets/{id}/evidence-packets`
- Attaches immutable evidence packet.
- Emits: `release.evidence_packet.attached.v1`.

4. `POST /v1/release-gates/{id}/request-review`
- Moves to `in_review` if guards pass.

5. `POST /v1/release-gates/{id}/approvals`
- Records one sign-off decision.
- Input: `approval_type`, `decision`, `comment`, `evidence_snapshot_hash`, `idempotency_key`.

6. `POST /v1/release-gates/{id}/mark-releasable`
- Validates all mandatory approvals and evidence integrity.

7. `POST /v1/releases`
- Executes release for `releasable` gate only.

### 6.2 Queries

- `GET /v1/change-sets/{id}`
- `GET /v1/change-sets/{id}/timeline`
- `GET /v1/release-gates/{id}`
- `GET /v1/release-gates/{id}/blocking-reasons`
- `GET /v1/evidence-packets/{id}`
- `GET /v1/audit/events?change_set_id=...`

### 6.3 Command response shape

```json
{
  "resource": {},
  "emitted_events": ["..."],
  "audit_ref": "audit_evt_..."
}
```

## 7) Tool/Action Contracts for Agents

1. `release.change_set.create`
- Input: `title`, `description`, `source_refs[]`, `classification_candidate`, `idempotency_key`.
- Permission: `release:write`.
- Side effects: none outside platform.

2. `release.gate.inspect`
- Input: `release_gate_id`.
- Output: current state, missing signoffs, blocking reasons, evidence hash.
- Permission: `release:read`.

3. `release.approval.record`
- Input: `release_gate_id`, `approval_type`, `decision`, `comment`, `evidence_snapshot_hash`, `idempotency_key`.
- Permission: `release:approve:<type>`.
- Human approval required for `board_signoff` and `compliance_signoff`.

4. `release.execute.request`
- Input: `change_set_id`, `release_gate_id`, `environment`, `idempotency_key`.
- Permission: `release:execute`.
- Guard: gate must be `releasable`.

## 8) Security and Multi-Tenant Guarantees

- All write/read operations enforce `company_id` row-level isolation.
- Approval permissions are explicit per approval type; default deny.
- `board_signoff` cannot be issued by the `ChangeSet` submitter (SoD).
- Evidence packet is immutable after review starts; changes require gate reset to `classified`.
- Audit chain includes hash of evidence snapshot used for each approval decision.

## 9) Traceability Links (Required)

For FOLC, operators and agents must be able to traverse in one query chain:

`ChangeSet -> Classification Record -> EvidencePacket -> ApprovalDecision(s) -> ReleaseExecution -> Outcome Events`

Minimum linked references:
- `change_set_id` in all gate/approval/release records.
- `evidence_packet_id` and `evidence_snapshot_hash` in approvals.
- `release_gate_id` in release execution and events.
- `correlation_id` shared across all release-gate events.

## 10) Operational Policies

1. `uncertain` classification enforces immediate `blocked` state.
2. FOLC evidence packet must include determinism, traceability samples, bypass test, rollback plan.
3. Any post-approval evidence mutation invalidates approvals.
4. Board-triggered policy gates are implemented as explicit rule checks, not prompt text.
5. Release notes for FOLC must include operator-facing "what changed" and review obligations.

## 11) Build Plan (Sequencing, Dependencies, Risks)

### Phase P0: Schema + state machine
- Deliver:
  - `ChangeSet`, `EvidencePacket`, `ReleaseGate`, `ApprovalDecision`, `ReleaseExecution` schemas.
  - Transition guard engine with machine-readable `reason_code`.
- Depends on:
  - Existing audit/event envelope (ASE-2).
- Risks:
  - Under-specified guard reason taxonomy.

### Phase P1: API + projections
- Deliver:
  - Command/query endpoints above.
  - Release timeline projection and blocking-reasons view.
- Depends on:
  - Event store and projection framework.
- Risks:
  - Projection drift if replay tests are missing.

### Phase P2: Approval integration
- Deliver:
  - Board/compliance sign-off integration.
  - SoD enforcement and approver eligibility checks.
- Depends on:
  - Identity/permissions model maturity.
- Risks:
  - Role ambiguity causing false blocks.

### Phase P3: Tooling + operator inspection
- Deliver:
  - Agent tools (`release.gate.inspect`, etc.) and operator inspect UI/API.
  - Evidence hash diff diagnostics for approval invalidation.
- Depends on:
  - Stable API and approval pipeline.
- Risks:
  - Poor explainability if blocking messages are not operator-readable.

## 12) Acceptance Criteria

1. A FOLC `ChangeSet` cannot be released without board and compliance sign-off records.
2. Every blocked transition emits `release.gate.transition_blocked.v1` with actionable `reason_code`.
3. Replay from events reconstructs exact gate decision path.
4. One-click inspect endpoint returns full trace chain from change to release receipt.
5. Attempts to mutate evidence after approval force gate reset and re-approval.
