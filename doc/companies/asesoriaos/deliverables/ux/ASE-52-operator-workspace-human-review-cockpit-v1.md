# ASE-52 Operator Workspace and Human-Review Cockpit v1

Date: 2026-03-05
Owner: Product & UX Lead
Source: Workspace spec
Depends on: company charter, ASE-2 platform architecture, ASE-6 typed action layer, ASE-15 QA baseline, ASE-24 release-gate workflow.

## 1) Purpose

Define the operator-facing workspace and review cockpit for AsesoriaOS v1 so non-technical advisory staff can process accounting and tax-support workflows with clear control, explicit risk visibility, and human-readable explanations of automation.

This spec covers:
- Operator workflows
- Client-facing simplicity constraints
- Information architecture
- Review states and confidence surfaces
- Exception handling
- Parallel API and UI flows for the same operations

## 2) Product Principles

1. Operators must always know:
- what the system thinks happened
- why it thinks that
- what happens next
- whether action is required from them

2. No regulated or risky workflow may appear complete without:
- visible status
- visible confidence
- visible evidence
- visible approval state

3. Manual and AI-assisted work must share the same underlying task states and action model.

4. Copy must sound operational, not magical:
- never imply certainty that does not exist
- never hide missing data behind success language

## 3) Primary Users

### 3.1 Operator

Advisory staff member handling intake, bookkeeping prep, VAT support, and exception review.

Needs:
- clear queue prioritization
- low cognitive load
- confidence before approving
- obvious escalation paths

### 3.2 Reviewer

Senior accountant or tax reviewer validating edge cases, low-confidence outputs, and regulated actions.

Needs:
- compact evidence
- exact reasons for flags
- easy approve / reject / reassign flow

### 3.3 Client

Small business or autonomo uploading documents and answering follow-up questions.

Needs:
- minimal jargon
- simple status language
- clear missing-information requests

## 4) Information Architecture

### 4.1 Top-level operator navigation

1. `Work Queue`
- All assigned or team-visible work items
- Sorted by urgency, blocked state, and SLA risk

2. `Review Cockpit`
- Concentrated view for items requiring human review
- Includes confidence, exceptions, evidence, and approval actions

3. `Clients`
- Client list, open requests, missing documents, current filing periods

4. `Cases`
- Unified per-client/per-period workspace for documents, normalized entries, notes, and decisions

5. `Activity`
- Audit timeline of automation steps, human actions, and external action requests

### 4.2 Case-level information architecture

A case page must contain:
1. `Header summary`
- client
- period
- workflow type
- current state
- next required action

2. `Status rail`
- intake
- classification
- normalization
- review
- ready for downstream action
- completed / blocked

3. `Work panels`
- documents
- extracted data
- accounting interpretation
- tax implications
- exceptions
- operator notes

4. `Decision footer`
- approve
- send back
- request client info
- escalate
- defer

## 5) Canonical Review States

These states must be identical in UI labels and API enum mapping.

| API state | UI label | Meaning | Operator action |
| --- | --- | --- | --- |
| `received` | Received | Input exists but not processed yet | None |
| `processing` | Processing | System is extracting or evaluating | Wait or open details |
| `needs_operator_review` | Needs review | Human decision required before progress | Open cockpit |
| `waiting_on_client` | Waiting on client | Missing information from client | Send or monitor request |
| `waiting_on_internal` | Waiting on specialist | Requires accountant/compliance input | Reassign or monitor |
| `ready_for_approval` | Ready to approve | Review complete, approval can be issued | Approve or reject |
| `approved` | Approved | Human accepted current output | Continue to next safe step |
| `blocked` | Blocked | Workflow cannot proceed | Resolve blocker |
| `completed` | Completed | Workflow finished with audit trail | Archive or inspect |

## 6) Confidence and Risk Surface Model

Every reviewable item must expose four fields together:
- `confidence_score`
- `confidence_band`
- `risk_level`
- `review_reason_codes[]`

### 6.1 Confidence bands

- `High`: system found consistent evidence, no material contradictions
- `Medium`: likely correct but operator should verify one or more fields
- `Low`: operator review required before any material downstream use

### 6.2 Risk levels

- `Low`: operational inconvenience only
- `Medium`: bookkeeping accuracy risk
- `High`: potential fiscal, filing, or compliance impact

### 6.3 UI rules

1. Never show confidence without also showing reason.
2. Never use green success styling for `Medium` or `Low` confidence.
3. `High` risk always pins the item into the Review Cockpit until disposition.
4. Confidence copy must explain uncertainty in plain language.

