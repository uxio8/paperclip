# ASE-50 Agent Action Contracts and Dry-Run Execution Spec

Date: 2026-03-05
Owner: Elena Workflow, AI Workflow Engineer
Source issue: ASE-50
Related deliverable: ASE-6 Typed Agent Action Layer and Dry-Run Semantics

## Purpose

Define an implementation-ready contract for typed agent actions in AsesoriaOS. The contract must make every action explicit, approval-aware, dry-run-first, and auditable enough for fiscal and accounting workflows with human review.

This document narrows the broader ASE-6 direction into concrete request and response envelopes, workflow state transitions, evaluation requirements, and rollback constraints.

## Design Principles

- Every action is typed, versioned, and schema-validated before execution.
- `dryRun=true` is the safe default for any newly introduced workflow.
- Regulated side effects never happen through prompt-only reasoning; they require typed tool invocations plus explicit approval state.
- Planner output must be reviewable as structured data before execution.
- Audit evidence must be sufficient for a non-technical operator to understand what happened and why.

## Action Classes

### `read.*`

Purpose: fetch or validate information without changing business state.

Allowed examples:
- `read.client_profile`
- `read.obligation_calendar`
- `read.ledger_entries`
- `read.document_classification`

Properties:
- no external side effects
- deterministic from input plus referenced snapshot
- always allowed in dry-run and live mode

### `simulate.*`

Purpose: compute predicted outcomes without staging or committing writes.

Allowed examples:
- `simulate.vat_impact`
- `simulate.reconciliation_result`
- `simulate.filing_readiness`

Properties:
- no writes to source systems
- must return evidence and assumptions
- must return confidence or uncertainty markers when inference is involved

### `propose.*`

Purpose: generate a staged write plan for review or later execution.

Allowed examples:
- `propose.accounting_adjustment`
- `propose.vat_period_close`
- `propose.document_reclassification`

Properties:
- no irreversible side effects
- may persist a draft plan only in internal staging state
- must include `proposedChanges[]`, risk tags, and rollback expectations

### `commit.*`

Purpose: apply approved side effects.

Allowed examples:
- `commit.accounting_adjustment`
- `commit.workflow_resolution`
- `commit.integration_dispatch`

Properties:
- requires `dryRun=false`
- requires policy pass for live execution
- requires approval token when action scope is regulated or integration-touching
- must be idempotent under repeated delivery

## Request Contract

Every action request uses the same top-level envelope:

```json
{
  "actionType": "propose.vat_period_close",
  "actionVersion": "1.0.0",
  "requestId": "9f39b0ef-f7d2-4f8e-9f98-7bfe7d49e97b",
  "issueRef": {
    "issueId": "93715f5b-ff46-4b27-864f-e23d4e854e54",
    "issueIdentifier": "ASE-50"
  },
  "actor": {
    "agentId": "2a15bff4-b027-461c-a4f8-40dd2aa6e5d6",
    "runId": "7f8057e9-ee88-4681-a13a-530fd53f3c38"
  },
  "executionMode": {
    "dryRun": true,
    "approvalMode": "required",
    "approvalToken": null
  },
  "target": {
    "entityType": "vat_period",
    "entityId": "vat_period_2026_q1"
  },
  "input": {},
  "contextRefs": [
    {
      "type": "document",
      "id": "doc_123"
    }
  ],
  "policyContext": {
    "jurisdiction": "ES",
    "workflowType": "vat_support",
    "regulated": true
  },
  "idempotencyKey": "sha256:2c5336..."
}
```

### Required fields

- `actionType`: namespaced action name
- `actionVersion`: semantic version for schema compatibility
- `requestId`: globally unique per request
- `actor.agentId`, `actor.runId`: tie execution to a specific Paperclip run
- `executionMode.dryRun`: explicit boolean, never implicit
- `executionMode.approvalMode`: `none|required|preapproved`
- `input`: action-specific typed payload
- `idempotencyKey`: stable hash across equivalent mutable requests

### Action-specific input requirements

Every action schema must declare:
- required fields
- optional fields
- enum constraints
- snapshot requirements for deterministic replay
- units for any money, percentage, period, or count values

