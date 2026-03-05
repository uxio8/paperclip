# Fiscal Operating Model v1

Date: 2026-03-05
Owner: Fiscal Domain Lead
Scope: Spain-first fiscal/accounting operating model for autonomos and micro-SL clients
Status: Working domain spec for MVP wedge
Depends on: company charter, ASE-1 operating plan, ASE-7 integrations spec, ASE-52 operator workspace and review cockpit

## 1. Purpose

Define the repeatable monthly fiscal and accounting workflow that AsesoriaOS should support first.

This document is intentionally narrow:
- client types: autonomos and micro-SL
- geography: Spain
- workflow focus: bookkeeping normalization, VAT-support preparation, evidence bundles, and operator review
- excluded from first phase: payroll, mercantile lifecycle, autonomous filing, and unreviewed regulated side effects

## 2. Product Position for the Fiscal Wedge

AsesoriaOS v1 is not a fully autonomous asesoria.
It is an operator-centered system that:
- ingests source documents
- proposes accounting and tax interpretations
- makes uncertainty visible
- assembles evidence for review
- tracks what is ready, blocked, or waiting on client input

The product should reduce repetitive monthly work without hiding decisions that can materially affect books or taxes.

## 3. Domain Boundaries

### 3.1 In scope

- Sales and purchase invoice intake
- Expense receipt intake
- Basic bank-support reconciliation preparation when documents exist
- Source-document normalization into proposed ledger entries
- VAT-support workflow for recurring periods
- Client follow-up for missing or contradictory information
- Human-review routing for fiscal-impacting ambiguity
- Case evidence bundle generation for approval-ready work

### 3.2 Out of scope for v1

- Full chart-of-accounts customization for large or complex entities
- Payroll bookkeeping flows
- Fixed-asset lifecycle automation beyond flagging for manual review
- Intrastat, customs, or advanced international tax handling
- Mercantile books and annual accounts production
- Autonomous submission to AEAT or banking/payment execution

## 4. Operating Assumptions and Validation Status

This spec distinguishes between operating assumptions and validated rules.

### 4.1 Assumptions currently acceptable for MVP design

- Most monthly work for the target wedge is repetitive and document-driven.
- Advisory operators prefer visible exceptions over silent auto-posting.
- A substantial share of client friction comes from missing documents, poor document quality, and ambiguous business purpose.
- The first useful tax workflow is VAT-support preparation, not autonomous filing.

### 4.2 Items requiring explicit validation before product hard-coding

- Exact filing-form mappings and field-level derivations
- Required bookkeeping treatment for edge cases with mixed business/personal use
- Special-regime handling rules
- Threshold-driven obligations or exemptions
- Any filing calendar commitments or legal promises shown to clients

Rule: when a fiscal rule is not yet validated, the system may surface a draft interpretation and evidence request, but it must not represent the result as final or filing-ready without operator confirmation.

## 5. Canonical Monthly Workflow Map

### 5.0 Initial wedge operating profile

The operating model should optimize for the smallest repeatable advisory loop:

- `autonomo_standard`: one taxpayer, monthly/quarterly document collection, mostly domestic invoices and receipts
- `micro_sl_standard`: one legal entity, low document volume, one or two business bank accounts, mostly domestic supplier and sales invoices

Common monthly operating goals:
- close the intake window for the target period
- transform source documents into reviewable draft entries
- surface unresolved items before period summary generation
- hand the operator an approval-ready VAT-support package, not a silently completed filing

Period close is considered operationally complete only when:
- every received document has a visible disposition
- every included summary total traces back to reviewed entries
- every excluded or deferred item is listed with a reason code
- the case has a visible next step if downstream filing work remains out of scope

### 5.1 Workflow A: monthly bookkeeping cycle