Example:
- `Medium confidence`
- `Reason: VAT treatment is likely standard, but supplier country is missing.`

## 7) Core User Flows

### 7.1 Flow A: Operator processes daily queue

Goal:
Operator clears routine work while spotting exceptions early.

UI flow:
1. Open `Work Queue`
2. Review grouped sections:
- Needs review
- Waiting on client
- Ready to approve
- Blocked
3. Open highest-priority case
4. Read summary card:
- what changed
- confidence
- next action
5. Either approve routine item or send flagged item to cockpit

API flow:
1. `GET /v1/work-queue?assignee=me`
2. `GET /v1/cases/{case_id}`
3. `GET /v1/cases/{case_id}/review-summary`
4. `POST /v1/cases/{case_id}/decisions`

### 7.2 Flow B: Human review of low-confidence accounting interpretation

Goal:
Operator can decide without reading raw system internals.

UI flow:
1. Open item in `Review Cockpit`
2. Review:
- status
- confidence band
- explanation
- source evidence
- suggested accounting treatment
3. Compare alternative interpretations if present
4. Choose:
- approve suggestion
- edit classification
- escalate
- request client clarification
5. Submit reasoned decision

API flow:
1. `GET /v1/review-items/{review_item_id}`
2. `GET /v1/review-items/{review_item_id}/evidence`
3. `GET /v1/review-items/{review_item_id}/alternatives`
4. `POST /v1/review-items/{review_item_id}/decision`

### 7.3 Flow C: Missing client information

Goal:
Operators can pause work cleanly and clients see a simple request.

UI flow:
1. Operator selects `Request client info`
2. System proposes missing-data template
3. Operator edits if needed
4. Case moves to `Waiting on client`
5. Client receives plain-language request
6. Client uploads answer or document
7. Case returns to queue with `Updated by client`

API flow:
1. `POST /v1/cases/{case_id}/client-requests`
2. `GET /v1/clients/{client_id}/requests`
3. `POST /v1/client-requests/{request_id}/responses`
4. `POST /v1/cases/{case_id}/resume`

### 7.4 Flow D: Regulated or high-risk approval

Goal:
No silent side effect; approval is deliberate and explainable.

UI flow:
1. Operator opens `Ready to approve` item
2. Approval panel shows:
- what output will be used downstream
- whether any side effect is proposed
- evidence bundle summary
- reviewer identity requirement
3. Operator can:
- approve
- reject
- delegate to specialist
4. Audit confirmation screen shows recorded decision

API flow:
1. `GET /v1/approvals/{approval_id}`
2. `GET /v1/approvals/{approval_id}/evidence-bundle`
3. `POST /v1/approvals/{approval_id}/decision`

### 7.5 Flow E: Exception and blocker handling

Goal:
Blocked work is visible, actionable, and never mistaken for progress.

UI flow:
1. System flags exception
2. Case enters `Blocked` or `Needs review`
3. Operator sees:
- blocker title
- plain-language explanation
- required owner
- suggested next step
4. Operator reassigns, comments, or resolves

API flow:
1. `GET /v1/cases/{case_id}/exceptions`
2. `POST /v1/cases/{case_id}/exceptions/{exception_id}/resolve`
3. `POST /v1/cases/{case_id}/handoffs`

## 8) Screen Specifications

### 8.1 Work Queue

Purpose:
Triage and throughput control for operators.

Required elements:
- saved filters
- urgency sort
- state chips
- confidence indicator
- blocker indicator
- client name
- period
- workflow type
- next action owner

Interaction rules:
- default sort puts `High risk` and `waiting on operator` first
- blocked items cannot look completed
- row click opens case summary, not raw technical logs

### 8.2 Review Cockpit

Purpose:
Single decision surface for human review.

Required elements:
- sticky decision bar
- explanation card
- evidence viewer
- extracted fields table
- suggested outcome
- alternative outcomes if ambiguity exists
- notes / audit comments
- escalation control

Interaction rules:
- decision controls remain disabled until required evidence panel has been seen for high-risk items
- every rejection requires reason selection plus free text
- changes to operator-edited values must be highlighted before submit

### 8.3 Case Detail

Purpose:
Full context for one workflow unit.

Required elements:
- case summary
- progress rail
- documents tab
- normalized entries tab
- review history tab
- client requests tab
- audit activity tab

Interaction rules:
- audit history is readable by operators; technical IDs are secondary metadata
- each automation step must include a human-readable explanation

### 8.4 Client Request Drawer

Purpose:
Compose and track clarification requests.

