# ASE-1 90-Day Operating Plan

Date: 2026-03-05
Owner: CEO / Founder Agent
Source: Paperclip issue `ASE-47`

## CEO Operating Memo

This 90-day plan covers **March 5, 2026 through June 3, 2026**. The wedge stays narrow by design: **Spain only, fiscal/accounting first, human-reviewed automation, API-first product surface, and no live regulated side effects**.

The operating goal for this window is to leave June 3 with a credible MVP package for advisory operators handling autonomos and micro-SL clients:
- document intake and classification
- accounting normalization
- VAT-support workflows
- operator and client workspaces
- typed agent actions with full audit trail
- evidence bundles that make human review faster and safer

## Phase Focus

### Phase 1: foundation and controls
**Window:** March 5 to April 1, 2026

Execution priority:
- lock the canonical fiscal workflow, exceptions, and mandatory review points
- harden platform boundaries, audit model, and typed action contracts
- define QA baseline and evidence requirements before product polish

Success criteria:
- every fiscal-impacting path is explainable and reviewable
- no workflow depends on live AEAT, TGSS, banking, or signature side effects
- release-gate rules for fiscal-outcome logic changes are specified before implementation accelerates

### Phase 2: productization and operator evidence
**Window:** April 2 to April 29, 2026

Execution priority:
- build operator/client workspace definitions around explainability, not just task speed
- convert control requirements into visible review UX and evidence bundles
- keep integrations mock-first so the team can validate flows without crossing approval gates

Success criteria:
- operator review cockpit can surface evidence, uncertainty, and approval requirements
- VAT-support flow is modeled end-to-end with dry-run semantics
- QA can evaluate workflow outputs against a golden dataset and audit checklist

### Phase 3: pilot readiness and board gates
**Window:** April 30 to June 3, 2026

Execution priority:
- harden orchestration, replayability, and exception handling
- validate pilot ICP and partner readiness for boutique advisory firms in Spain
- package board decisions required for any higher-risk expansion after MVP

Success criteria:
- MVP demo path is auditable from input to operator decision
- pilot conversations are backed by evidence-first positioning, not autonomous-automation claims
- board packets are ready for logic-governance, side effects, privacy/security, and launch-claim decisions

## Budget Split

Approved monthly operating envelope: **70,000 cents** (Paperclip operating convention: **EUR 700.00**).

Phase 1 team budget allocation:

| Function | Agent | Monthly cents | Share | Why it is funded now |
|---|---|---:|---:|---|
| Company direction | CEO / Founder | 12000 | 17.1% | sequencing, tradeoffs, board packages, cross-team coordination |
| Platform core | CTO / Platform Architect | 18000 | 25.7% | system boundaries, audit model, release-gate architecture |
| Product and UX | Product & UX Lead | 9000 | 12.9% | operator-facing workflow design and review UX |
| Fiscal domain | Fiscal Domain Lead | 10000 | 14.3% | accounting/VAT workflow correctness and acceptance criteria |
| Agent action layer | AI Workflow Engineer | 15000 | 21.4% | typed actions, dry-run behavior, explainability, approvals |
| Quality and evidence | QA & Audit Lead | 6000 | 8.6% | golden datasets, audit baseline, release evidence |

Budget policy for this window:
- keep the full initial envelope on the six phase-1 agents
- do not add payroll, mercantile, or live-integration work into this envelope
- treat phase-2 hires as board-gated expansions, not silent budget creep inside the current plan

## Delegation and Active Workstreams

- Compliance controls: [ASE-10](../compliance/ASE-10-regulatory-control-matrix.md)
- Fiscal domain: [fiscal operating model](../fiscal/fiscal-operating-model-v1.md)
- Platform architecture: [ASE-2](../architecture/ASE-2-platform-architecture-spec.md)
- FOLC release gate: [ASE-24](../architecture/ASE-24-folc-release-gate-workflow.md)
- Product and operator review UX: [ASE-13](../ux/ASE-13-operator-workspace-and-human-review-ux-v1.md)
- Integration planning: [ASE-7](../integrations/ASE-7-external-integrations-spec.md)
- QA and audit baseline: [ASE-15](../quality/ASE-15-qa-audit-baseline.md)
- Market discovery and pilot package: [ASE-9](../discovery/ASE-9-customer-discovery-and-pilot-package.md)
- Typed action layer: [ASE-6](../automation/ASE-6-typed-agent-action-layer.md)

## Phase 2 Hiring Plan

These hires remain **queued, not immediate**. They should start only after the phase-1 team is stable and the first control artifacts are in place.

1. **Chief Compliance & Risk**
- Trigger: fiscal control matrix exists and needs active ownership for ongoing board-gated change review
- Reason: improves safety and decision speed once fiscal-impacting change volume increases

2. **Integrations Engineer**
- Trigger: mock-first workflow and API contracts are stable enough to define external-system boundaries
- Reason: prevents premature coupling to AEAT, TGSS, banking, or signature vendors

3. **Customer Discovery & Partnerships**
- Trigger: MVP storyline and operator evidence flow are concrete enough to support serious pilot conversations
- Reason: keeps discovery tied to a real wedge instead of broad market drift

Hiring rule:
- each of these hires should go through a separate `hire_agent` approval
- any incremental budget above the current 70,000-cent envelope should be called out explicitly to the board before hiring

## Risks, Assumptions, and Validation

Primary risks:
- scope drift into payroll, mercantile, or generalized ERP behavior before fiscal/accounting MVP is stable
- over-investment in integrations before mock-first workflow validation is complete
- weak audit evidence that makes human review slower instead of faster
- QA execution risk if the current QA lead runtime instability persists

Key assumptions:
- Spanish advisory operators will accept human-reviewed automation if evidence is clearer than current back-office practice
- document intake, bookkeeping normalization, and VAT prep are the earliest operator pain points worth compressing
- API-first architecture will reduce rework across operator UI and agent-native workflows

Validation method:
- require artifacts for every critical stream: workflow specs, control matrices, event contracts, eval datasets, approval traces, and review logs
- block any fiscal-outcome logic change behind the FOLC release-gate model
- block any live external side effect behind explicit board approval

## Board Approval Asks

This memo requests board confirmation of the following package:

1. Keep the June 3, 2026 target and narrow wedge unchanged.
2. Operate phase 1 with the current 70,000-cent monthly envelope and six-agent team.
3. Allow phase-2 hire requests only after the stated triggers are met and each hire receives separate approval.
4. Keep live AEAT, TGSS, banking, and signature actions disabled until dedicated board review.
5. Keep fiscal-outcome logic changes under explicit release-gate and evidence requirements.

## Decision Summary

The company should spend the next 90 days proving one thing well: that a Spanish advisory operator can move from document intake to VAT-support readiness with fewer manual steps and better auditability than the traditional process, without surrendering human control on regulated decisions.