1. Open period for a client and create a case
2. Receive documents from client or integrated source
3. Classify each document into a source-document type
4. Extract fields and preserve raw evidence
5. Normalize counterparty, date, totals, taxes, and payment hints
6. Propose bookkeeping interpretation
7. Detect contradictions, missing fields, or policy exceptions
8. Route routine items to batch approval queue
9. Route ambiguous or high-risk items to human review
10. Freeze reviewed entries for the period draft
11. Produce period summary and VAT-support package
12. Leave filing or downstream side effects in operator-controlled status

Implementation note:
- Steps 2 to 7 may run continuously through the month.
- Steps 8 to 12 are the controlled period-close path.
- Late-arriving items after step 10 must re-open a visible review path, never silently mutate a frozen draft.

### 5.1.1 Monthly workflow swimlane

| Stage | System responsibility | Operator responsibility | Client responsibility | Exit condition |
| --- | --- | --- | --- | --- |
| Case opening | create period case, preload checklist, set due dates | confirm client scope and known obligations | none | case is `received` |
| Intake | ingest files/messages, dedup hints, assign source refs | monitor intake completeness | upload documents and answer requests | all new items are visible in queue |
| Extraction and normalization | classify, OCR/extract, normalize fields, score confidence | spot-check queue and review failures | none unless clarification requested | items are `interpreted` or `needs review` |
| Review triage | group routine vs exception items, compute materiality signals | decide routine approvals and escalation order | answer blocking questions | every item has a route: routine, review, defer, request |
| Period draft | compute included/excluded totals from reviewed items | review summary and unresolved list | optionally provide late evidence | case reaches `ready_for_approval` only if rules pass |
| Downstream handoff | package evidence and summary for later filing/closing work | approve package or keep blocked | none | case is approved, deferred, or blocked with reason |

### 5.2 Workflow B: per-document transformation

Input:
- invoice
- simplified invoice / receipt
- expense receipt
- credit note / corrective invoice
- bank movement with or without support document

Transformation stages:
1. `received`
2. `classified`
3. `extracted`
4. `normalized`
5. `interpreted`
6. `reviewed`
7. `included_in_period_draft`

Required evidence retained at every stage:
- original file or message artifact
- extraction output with confidence
- normalized fields with provenance
- interpretation decision or review reason

### 5.2.1 Per-document decision table

| Document family | Automatable actions | Mandatory review triggers | Expected draft output |
| --- | --- | --- | --- |
| Outbound invoice | classify, extract totals, identify period candidate, propose income entry | missing customer identity, inconsistent totals, corrective wording | proposed sales entry + VAT candidate + evidence refs |
| Inbound invoice | classify, extract supplier/date/totals, suggest expense category | missing supplier, ambiguous VAT, unusual tax wording, duplicate risk | proposed expense entry + deductibility candidate + evidence refs |
| Simplified receipt | extract merchant/date/total, suggest expense type | low image quality, unclear business purpose, no tax breakdown when material | draft expense item with review reason if not routine |
| Credit/corrective document | classify as correction candidate, attempt linkage | original missing, unclear correction scope, sign reversal uncertainty | draft correction envelope linked to original or flagged exception |
| Bank transaction support | ingest movement metadata, attempt document match | no support document, conflicting amount/date, duplicate match candidates | unmatched movement exception or linked payment hint |
| Non-bookable / unknown | preserve file, assign reason code, keep visible | always | visible exception record with operator disposition required |

### 5.3 Workflow C: VAT-support cycle

1. Aggregate reviewed entries for the tax period
2. Separate transactions into sales, purchases, corrections, and unresolved items
3. Compute draft VAT-support totals from reviewed entries only
4. Flag exclusions and unresolved items explicitly
5. Produce operator summary:
- totals used
- items excluded
- reason codes
- pending client requests
- required reviewer actions
6. Mark case as `ready_for_approval` only when unresolved material items are either reviewed or explicitly deferred with operator sign-off
7. Keep actual filing submission out of automated scope

## 6. Source Document to Ledger Logic

The product should transform source documents into proposed ledger records through a constrained ruleset, not free-form narrative reasoning.

