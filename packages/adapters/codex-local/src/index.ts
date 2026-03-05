export const type = "codex_local";
export const label = "Codex (local)";
export const DEFAULT_CODEX_LOCAL_MODEL = "gpt-5.4";
export const DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX = true;

export const models = [
  { id: DEFAULT_CODEX_LOCAL_MODEL, label: DEFAULT_CODEX_LOCAL_MODEL },
  { id: "gpt-5.3-codex", label: "gpt-5.3-codex" },
  { id: "gpt-5.3-codex-spark", label: "gpt-5.3-codex-spark" },
  { id: "gpt-5", label: "gpt-5" },
  { id: "o3", label: "o3" },
  { id: "o4-mini", label: "o4-mini" },
  { id: "gpt-5-nano", label: "gpt-5-nano" },
  { id: "o3-mini", label: "o3-mini" },
  { id: "codex-mini-latest", label: "Codex Mini" },
];

export const agentConfigurationDoc = `# codex_local agent configuration

Adapter: codex_local

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- instructionsFilePath (string, optional): absolute path to a markdown instructions file prepended to stdin prompt at runtime
- model (string, optional): Codex model id
- modelReasoningEffort (string, optional): reasoning effort override (minimal|low|medium|high) passed via -c model_reasoning_effort=...
- promptTemplate (string, optional): run prompt template
- search (boolean, optional): run codex with --search
- skipGitRepoCheck (boolean, optional): pass --skip-git-repo-check (defaults to true)
- dangerouslyBypassApprovalsAndSandbox (boolean, optional): run with bypass flag
- command (string, optional): defaults to "codex"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- Prompts are piped via stdin (Codex receives "-" prompt argument).
- Paperclip auto-injects local skills into Codex personal skills dir ("$CODEX_HOME/skills" or "~/.codex/skills") when missing, so Codex can discover "$paperclip" and related skills.
- Authentication can come from OPENAI_API_KEY, an existing "codex login" session, or a controlplane-style session pool exposed via env vars:
  - PAPERCLIP_CODEX_AUTH_MODE=session_pool|local_login|api_key|auto
  - PAPERCLIP_CODEX_SESSION_POOL_FILE=/path/to/codex_account_pool.json
  - PAPERCLIP_CODEX_SESSION_STORE_DIR=/path/to/codex_session_store
  - PAPERCLIP_CODEX_SESSION_ID=<optional pinned session id>
- GPT-5.4 is the default baseline model for Codex runs in Paperclip.
- ChatGPT-backed Codex sessions may reject some API-style model ids such as \`gpt-5-mini\`; for local-login/session-pool setups, prefer \`gpt-5.4\` or another model you have validated on that account type.
- Codex "fast mode" is currently exposed by OpenAI as an interactive/session-level feature. Paperclip's non-interactive \`codex exec\` adapter does not expose a stable fast/standard toggle yet.
- Some model/tool combinations reject certain effort levels (for example minimal with web search enabled).
`;