### Request validation gates

Requests must fail before execution if:
- schema is invalid
- referenced entity snapshot is missing
- `commit.*` is called with `dryRun=true`
- `commit.*` is called on a regulated action without approval
- `idempotencyKey` is missing for mutable operations

## Response Contract

Every action response uses this envelope:

```json
{
  "requestId": "9f39b0ef-f7d2-4f8e-9f98-7bfe7d49e97b",
  "actionType": "propose.vat_period_close",
  "actionVersion": "1.0.0",
  "status": "needs_approval",
  "result": {
    "summary": "Prepared VAT close proposal for 2026 Q1.",
    "proposedChanges": [],
    "diff": {
      "before": {},
      "after": {}
    },
    "evidence": [],
    "policyDecisions": [],
    "operatorExplanation": {
      "whatWasRequested": "",
      "whatWouldChange": "",
      "whyApprovalIsRequired": ""
    }
  },
  "audit": {
    "eventId": "evt_123",
    "inputHash": "sha256:...",
    "outputHash": "sha256:...",
    "timestamp": "2026-03-05T22:30:00Z"
  },
  "errors": []
}
```

### Response status values

- `ok`: action completed within permitted scope
- `needs_approval`: proposal is valid but cannot proceed live yet
- `rejected`: policy or validation refused the action
- `error`: infrastructure or unexpected execution failure

### Required response sections

- `result.summary`: short deterministic human-readable status line
- `result.evidence[]`: typed evidence references used in the decision
- `result.policyDecisions[]`: each rule id with `pass|fail|not_applicable`
- `audit.eventId`: immutable append-only event reference

### Mutable action requirements

For `propose.*` and `commit.*`, responses must also include:
- `result.diff.before`
- `result.diff.after`
- `result.proposedChanges[]` or `result.committedChanges[]`
- rollback posture: `reversible|compensating_action_required|manual_recovery_only`

## Policy and Approval Semantics

### Approval matrix

| Action class | Dry-run allowed | Live allowed without approval | Live allowed with approval |
| --- | --- | --- | --- |
| `read.*` | yes | yes | yes |
| `simulate.*` | yes | yes | yes |
| `propose.*` | yes | yes, if proposal only | yes |
| `commit.*` non-regulated | no | yes, if policy allows | yes |
| `commit.*` regulated | no | no | yes |

### Regulated scope triggers

Approval is mandatory when any of the following are true:
- the action changes fiscal outcomes
- the action creates or modifies accounting records
- the action triggers AEAT, TGSS, banking, signature, or other external side effects
- the action alters evidence retention or operator-visible compliance status

### Approval payload contract

Approval requests must include:
- action summary
- impacted entities
- expected effect and monetary deltas
- risk level
- evidence bundle references
- policy rules that forced approval
- rollback strategy
- operator-facing explanation

### Approval token requirements

For `commit.*` actions requiring approval:
- approval token must reference a specific approved proposal
- token must encode allowed action type, target entity, and expiry
- token reuse outside the approved scope must be rejected

## Orchestration Plan

### Planner output contract

The planner must emit a typed execution plan:

```json
{
  "planId": "plan_123",
  "workflowType": "vat_support",
  "dryRun": true,
  "steps": [
    {
      "stepId": "step_1",
      "actionType": "read.ledger_entries",
      "preconditions": [],
      "postconditions": ["ledger_entries_loaded"],
      "onFailure": "stop",
      "rollbackStepId": null
    }
  ]
}
```

### Required planner fields

- `planId`
- `workflowType`
- `dryRun`
- ordered `steps[]`
- `preconditions[]`
- `postconditions[]`
- `onFailure`: `stop|retry|escalate|rollback`
- `rollbackStepId` where applicable

### Canonical execution stages

1. `INTAKE_VALIDATE`
2. `LOAD_CONTEXT`
3. `POLICY_PREFLIGHT`
4. `SIMULATE_IMPACT`
5. `PROPOSE_CHANGES`
6. `REQUEST_APPROVAL`
7. `COMMIT_APPROVED_ACTIONS`
8. `VERIFY_RECONCILIATION`
9. `CLOSE_OR_ESCALATE`

