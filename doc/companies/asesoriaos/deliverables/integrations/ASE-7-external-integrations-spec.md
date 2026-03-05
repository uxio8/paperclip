# ASE-7 External Integrations Specification

Date: 2026-03-05
Owner: Integrations Engineer
Source: Paperclip issue comment snapshot

## Update

Delivered the initial external integration specification for AsesoriaOS with mock-first boundaries and explicit side-effect controls.

### 1) Integration Matrix

| Provider domain | Example providers (Spain-focused) | Read-only capabilities (phase 1) | Side-effecting capabilities (phase 2+) | Mock-first strategy | Notes |
|---|---|---|---|---|---|
| AEAT (tax) | AEAT SII, censal/tax status services, filing portals | Pull tax status, filing history metadata, obligation calendars, validation errors | Submit filings, amendments, payments, cancellations | Build deterministic sandbox adapters returning known AEAT-like states/errors | Treat all filing actions as regulated side effects requiring explicit operator approval. |
| TGSS (social security) | RED/SILTRA-compatible gateways, auth proxies | Read worker/company affiliation status, contribution obligations, submission receipts | Submit afiliacion/alta-baja changes, contribution files, corrections | Contract-test mocks for contribution periods, worker states, and rejection codes | Payroll-adjacent scope remains limited in V1; prefer read-only observability first. |
| Banking | PSD2 aggregators and Spanish bank APIs | Read account balances, transactions, account metadata | Initiate transfers, direct debit mandates, payment orders | Use replayable ledger fixtures + idempotency simulation in mocks | Payments and mandates are high-risk side effects; enforce dual control. |
| Signature | Qualified/advanced e-sign providers | Read envelope status, signer audit trail, document hash | Create envelopes, send signature requests, void/cancel envelopes | Mock signature lifecycle states (draft/sent/signed/declined/expired) | Signature events must be fully audit-linked to document evidence bundle. |
| OCR / Document AI | OCR engines + invoice parsers | Extract text, fields, confidence scores, classification labels | Reprocessing jobs that overwrite canonical parsed output | Mock OCR outputs with controlled confidence/ambiguity cases | Never auto-commit fiscal fields below confidence threshold without human review. |
| Document providers | Cloud drives, email ingestion, DMS | List/fetch documents + metadata, webhook receipt notifications | Delete/move/tag externally, upload signed artifacts | Mock document stores with immutable sample corpus | Keep provider-specific metadata out of core domain objects. |

### 2) API Capability Notes

- Authentication assumptions
  - Per-provider credential vault references, never raw secrets in domain tables.
  - Token lifecycle explicit: issued_at, expires_at, refresh_before, last_refresh_result.
  - Provider auth methods normalized as `oauth2`, `certificate`, `api_key`, `user_delegated_session`.
- Capability model
  - Every connector endpoint is tagged `read_only` or `side_effect`.
  - Side-effect endpoints require `approval_token` + `operator_id` + `reason`.
  - Core services can call read-only without approval token, but must propagate `trace_id`.
- Reliability model
  - Retries only for transient classes (`timeout`, `429`, `5xx`, transport reset).
  - No automatic retries for business-rule rejections (e.g., validation errors, duplicate filing semantic failures).
  - Idempotency keys mandatory for side effects; key scope: `provider + tenant + action + business_reference`.
- Observability and audit
  - Every external call logs: connector, capability, mode (`mock`/`live`), request fingerprint, response code, attempt count, latency, trace_id.
  - Side effects additionally log approval artifact reference and operator actor.

### 3) Connectivity Risk Analysis

- Credential and auth fragility
  - Risk: token expiry or delegated session revocation breaks unattended operations.
  - Mitigation: proactive refresh window + fallback to `blocked` workflow with operator re-auth task.
- Regulatory side-effect risk
  - Risk: accidental live filing/payment/signature execution from non-approved flows.
  - Mitigation: hard runtime guard requiring explicit approval token and live-mode feature flag per connector.
- Provider variability and undocumented behavior
  - Risk: inconsistent error semantics across AEAT/TGSS/banks produce wrong retry behavior.
  - Mitigation: provider-specific error map translated into canonical error classes with conformance tests.
- Webhook integrity and replay
  - Risk: forged or duplicated provider callbacks alter workflow state.
  - Mitigation: signature verification, nonce/replay window checks, idempotent event processing.
- Data quality from OCR
  - Risk: low-confidence extraction contaminates accounting normalization.
  - Mitigation: threshold gating + human verification queue + immutable raw evidence retention.

### 4) Interface Contracts (Internal Tools)

- `IntegrationConnector`
  - `getCapabilities(): CapabilityDescriptor[]`
  - `invokeRead(request: ReadRequest): ReadResult`
  - `invokeSideEffect(request: SideEffectRequest): SideEffectResult`
- `CapabilityDescriptor`
  - `capability_key`, `mode` (`read_only` | `side_effect`), `idempotent`, `supports_mock`, `required_scopes[]`.
- `ReadRequest`
  - `tenant_id`, `trace_id`, `capability_key`, `payload`, `consistency` (`best_effort` | `strict`).
- `SideEffectRequest`
  - `tenant_id`, `trace_id`, `capability_key`, `payload`, `idempotency_key`, `approval_token`, `operator_id`, `reason`.
- `ConnectorResult` (common response envelope)
  - `status` (`success` | `transient_failure` | `permanent_failure` | `business_rejected`), `provider_code`, `normalized_code`, `message`, `raw_ref`, `attempt`.

### Guardrails Applied to Charter

- No real side effects are enabled by this spec; all execution assumptions are mock-first.
- Side-effect paths are separated from read-only paths at interface level.
- Approval gate requirement is explicit for AEAT, TGSS, banking, and signature actions.
- Auditability and explainability are built into call envelopes and logs.
