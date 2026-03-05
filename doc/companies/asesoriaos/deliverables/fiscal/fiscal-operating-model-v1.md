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