Required elements:
- missing item summary
- recommended plain-language message
- due date
- attachment request toggle
- preview of client-facing wording

Interaction rules:
- default copy avoids accounting jargon
- one request should ask for one decision or document group only

## 9) Human-Readable Explanation Pattern

Every automated interpretation shown to an operator must answer:
1. `What did the system conclude?`
2. `What evidence supports it?`
3. `What is uncertain or missing?`
4. `What happens if approved?`
5. `What should the operator do now?`

Explanation template:

`Suggested treatment`
- `We identified this invoice as an office expense with standard VAT.`

`Why`
- `The supplier VAT number, invoice format, and line items match prior office-supply invoices.`

`What needs attention`
- `The invoice date is readable, but the supplier country is missing from extracted metadata.`

`Next step`
- `Confirm the VAT treatment or request the corrected document from the client.`

## 10) UI Copy Proposals

### 10.1 Queue labels

- `Needs your review`
- `Waiting on client`
- `Ready to approve`
- `Blocked`
- `Updated since last review`

### 10.2 Confidence copy

- `High confidence: evidence is consistent.`
- `Medium confidence: one or more details should be verified.`
- `Low confidence: do not approve without review.`

### 10.3 Exception copy

- `We could not confirm the VAT treatment from the available evidence.`
- `This item is blocked until a missing document is provided.`
- `A specialist review is required before this step can continue.`

### 10.4 Approval copy

- `Approve and continue`
- `Reject and send back`
- `Request client clarification`
- `Escalate to specialist`

### 10.5 Client-facing request copy

Subject:
`We need one more document to complete your review`

Body:
`We could not complete this step because one document or detail is missing. Please upload the requested file so we can continue your accounting review.`

## 11) Parallel UI/API Design Rules

The same operation must be possible through UI and API with the same state outcomes.

### 11.1 Decision parity

If UI offers:
- approve
- reject
- request info
- escalate

API must expose equivalent commands with explicit reasons and audit metadata.

### 11.2 Status parity

Every UI status chip must map 1:1 to a canonical API enum.

### 11.3 Explanation parity

If UI shows a plain-language explanation, API query responses must include:
- `summary`
- `reasoning_excerpt`
- `missing_information`
- `recommended_next_action`

### 11.4 Audit parity

Every human click that changes state must create the same durable decision record as an API call.

## 12) UX Acceptance Criteria

1. An operator can identify the next required action for any case within 5 seconds from the case header.
2. A reviewable item always shows status, confidence, evidence summary, and next action together on the same screen.
3. No blocked or waiting item is visually indistinguishable from a completed item.
4. High-risk items cannot be approved without explicit human confirmation and visible evidence summary.
5. Every AI-generated recommendation includes a human-readable explanation and at least one supporting evidence reference.
6. Every operator action that changes workflow status is reflected in the audit history.
7. A client clarification request can be sent without operators writing jargon-heavy custom text from scratch.
8. Queue rows expose enough information to triage without opening every case.
9. API and UI state transitions remain aligned for all core actions in sections 7.1 through 7.5.
10. Low-confidence items are never auto-presented as complete or safe to submit.

## 13) Assumptions

- v1 operators are Spanish advisory staff, but this spec is written in English for internal design alignment.
- Client communications will require Spanish localization before production.
- High-risk fiscal actions remain human-gated and out of scope for silent execution.
- Underlying evidence and audit primitives from ASE-2 and ASE-6 will exist.

## 14) Risks

1. Confidence oversimplification:
- a single score could falsely imply precision without sufficient rationale

2. Queue overload:
- operators may ignore critical exceptions if routine and risky work look too similar

3. Copy drift between UI and API:
- explainability may degrade if teams implement separate wording models

4. Review fatigue:
- too many medium-confidence items could collapse into rubber-stamping

## 15) Validation Method

1. Run moderated workflow tests with 5 to 8 non-technical advisory operators.
2. Measure:
- time to first correct action
- incorrect approvals
- blocked-item recognition
- client-request completion rate

3. Validate copy comprehension:
- operators must correctly explain system uncertainty in their own words

4. Validate parity:
- execute the same review scenarios via UI and API and compare resulting state and audit outputs

## 16) Recommended Next Build Steps

1. Convert this spec into wireframes for:
- Work Queue
- Review Cockpit
- Case Detail
- Client Request Drawer

2. Define shared response schemas for:
- `review-summary`
- `review-item`
- `approval decision`
- `client request`

3. Create a reason-code taxonomy for confidence and exception explanations so copy stays consistent across channels.