### 6.1 Canonical input objects

Each intake item should normalize into one of these document families:
- outbound invoice
- inbound invoice
- simplified receipt
- credit/corrective document
- bank transaction support
- non-bookable document
- unknown document

### 6.2 Canonical normalized fields

Minimum normalized fields:
- client entity
- period candidate
- document family
- issue date
- supplier or customer identity as captured
- currency
- base amount
- tax amount
- total amount
- payment status if observable
- source references
- confidence band
- review reason codes

Optional but high-value fields:
- invoice number
- counterparty tax identifier
- tax rate candidates
- expense category candidate
- deductible/not-deductible suggestion
- linked bank movement

### 6.3 Proposed ledger-entry envelope

Every interpreted item should yield a proposed accounting envelope:
- `entry_type`
- `document_role`
- `counterparty`
- `amounts`
- `tax_treatment_candidate`
- `expense_or_income_category_candidate`
- `deductibility_status`
- `review_required`
- `review_reason_codes`
- `evidence_refs`

The system may propose categories and tax treatment, but the canonical accepted ledger effect exists only after operator review rules are satisfied.

### 6.4 Automation boundaries for transformation

Automate:
- file capture and dedup hints
- document-family classification
- extraction of obvious fields
- normalization of totals and dates
- duplicate detection
- draft grouping by period and client
- confidence and exception scoring

Operator-reviewed:
- unusual VAT treatment
- corrective-document handling
- partial-deductibility judgments
- missing or contradictory supplier identity
- mixed personal/business expenses
- transactions lacking source support
- any material override to draft totals

### 6.5 Reviewability rule for proposed ledger effects

No proposed ledger effect may be treated as routine unless all of the following are true:
- document family is resolved to a single candidate
- normalized totals reconcile internally
- tax treatment candidate is within validated scope for the wedge
- counterparty and period candidate are present or explicitly non-material
- no mandatory review reason code is active

If any condition fails, the item remains review-visible and cannot flow into period totals as a routine inclusion.

## 7. Review and Exception Model

### 7.1 Mandatory review triggers

An item must go to human review when any of these apply:
- confidence band is `Low`
- totals do not reconcile internally
- multiple document families remain plausible
- VAT amount is missing, contradictory, or not derivable safely
- duplicate probability is high but not certain
- document suggests corrective or reversal behavior
- counterparty identity is missing for a material invoice
- business purpose is unclear for an expense
- bank movement lacks matching source evidence
- document is foreign-language, foreign-currency, or cross-border and rules are not validated

### 7.2 Review outcomes

Human review can result in:
- approve suggestion
- edit normalized fields
- edit bookkeeping/tax interpretation
- mark as non-bookable
- defer from period
- request client information
- escalate to specialist review

### 7.3 Case blocking rules

A period case should move to `blocked` when:
- required source documents are materially missing
- a reviewer cannot resolve the item from existing evidence
- the client has not answered a blocking request
- a policy or legal interpretation is unresolved
- the period contains unresolved items that materially affect summary outputs

### 7.4 Exception triage buckets

Exceptions should not appear as one generic queue. The first fiscal wedge needs visible separation between:

- `data_quality`: OCR failure, unreadable file, multi-document ambiguity
- `document_logic`: duplicate, corrective chain, period mismatch, missing counterparty
- `tax_logic`: VAT ambiguity, deductibility ambiguity, cross-border/unvalidated treatment
- `workflow_blocker`: missing client response, missing source support, unresolved specialist decision
- `period_risk`: late-arriving item, draft changed after approval, material exclusions near close

Each exception must store:
- primary bucket
- reason code
- severity (`low|medium|high`)
- whether operator review alone can resolve it
- whether client input is required
- whether specialist validation is required

### 7.5 Human-review service-level expectation

This is an operating target, not a legal commitment:

