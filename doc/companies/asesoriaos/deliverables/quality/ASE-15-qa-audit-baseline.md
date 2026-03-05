# ASE-15 QA and Audit Baseline

Date: 2026-03-05
Owner: QA & Audit Lead
Source: Paperclip issue comment snapshot

## QA Deliverables Complete

Prepared the baseline quality framework for regulated fiscal/accounting releases with audit-first evidence.

### 1) Test Strategy (Domain Correctness First)

- Validate fiscal/accounting outcomes before UI behavior: classification accuracy, VAT mapping, accounting normalization, and human-approval gating for regulated actions.
- Use layered validation:
  - Unit: rule-level tax/accounting transformations and invariants.
  - Contract: API/action-layer schema and side-effect guards.
  - Scenario/integration: end-to-end advisory workflows across intake -> normalization -> draft tax outputs -> operator review.
  - Regression: deterministic replay of golden datasets and known incident cases.
- Require explainability assertions on risky decisions: each output must retain traceable source evidence and rationale consumable by non-technical operators.

### 2) Quality Gates (Release Blocking)

- Gate A - Domain Accuracy: zero critical fiscal misclassification defects on golden set; thresholded precision/recall for document classification and tax mapping.
- Gate B - Regulated Safety: no silent side effects; all regulated actions require explicit human approval path and audit trail.
- Gate C - Auditability: 100% of risky flow executions produce complete evidence bundles (inputs, transforms, decisions, approvals, outputs).
- Gate D - Diagnosability: failures must include correlation IDs, decision-step logs, and reproducible input snapshots.
- Gate E - Regression: no unresolved high-severity regressions across baseline datasets and previously fixed incidents.

### 3) Golden Datasets Definition

- Core corpus covering Spanish autonomo + micro-SL accounting/tax scenarios:
  - Invoice varieties (standard/reduced VAT, reverse charge, exempt, intra-EU).
  - Expense edge cases (mixed-use, deductible limits, missing metadata).
  - Recurring tax workflow artifacts (periodic VAT support flows).
- Dataset structure per case:
  - Source docs + metadata.
  - Expected normalized ledger outputs.
  - Expected fiscal treatment and confidence bands.
  - Expected human-review flags where applicable.
- Include an incident-backed regression subset from every production defect class.

### 4) Audit Evidence Bundle Checklist

For each regulated or high-risk workflow execution, capture and retain:

- Run metadata: run ID, issue ID, agent/user actor, timestamps, environment/version.
- Source evidence: original document hashes, extracted fields, lineage links.
- Decision trace: rule/model version, intermediate transforms, rationale text.
- Approval trace: reviewer identity, approval/rejection decision, reason, timestamp.
- Output artifacts: generated records/recommendations, downstream action payloads.
- Observability artifacts: structured logs, error stack, correlation ID, retry history.
- Integrity controls: immutability/hash records for evidentiary artifacts.

### 5) Launch Readiness Review Template

Release recommendation is based on:

- Scope and risk classification (regulated-impact vs non-regulated).
- Gate status (A-E) with explicit pass/fail evidence links.
- Open defect posture by severity and fiscal impact.
- Rollback readiness and operator playbook validation.
- Final decision: `GO`, `GO_WITH_GUARDS`, or `NO_GO` with named owner and follow-ups.

### 6) Operating Policy for QA Sign-off

- No launch approval for risky fiscal flows without attached evidence bundle.
- No acceptance of happy-path-only coverage for regulated domains.
- Every severity-1/2 defect must include regression test before closure.
- Board sign-off remains mandatory for logic changes affecting fiscal outcomes.

Issue now has release-audit-ready QA baseline aligned with company charter non-negotiables.
