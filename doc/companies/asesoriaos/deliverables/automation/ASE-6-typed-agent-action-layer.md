# ASE-6 Typed Agent Action Layer and Dry-Run Semantics

Date: 2026-03-05
Owner: AI Workflow Engineer
Source: Paperclip issue comment snapshot

## Update

Delivered a typed, approval-aware action-layer spec for agent workflows with dry-run, replay, and rollback semantics.

- Defined explicit tool contracts with deterministic inputs/outputs and side-effect classes.
- Added orchestration phases, handoff state machine, and failure/timeout behavior.
- Added eval harness proposal with behavior, safety, and traceability metrics.
- Added rollback controls for regulated actions (fiscal-impacting operations require human approval).

### 1) Agent Tool Contracts (typed and reviewable)

Common envelope for every tool/action:

```json
{
  "actionType": "string",
  "actionVersion": "semver",
  "requestId": "uuid",
  "issueId": "ASE-6",
  "actor": { "agentId": "uuid", "runId": "uuid" },
  "dryRun": true,
  "approvalMode": "none|required|preapproved",
  "input": {},
  "contextRefs": ["doc-id", "ledger-entry-id"],
  "idempotencyKey": "stable-hash"
}
```

Tool classes:
- `read.*` (no side effects): deterministic fetch/classify/validate.
- `simulate.*` (counterfactual): computes fiscal/accounting impact with evidence, never writes.
- `propose.*` (staged write intent): produces a write plan + risk tags, never commits.
- `commit.*` (real side effects): only executable when `approvalMode=preapproved` and policy allows.

Typed response contract:
- `result.status`: `ok|needs_approval|rejected|error`
- `result.evidence[]`: typed references used for decision
- `result.diff`: before/after payload for mutable actions
- `result.policyDecisions[]`: policy checks with pass/fail + rule ids
- `result.auditRef`: immutable event id

### 2) Dry-Run and Approval Semantics

Execution policy matrix:
- `dryRun=true`: allow `read/simulate/propose`; block all `commit.*` with deterministic refusal reason.
- `dryRun=false` + regulated scope: execute only through `propose -> approval -> commit`.
- Any fiscal-outcome change without approval: hard-fail with `needs_approval` and approval payload.

Approval payload (typed):
- action summary, affected entities, risk level, expected fiscal delta, supporting evidence bundle, rollback plan.

### 3) Orchestration Plan and Handoffs

Workflow stages:
1. `INTAKE_VALIDATE`: normalize request, schema validation, policy precheck.
2. `EVIDENCE_BUILD`: collect source docs, classification confidence, ledger/tax context.
3. `SIMULATE`: run fiscal/accounting impact simulation.
4. `PLAN_ACTIONS`: generate ordered action plan with dependencies and idempotency keys.
5. `APPROVAL_GATE`: emit approval request when regulated/high-risk.
6. `COMMIT`: execute approved commits with transactional checkpoints.
7. `VERIFY_CLOSE`: post-commit verification + reconciliation checks.

Handoff object between planner/executor:
- `planId`, `stepId`, `preconditions[]`, `postconditions[]`, `rollbackStepId`, `timeoutMs`, `retryPolicy`.

Failure policy:
- deterministic retries for transient infra errors only.
- no retry for policy/validation failures.
- partial commit triggers automatic rollback workflow if supported; otherwise set `blocked` with operator task.

### 4) Traceability and Explainability

Required audit event fields on every step:
- `timestamp`, `agentId`, `runId`, `issueId`, `actionType`, `inputHash`, `outputHash`, `evidenceRefs`, `policyRuleIds`, `approvalId`, `sideEffectClass`, `dryRun`.

Explanation bundle for operators:
- what was requested
- what evidence was used
- what policy checks passed/failed
- what changed (or would change in dry-run)
- what approval was required and why

### 5) Eval Harness Proposal

Offline eval suite:
- contract tests: schema conformance per tool version.
- policy tests: regulated actions blocked unless approved.
- determinism tests: same input/context => same plan + same refusal categories.
- replay tests: rebuild decision trace from stored audit events.

Online scorecard:
- approval precision/recall for regulated actions.
- unsafe side-effect attempt rate.
- dry-run/commit divergence rate.
- evidence completeness score.
- rollback success rate.

Release gates:
- block release if policy regression > threshold or trace replay fails.

### 6) Safety and Rollback Recommendations

- Enforce two-phase commit for fiscal-impacting actions: `propose` then `commit` after approval.
- Keep immutable append-only action log and checksum each event.
- Require idempotency keys on every mutable action.
- Add kill switch per integration (AEAT/TGSS/banking/signature) default `off` until board approval.
- Ship with dry-run default `true` for new workflows; explicit per-workflow opt-in to live mode.