- routine queue: items should be approvable in batch with evidence summaries
- exception queue: reviewer should understand the problem in under one minute from the review card
- blocked queue: each blocked case should show exactly who must act next and why

If an exception card cannot explain itself quickly, the product has failed the workflow design even if the underlying model is correct.

## 8. Domain Rules and Acceptance Criteria

### 8.1 Intake and evidence

Rules:
- No document may be processed without a durable source reference.
- Every extracted fiscal field must trace to source evidence.
- A document classified as `unknown` cannot silently disappear from the queue.

Acceptance criteria:
- Operators can open any document and see the source artifact plus extracted fields.
- Unknown or non-bookable items remain visible with explicit disposition.
- Duplicate candidates are surfaced before period approval.

### 8.2 Bookkeeping normalization

Rules:
- Proposed entries must be company- and period-scoped.
- Totals must reconcile before an item can be auto-routed as routine.
- Contradictory fields must lower confidence and produce reason codes.

Acceptance criteria:
- The system stores normalized amounts separately from raw OCR text.
- An operator can see which fields were inferred versus directly extracted.
- Items with inconsistent totals cannot reach `ready_for_approval` without review.

### 8.3 VAT-support package

Rules:
- Draft VAT-support totals must be computed only from reviewed or explicitly approved items.
- Excluded items must remain listed with reasons.
- No output should imply that a filing has been submitted.

Acceptance criteria:
- Period summary shows included totals, excluded totals, and unresolved items separately.
- The operator can inspect all transactions contributing to a summary figure.
- The package includes a clear warning when any material item is excluded or deferred.

### 8.4 Human review and explainability

Rules:
- Confidence without reason is not acceptable.
- High-risk items must remain review-visible until disposition.
- Overrides must capture reviewer identity and rationale.

Acceptance criteria:
- Every review item exposes confidence band, reason codes, and evidence links.
- Operator overrides are logged with before/after values.
- Review decisions can be reconstructed later from the audit trail.

### 8.5 Period close readiness

Rules:
- A case cannot become `ready_for_approval` while any material item lacks a disposition.
- Deferred items must remain attached to the case and period summary.
- Late-arriving items after draft freeze must produce a visible re-open event or explicit defer decision.

Acceptance criteria:
- The period summary exposes counts and amounts for `included`, `excluded`, `deferred`, and `awaiting_client`.
- Operators can see which late items changed the draft after the first freeze.
- A reviewer can identify in one screen whether the case is approval-ready or only draft-ready.

### 8.6 Client follow-up workflow

Rules:
- Missing information requests must reference the exact item or exception that triggered the request.
- Client responses may resume automation, but they do not bypass review if the original risk remains.
- Client silence must remain visible as an operational blocker, not disappear into a background state.

Acceptance criteria:
- Every client request links to the triggering document or unresolved movement.
- A case returning from client response re-enters the queue with a visible `updated_by_client` signal.
- Operators can distinguish between missing-document blockers and pure internal-review blockers.

## 9. Edge-Case List for MVP

These should be visible as first-class exception types, even if resolution remains manual.

### 9.1 Document-quality edge cases

- blurry or cropped receipt
- multi-page invoice with totals only on final page
- duplicate upload with different filenames
- forwarded email with multiple attachments and unclear primary document
- unreadable tax identifier

### 9.2 Commercial-document edge cases

- invoice and receipt both uploaded for the same purchase
- corrective invoice referencing a missing original
- invoice with line-level tax complexity but incomplete extraction
- supplier name mismatch across pages
- payment proof without invoice

### 9.3 Accounting-interpretation edge cases

- mixed business/personal expense
- recurring SaaS charge with missing invoice
- cash expense without proper support
- subscription renewal charged in foreign currency
- bank fee or interest item with limited support docs

### 9.4 Tax-treatment edge cases

- unclear or mixed VAT rate signals
- exempt/non-subject wording detected but not validated
- intra-EU or non-Spain transaction
- reverse-charge-like language present
- deductible status depends on factual business use not present in evidence

