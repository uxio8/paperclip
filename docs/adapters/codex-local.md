---
title: Codex Local
summary: OpenAI Codex local adapter setup and configuration
---

The `codex_local` adapter runs OpenAI's Codex CLI locally. It supports session persistence via `previous_response_id` chaining and skills injection through the global Codex skills directory.

## Prerequisites

- Codex CLI installed (`codex` command available)
- One of:
  - `OPENAI_API_KEY` set in the environment or agent config
  - an existing `codex login` session in `CODEX_HOME`
  - a controlplane-style Codex session pool (`codex_account_pool.json` + `codex_session_store/`)

## Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cwd` | string | Yes | Working directory for the agent process (absolute path; created automatically if missing when permissions allow) |
| `model` | string | No | Model to use |
| `promptTemplate` | string | No | Prompt used for all runs |
| `env` | object | No | Environment variables (supports secret refs) |
| `skipGitRepoCheck` | boolean | No | Pass `--skip-git-repo-check` to Codex (defaults to `true`) |
| `timeoutSec` | number | No | Process timeout (0 = no timeout) |
| `graceSec` | number | No | Grace period before force-kill |
| `dangerouslyBypassApprovalsAndSandbox` | boolean | No | Skip safety checks (dev only) |

Default baseline model: `gpt-5.4`

## Authentication Modes

Paperclip now resolves Codex auth in this order:

1. `PAPERCLIP_CODEX_AUTH_MODE=api_key` forces `OPENAI_API_KEY`
2. `PAPERCLIP_CODEX_AUTH_MODE=session_pool` forces a pool-backed ChatGPT session
3. `PAPERCLIP_CODEX_AUTH_MODE=local_login` forces `codex login` / `CODEX_HOME`
4. `auto` prefers API key when present, otherwise session pool, otherwise local login

Useful env vars in `adapterConfig.env`:

- `PAPERCLIP_CODEX_AUTH_MODE`
- `PAPERCLIP_CODEX_SESSION_POOL_FILE`
- `PAPERCLIP_CODEX_SESSION_STORE_DIR`
- `PAPERCLIP_CODEX_SESSION_ID` (optional pin)
- `PAPERCLIP_CODEX_SESSION_PICK=round_robin|first`

If no explicit pool file is provided, Paperclip also auto-discovers controlplane-style pools under `~/Documents/Desarrollos/*/planning/state/codex_account_pool.json`.

## Session Persistence

Codex uses `previous_response_id` for session continuity. The adapter serializes and restores this across heartbeats, allowing the agent to maintain conversation context.

## Skills Injection

The adapter symlinks Paperclip skills into the active Codex home (`$CODEX_HOME/skills` or `~/.codex/skills`). Existing user skills are not overwritten.

## Environment Test

The environment test checks:

- Codex CLI is installed and accessible
- Working directory is absolute and available (auto-created if missing and permitted)
- Authentication readiness via API key, local login, or session pool
- A live hello probe (`codex exec --json -` with prompt `Respond with hello.`) to verify the CLI can actually run

## GPT-5.4 and Fast Mode

Paperclip now defaults `codex_local` to `gpt-5.4`.

If you authenticate Codex through a ChatGPT-backed local login or session pool, avoid `gpt-5-mini` unless you have verified support on that account type. In current local testing, ChatGPT-backed sessions can reject it with "model ... is not supported when using Codex with a ChatGPT account."

OpenAI documents Codex fast mode for GPT-5.4 as an interactive/session-level feature. In local testing with `codex-cli 0.108.0-alpha.12`, `codex exec` can run `gpt-5.4`, but there is not yet a stable documented non-interactive Paperclip adapter flag for a `fast` versus `standard` toggle.

Current Paperclip stance:

- `gpt-5.4` is safe to use as the default model.
- `fast mode` is not exposed as a first-class stable adapter field yet.
- If OpenAI ships a stable non-interactive CLI/config surface for service tier or fast mode, Paperclip can add a dedicated adapter setting without changing the run model.