### Handoff rules

- Planner to executor handoff must be through a persisted plan object, not free-form text.
- Executor may not invent new mutable steps that are absent from the approved plan.
- If evidence changes materially after approval, the workflow must return to `SIMULATE_IMPACT` or `PROPOSE_CHANGES`.
- Human review checkpoints must reference the exact plan version and diff snapshot being approved.

## Execution Policies

### Retry rules

- retry only for transient infrastructure failures
- never retry validation failures
- never retry policy refusals
- retryable commits must preserve the same `idempotencyKey`

### Timeout rules

- each step must declare `timeoutMs`
- timeout on `read.*` or `simulate.*` may retry if source consistency is preserved
- timeout on `commit.*` must enter verification before any retry is attempted

### Escalation rules

Escalate to operator or manager when:
- policy result is ambiguous
- rollback posture is `manual_recovery_only`
- evidence completeness is below threshold
- approval token is missing or expired for regulated live action

## Audit and Explainability Requirements

Every executed step must emit an audit event with:
- `eventId`
- `timestamp`
- `agentId`
- `runId`
- `issueIdentifier`
- `planId`
- `stepId`
- `actionType`
- `actionVersion`
- `dryRun`
- `approvalId`
- `sideEffectClass`
- `inputHash`
- `outputHash`
- `evidenceRefs`
- `policyRuleIds`
- `outcomeStatus`

### Operator explanation bundle

Every `propose.*` and `commit.*` result must carry a concise explanation bundle:
- what was requested
- what evidence was considered
- what policy checks passed or failed
- what changed or would change
- what still needs approval or operator action

This explanation should be generated from structured fields, not from unbounded model prose.

## Eval Harness Proposal

### Contract tests

- validate request and response schemas per action version
- ensure unknown fields are rejected for regulated actions
- assert required audit fields are always present

### Policy tests

- regulated `commit.*` without approval returns `needs_approval` or `rejected`
- non-regulated `commit.*` respects policy allowlist and integration kill switches
- expired approval tokens are rejected deterministically

### Determinism tests

- same input, snapshots, and policy version produce the same plan
- same refusal scenario produces the same refusal category
- dry-run output diff matches live pre-commit diff for equivalent plan version

### Replay tests

- reconstruct operator explanation from audit trail alone
- verify each committed action maps back to a prior proposal or approval
- verify event sequence is gap-free within a workflow run

### Adversarial tests

- malformed evidence refs
- stale snapshot identifiers
- prompt-injection text inside source documents attempting to bypass policy
- duplicate mutable requests with the same `idempotencyKey`

### Release gates

Do not release live regulated actions unless:
- contract tests pass
- policy regression suite passes
- dry-run to commit divergence stays below threshold
- audit replay succeeds for golden workflows
- rollback drill succeeds for every reversible action type

## Safety and Rollback Recommendations

### Core controls

- default new workflows to dry-run mode
- gate live integrations behind per-connector kill switches
- require append-only audit storage
- checksum action payloads and diffs
- separate proposal storage from committed state

### Rollback classes

- `reversible`: can be automatically undone using a paired rollback action
- `compensating_action_required`: cannot undo directly, but a typed compensating action exists
- `manual_recovery_only`: operator intervention is required before state is considered safe

### Rollback contract

Each mutable action type must declare:
- whether rollback is supported
- rollback action type, if any
- maximum rollback window
- preconditions for rollback
- operator alerts required when rollback fails

### Safety defaults for AsesoriaOS

- fiscal-impacting commits require approval by default
- AEAT, TGSS, banking, and signature side effects remain disabled until explicit board approval
- if evidence quality is insufficient, downgrade to proposal or block the workflow
- if policy and workflow disagree, policy wins and execution stops

## Recommended Next Steps

1. Implement JSON schemas for the four action classes and their shared envelope.
2. Add a policy engine interface that returns structured `policyDecisions[]`.
3. Store planner output and approvals as first-class versioned records.
4. Build the first golden-path eval suite around VAT-support dry-run and approval flows.