### 9.5 Workflow edge cases

- client uploads documents after the period draft is prepared
- operator overrides a previously approved item
- same document appears in two client workspaces
- material unresolved item exists near filing deadline
- multiple low-confidence items create period-level uncertainty even if each item is small

### 9.6 Entity-setup edge cases

- autonomo using one bank account for mixed personal and business activity
- micro-SL with partner-paid expense later reimbursed by company
- client changes tax regime assumptions mid-period without clean evidence trail
- advisory receives historical backlog documents mixed with current-period intake
- multiple establishments or activities exist but client setup is incomplete

### 9.7 Product handling rule for all edge cases

For MVP, edge cases must resolve to one of four visible outcomes:
- `operator_can_resolve`
- `client_input_required`
- `specialist_validation_required`
- `out_of_scope_manual_process`

No edge case may end in an implicit discard, hidden warning, or silent summary exclusion.

## 10. Example Client Journeys

### 10.1 Journey A: routine autonomo month

Profile:
- autonomo with recurring local invoices and standard operating expenses
- uploads monthly sales invoices, supplier invoices, and receipts

Expected flow:
1. Documents arrive and classify cleanly
2. Most totals reconcile without contradiction
3. A small set of receipts route to review for business-purpose confirmation
4. Operator approves routine batch and resolves flagged receipts
5. Period summary is generated with all included items visible
6. VAT-support package becomes approval-ready

Expected outputs:
- reviewed entry list for the month
- explicit excluded-item list, ideally empty
- operator-ready VAT-support summary
- audit trail linking each total back to source documents

### 10.2 Journey B: micro-SL with missing purchase support

Profile:
- micro-SL with regular supplier invoices and bank movements
- several bank charges appear without matching invoice support

Expected flow:
1. Invoices classify and normalize normally
2. Unmatched bank movements are flagged, not auto-booked as routine expenses
3. Client receives a request for missing supporting documents
4. Case status moves to `waiting_on_client` or `blocked` depending on materiality
5. Period draft is generated with exclusions clearly separated

Expected outputs:
- reviewed purchase/sales entries
- unresolved movement list with reason `missing_support_document`
- client request log
- summary warning that draft totals exclude unresolved items

### 10.3 Journey C: expense with ambiguous deductibility

Profile:
- autonomo uploads a restaurant receipt during a travel week

Expected flow:
1. Receipt is classified and extracted
2. Amounts reconcile, but business purpose is not provable from evidence
3. Item routes to mandatory review with reason code for ambiguous deductibility
4. Operator can approve, partially include, defer, or request clarification

Expected outputs:
- item visible in review cockpit
- no silent inclusion in routine batch
- reviewer decision and rationale captured in audit log

### 10.4 Journey D: corrective-document chain

Profile:
- micro-SL uploads a corrective invoice after an original invoice was already processed

Expected flow:
1. Document is classified as corrective/correction candidate
2. System tries to link the original and flags if missing
3. Human review is required before period totals update
4. Revised summary shows effect of correction and related evidence

Expected outputs:
- linked original/corrective pair or explicit missing-link exception
- review decision before totals are recomputed into approval package
- period summary change history visible to operator

### 10.5 Journey E: mixed-use autonomo bank account

Profile:
- autonomo uses a single bank account for business income, supplier payments, and personal card settlements

Expected flow:
1. Bank movements are imported or uploaded as support context
2. System links clear invoice-backed movements where possible
3. Personal-looking or unsupported movements remain unbooked and visible
4. Operator reviews only the unresolved subset instead of the full bank list
5. Case summary distinguishes invoice-backed items from unsupported bank activity

Expected outputs:
- linked movement-to-document suggestions with confidence
- visible list of unsupported or likely personal movements
- no automatic routine expense entry based only on bank text
- operator note trail for any manual inclusion decision

### 10.6 Journey F: late supplier invoice after draft freeze

Profile:
- micro-SL period draft was prepared, then a supplier invoice for the same period arrives two days later

Expected flow:
1. New document lands in the existing case and is tagged `late_arriving_document`
2. System does not silently recalculate the frozen summary
3. Operator decides whether to reopen the draft or defer the item
4. Audit trail records who made the decision and what changed

Expected outputs:
- visible late-arrival banner on the case
- before/after draft summary if reopened
- explicit defer reason if left out of the current package

### 10.7 Expected output objects for the first product slice

For each case, the product should be able to render these operator-facing outputs:

1. `document_disposition_list`
- every received item
- current state
- review reason codes
- final disposition

2. `review_queue_snapshot`
- items pending operator action
- grouped by exception bucket and severity

3. `period_summary`
- included totals
- excluded totals
- deferred totals
- unresolved item counts

4. `evidence_bundle`
- source refs
- normalized fields with provenance
- review decisions
- summary assumptions and warnings

## 11. Operator-Facing Reason Codes

Initial reason-code set for fiscal review:
- `unknown_document_type`
- `low_extraction_confidence`
- `amount_mismatch`
- `missing_tax_amount`
- `ambiguous_vat_treatment`
- `ambiguous_deductibility`
- `possible_duplicate`
- `missing_counterparty_identity`
- `missing_support_document`
- `corrective_document_detected`
- `cross_border_unvalidated`
- `period_mismatch`
- `late_arriving_document`

These should be stable enough for queueing, reporting, and QA datasets.

Recommended additions for workflow control:
- `updated_by_client`
- `materiality_threshold_exceeded`
- `specialist_validation_required`
- `mixed_use_indicator`
- `draft_reopened_after_freeze`

## 12. QA and Audit Expectations for the Fiscal Domain

The fiscal workflow is acceptable for MVP only if QA can verify:
- each period summary can be reproduced from stored reviewed items
- each reviewed item retains source evidence and decision trail
- unresolved items remain visible at both item and period level
- automation never marks a fiscal-impacting ambiguity as complete without a review path

Recommended golden dataset composition:
- routine domestic invoice set
- duplicate and near-duplicate examples
- missing-support bank movements
- low-quality receipt images
- corrective-document scenarios
- ambiguous deductibility scenarios
- cross-border/unvalidated scenarios

Minimum fiscal acceptance test pack:
- one autonomo routine month with no material exceptions
- one micro-SL month with unresolved bank-support gaps
- one corrective-document chain that changes prior draft totals
- one late-arriving document scenario after draft freeze
- one mixed-use expense scenario requiring operator judgment

## 13. Open Questions for Board or Specialist Validation

- Which filing-support outputs should be productized first as draft artifacts versus operator-only internal summaries?
- What exact level of chart-of-accounts opinionation is acceptable for the target advisory segment?
- Which VAT edge cases must be validated before pilot claims are made?
- What is the materiality policy for period completion when unresolved items remain?
- Which operator roles can approve what kinds of fiscal overrides?

## 14. Implementation Guidance Summary

Build the first fiscal wedge around one repeatable promise:
the operator can move from raw monthly documents to a reviewable bookkeeping and VAT-support draft with better traceability than a spreadsheet-and-email workflow.

Do not optimize for silent autoposting.
Optimize for:
- explicit evidence
- stable review queues
- period-level visibility
- operator override logging
- visible exceptions instead of hidden uncertainty

## 15. Initial Implementation Priorities

To stay inside the wedge, implement in this order:

1. stable intake and document disposition tracking
2. constrained source-to-ledger proposal logic for routine domestic documents
3. review cockpit reason codes and exception buckets
4. period summary with included/excluded/deferred visibility
5. client request loop for missing support
6. corrective and late-arriving document handling

Avoid first-wave implementation of:
- generalized bookkeeping flexibility that hides rules inside configuration sprawl
- automatic bank-booking without source support
- implied filing readiness when unresolved material items remain
- advanced tax-regime branching not yet validated
