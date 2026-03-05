import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AdapterEnvironmentCheck } from "@paperclipai/adapter-utils";

type CodexAuthMode = "auto" | "api_key" | "local_login" | "session_pool";
type CodexAuthSource = "api_key" | "local_login" | "session_pool" | "none";
type SessionPickMode = "round_robin" | "first";

interface SessionPoolAccount {
  id: string;
  sessionId: string;
}

interface AuthValidation {
  ok: boolean;
  reason: string;
}

export interface PreparedCodexAuth {
  source: CodexAuthSource;
  env: Record<string, string>;
  billingType: "api" | "subscription";
  codexHome: string;
  commandNotes: string[];
  check: AdapterEnvironmentCheck;
  cleanup: () => Promise<void>;
}

interface PrepareCodexAuthOptions {
  env: Record<string, string>;
  agentId: string;
  runId: string;
  purpose: "run" | "envtest";
  advancePool: boolean;
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function expandHomePrefix(value: string): string {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.resolve(os.homedir(), value.slice(2));
  return value;
}

function resolvePath(raw: string, baseDir = process.cwd()): string {
  const expanded = expandHomePrefix(raw.trim());
  return path.isAbsolute(expanded) ? path.resolve(expanded) : path.resolve(baseDir, expanded);
}

function sanitizePathSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-") || "default";
}

function hasOwn(record: Record<string, string>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function getEffectiveEnvValue(env: Record<string, string>, key: string): string {
  if (hasOwn(env, key)) return env[key] ?? "";
  return process.env[key] ?? "";
}

function hasEffectiveEnvValue(env: Record<string, string>, key: string): boolean {
  return isNonEmpty(getEffectiveEnvValue(env, key));
}

function resolveAuthMode(env: Record<string, string>): CodexAuthMode {
  const raw = (
    getEffectiveEnvValue(env, "PAPERCLIP_CODEX_AUTH_MODE") ||
    getEffectiveEnvValue(env, "AUTOPILOT_CODEX_AUTH_MODE")
  )
    .trim()
    .toLowerCase();

  switch (raw) {
    case "api":
    case "api_key":
    case "apikey":
      return "api_key";
    case "local":
    case "login":
    case "local_login":
    case "codex_login":
    case "cli_login":
      return "local_login";
    case "pool":
    case "session_pool":
    case "session-pool":
    case "cli_pool":
    case "chatgpt_session_pool":
      return "session_pool";
    default:
      return "auto";
  }
}

function resolveConfiguredCodexHome(env: Record<string, string>): string {
  const raw =
    getEffectiveEnvValue(env, "CODEX_HOME") ||
    getEffectiveEnvValue(env, "AUTOPILOT_CODEX_HOME");
  if (isNonEmpty(raw)) return resolvePath(raw);
  return path.resolve(os.homedir(), ".codex");
}

function resolvePoolFileOverride(env: Record<string, string>): string {
  return (
    getEffectiveEnvValue(env, "PAPERCLIP_CODEX_SESSION_POOL_FILE") ||
    getEffectiveEnvValue(env, "AUTOPILOT_CODEX_ACCOUNT_POOL_FILE")
  ).trim();
}

function resolveStoreDirOverride(env: Record<string, string>): string {
  return (
    getEffectiveEnvValue(env, "PAPERCLIP_CODEX_SESSION_STORE_DIR") ||
    getEffectiveEnvValue(env, "AUTOPILOT_CODEX_SESSION_STORE_DIR")
  ).trim();
}

function resolvePinnedSessionId(env: Record<string, string>): string {
  return (
    getEffectiveEnvValue(env, "PAPERCLIP_CODEX_SESSION_ID") ||
    getEffectiveEnvValue(env, "AUTOPILOT_CODEX_SESSION_ID")
  ).trim();
}

function resolveSessionPickMode(env: Record<string, string>): SessionPickMode {
  const raw = (
    getEffectiveEnvValue(env, "PAPERCLIP_CODEX_SESSION_PICK") ||
    getEffectiveEnvValue(env, "PAPERCLIP_CODEX_SESSION_SELECTION")
  )
    .trim()
    .toLowerCase();
  return raw === "first" ? "first" : "round_robin";
}

function resolvePoolDiscoveryRoot(env: Record<string, string>): string {
  const raw = getEffectiveEnvValue(env, "PAPERCLIP_CODEX_POOL_DISCOVERY_ROOT").trim();
  if (raw) return resolvePath(raw);
  return path.resolve(os.homedir(), "Documents", "Desarrollos");
}

function resolveCodexHomeBaseDir(env: Record<string, string>): string {
  const raw = (
    getEffectiveEnvValue(env, "PAPERCLIP_CODEX_HOME_BASE_DIR") ||
    getEffectiveEnvValue(env, "AUTOPILOT_CODEX_HOME")
  ).trim();
  if (raw) return resolvePath(raw);
  return path.resolve(os.tmpdir(), "paperclip-codex-homes");
}

function defaultRotationStateFile(poolFile: string): string {
  const parsed = path.parse(poolFile);
  return path.join(parsed.dir, `${parsed.name}.paperclip-rotation.json`);
}

function resolveRotationStateFile(env: Record<string, string>, poolFile: string): string {
  const raw = getEffectiveEnvValue(env, "PAPERCLIP_CODEX_SESSION_STATE_FILE").trim();
  if (raw) return resolvePath(raw);
  return defaultRotationStateFile(poolFile);
}

function maskIdentifier(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}***`;
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

async function exists(filePath: string): Promise<boolean> {
  return fs.stat(filePath).then(() => true).catch(() => false);
}

async function validateAuthJson(filePath: string): Promise<AuthValidation> {
  if (!(await exists(filePath))) {
    return { ok: false, reason: "auth_file_missing" };
  }

  try {
    const payload = JSON.parse(await fs.readFile(filePath, "utf8")) as Record<string, unknown>;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return { ok: false, reason: "invalid_shape" };
    }

    const tokens =
      typeof payload.tokens === "object" && payload.tokens !== null && !Array.isArray(payload.tokens)
        ? (payload.tokens as Record<string, unknown>)
        : null;
    if (tokens && isNonEmpty(tokens.refresh_token) && isNonEmpty(tokens.access_token)) {
      return { ok: true, reason: "chatgpt_tokens_present" };
    }
    if (isNonEmpty(payload.OPENAI_API_KEY)) {
      return { ok: true, reason: "api_key_present" };
    }
    return { ok: false, reason: "missing_expected_fields" };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}

async function discoverPoolFile(env: Record<string, string>): Promise<string | null> {
  const explicit = resolvePoolFileOverride(env);
  if (explicit) {
    const resolved = resolvePath(explicit);
    return (await exists(resolved)) ? resolved : null;
  }

  const discoveryRoot = resolvePoolDiscoveryRoot(env);
  const preferred = path.resolve(
    discoveryRoot,
    "codex-controlplane-core-main",
    "planning",
    "state",
    "codex_account_pool.json",
  );
  if (await exists(preferred)) return preferred;

  const rootExists = await fs.stat(discoveryRoot).then((stats) => stats.isDirectory()).catch(() => false);
  if (!rootExists) return null;

  const entries = await fs.readdir(discoveryRoot, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = path.resolve(
      discoveryRoot,
      entry.name,
      "planning",
      "state",
      "codex_account_pool.json",
    );
    if (await exists(candidate)) return candidate;
  }
  return null;
}

async function resolveSessionStoreDir(env: Record<string, string>, poolFile: string): Promise<string | null> {
  const explicit = resolveStoreDirOverride(env);
  if (explicit) {
    const resolved = resolvePath(explicit);
    return (await exists(resolved)) ? resolved : null;
  }

  const sibling = path.resolve(path.dirname(poolFile), "codex_session_store");
  if (await exists(sibling)) return sibling;
  return null;
}

async function loadPoolAccounts(poolFile: string): Promise<SessionPoolAccount[]> {
  try {
    const payload = JSON.parse(await fs.readFile(poolFile, "utf8")) as { accounts?: unknown };
    const rawAccounts = Array.isArray(payload.accounts) ? payload.accounts : [];
    const accounts: SessionPoolAccount[] = [];
    for (const item of rawAccounts) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
      const record = item as Record<string, unknown>;
      if (record.enabled === false) continue;
      if (String(record.auth_mode ?? "").trim() !== "chatgpt_session") continue;
      const sessionId = String(record.session_id ?? "").trim();
      if (!sessionId) continue;
      accounts.push({
        id: String(record.id ?? "").trim() || sessionId,
        sessionId,
      });
    }
    return accounts;
  } catch {
    return [];
  }
}

async function withLock<T>(lockFile: string, fn: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  while (true) {
    let handle: Awaited<ReturnType<typeof fs.open>> | null = null;
    try {
      await fs.mkdir(path.dirname(lockFile), { recursive: true });
      handle = await fs.open(lockFile, "wx");
      const result = await fn();
      await handle.close();
      await fs.rm(lockFile, { force: true });
      return result;
    } catch (err) {
      if (handle) {
        await handle.close().catch(() => {});
        await fs.rm(lockFile, { force: true }).catch(() => {});
      }
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw err;
      if (Date.now() - startedAt > 5_000) {
        throw new Error(`Timed out acquiring Codex session pool lock: ${lockFile}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

async function pickPoolAccount(
  env: Record<string, string>,
  poolFile: string,
  accounts: SessionPoolAccount[],
  advance: boolean,
): Promise<SessionPoolAccount | null> {
  const pinnedSessionId = resolvePinnedSessionId(env);
  if (pinnedSessionId) {
    return accounts.find((account) => account.sessionId === pinnedSessionId) ?? null;
  }

  if (accounts.length === 0) return null;
  const pickMode = resolveSessionPickMode(env);
  if (pickMode === "first" || accounts.length === 1) {
    return accounts[0] ?? null;
  }

  const stateFile = resolveRotationStateFile(env, poolFile);
  const select = async () => {
    let nextIndex = 0;
    try {
      const raw = JSON.parse(await fs.readFile(stateFile, "utf8")) as { nextIndex?: unknown };
      if (typeof raw.nextIndex === "number" && Number.isFinite(raw.nextIndex)) {
        nextIndex = raw.nextIndex;
      }
    } catch {
      nextIndex = 0;
    }

    const normalizedIndex = ((nextIndex % accounts.length) + accounts.length) % accounts.length;
    const selected = accounts[normalizedIndex] ?? accounts[0] ?? null;
    if (advance && selected) {
      await fs.mkdir(path.dirname(stateFile), { recursive: true });
      await fs.writeFile(
        stateFile,
        JSON.stringify(
          {
            nextIndex: (normalizedIndex + 1) % accounts.length,
            lastSessionId: selected.sessionId,
            updatedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
        "utf8",
      );
    }
    return selected;
  };

  return advance ? withLock(`${stateFile}.lock`, select) : select();
}

async function createIsolatedCodexHome(env: Record<string, string>, agentId: string, runId: string): Promise<string> {
  const baseDir = resolveCodexHomeBaseDir(env);
  await fs.mkdir(baseDir, { recursive: true });
  const prefix = path.join(
    baseDir,
    `${sanitizePathSegment(agentId)}-${sanitizePathSegment(runId || "run")}-`,
  );
  return fs.mkdtemp(prefix);
}

async function prepareSessionPoolAuth(
  env: Record<string, string>,
  agentId: string,
  runId: string,
  advancePool: boolean,
): Promise<PreparedCodexAuth | null> {
  const poolFile = await discoverPoolFile(env);
  if (!poolFile) return null;

  const sessionStoreDir = await resolveSessionStoreDir(env, poolFile);
  if (!sessionStoreDir) {
    return {
      source: "none",
      env,
      billingType: "subscription",
      codexHome: resolveConfiguredCodexHome(env),
      commandNotes: [],
      check: {
        code: "codex_session_pool_store_missing",
        level: "error",
        message: "Codex session pool was found, but the session store directory is missing.",
        detail: poolFile,
        hint: "Set PAPERCLIP_CODEX_SESSION_STORE_DIR or place codex_session_store next to the pool file.",
      },
      cleanup: async () => {},
    };
  }

  const accounts = await loadPoolAccounts(poolFile);
  if (accounts.length === 0) {
    return {
      source: "none",
      env,
      billingType: "subscription",
      codexHome: resolveConfiguredCodexHome(env),
      commandNotes: [],
      check: {
        code: "codex_session_pool_empty",
        level: "error",
        message: "Codex session pool does not contain any enabled ChatGPT sessions.",
        detail: poolFile,
        hint: "Import or capture sessions into the pool, or point PAPERCLIP_CODEX_SESSION_POOL_FILE to a populated pool.",
      },
      cleanup: async () => {},
    };
  }

  const account = await pickPoolAccount(env, poolFile, accounts, advancePool);
  if (!account) {
    return {
      source: "none",
      env,
      billingType: "subscription",
      codexHome: resolveConfiguredCodexHome(env),
      commandNotes: [],
      check: {
        code: "codex_session_pool_session_missing",
        level: "error",
        message: "Codex session pool could not resolve a usable session.",
        detail: poolFile,
        hint: "Verify PAPERCLIP_CODEX_SESSION_ID, or remove it to let Paperclip choose an enabled pool account automatically.",
      },
      cleanup: async () => {},
    };
  }

  const authSource = path.resolve(sessionStoreDir, account.sessionId, "auth.json");
  const validation = await validateAuthJson(authSource);
  if (!validation.ok) {
    return {
      source: "none",
      env,
      billingType: "subscription",
      codexHome: resolveConfiguredCodexHome(env),
      commandNotes: [],
      check: {
        code: "codex_session_pool_auth_invalid",
        level: "error",
        message: "The selected Codex session pool snapshot is missing or invalid.",
        detail: authSource,
        hint: "Re-capture that session in the source controlplane repo or pick a different session id.",
      },
      cleanup: async () => {},
    };
  }

  const isolatedHome = await createIsolatedCodexHome(env, agentId, runId);
  const authTarget = path.resolve(isolatedHome, "auth.json");
  await fs.copyFile(authSource, authTarget);
  await fs.chmod(authTarget, 0o600).catch(() => {});

  const maskedId = maskIdentifier(account.id);
  const maskedSession = maskIdentifier(account.sessionId);
  return {
    source: "session_pool",
    env: {
      ...env,
      OPENAI_API_KEY: "",
      CODEX_HOME: isolatedHome,
    },
    billingType: "subscription",
    codexHome: isolatedHome,
    commandNotes: [
      `Using Codex CLI session pool account ${maskedId || "<pool-account>"} (${maskedSession || account.sessionId}).`,
      `Restored auth snapshot from ${poolFile} into isolated CODEX_HOME ${isolatedHome}.`,
    ],
    check: {
      code: "codex_session_pool_ready",
      level: "info",
      message: "Codex CLI session pool is available.",
      detail: `${poolFile} -> ${account.sessionId}`,
    },
    cleanup: async () => {
      await fs.rm(isolatedHome, { recursive: true, force: true }).catch(() => {});
    },
  };
}

function apiKeyCheck(env: Record<string, string>): AdapterEnvironmentCheck {
  if (hasOwn(env, "OPENAI_API_KEY") && isNonEmpty(env.OPENAI_API_KEY)) {
    return {
      code: "codex_openai_api_key_present",
      level: "info",
      message: "OPENAI_API_KEY is set for Codex authentication.",
      detail: "Detected in adapter config env.",
    };
  }
  if (!hasOwn(env, "OPENAI_API_KEY") && isNonEmpty(process.env.OPENAI_API_KEY)) {
    return {
      code: "codex_openai_api_key_present",
      level: "info",
      message: "OPENAI_API_KEY is set for Codex authentication.",
      detail: "Detected in server environment.",
    };
  }
  return {
    code: "codex_openai_api_key_missing",
    level: "warn",
    message: "OPENAI_API_KEY is not set. Codex runs may fail until authentication is configured.",
    hint:
      "Set OPENAI_API_KEY, run `codex login`, or configure a session pool with PAPERCLIP_CODEX_SESSION_POOL_FILE and PAPERCLIP_CODEX_SESSION_STORE_DIR.",
  };
}

export async function prepareCodexAuth(
  options: PrepareCodexAuthOptions,
): Promise<PreparedCodexAuth> {
  const authMode = resolveAuthMode(options.env);
  const hasApiKey = hasEffectiveEnvValue(options.env, "OPENAI_API_KEY");

  if (authMode === "api_key") {
    if (!hasApiKey) {
      return {
        source: "none",
        env: options.env,
        billingType: "api",
        codexHome: resolveConfiguredCodexHome(options.env),
        commandNotes: [],
        check: {
          code: "codex_openai_api_key_required",
          level: "error",
          message: "Codex auth mode is pinned to API key, but OPENAI_API_KEY is missing.",
          hint: "Set OPENAI_API_KEY in adapter env or server environment, or switch PAPERCLIP_CODEX_AUTH_MODE to session_pool/local_login.",
        },
        cleanup: async () => {},
      };
    }

    return {
      source: "api_key",
      env: options.env,
      billingType: "api",
      codexHome: resolveConfiguredCodexHome(options.env),
      commandNotes: [],
      check: apiKeyCheck(options.env),
      cleanup: async () => {},
    };
  }

  if (authMode === "session_pool" || (!hasApiKey && authMode === "auto")) {
    const preparedPool = await prepareSessionPoolAuth(
      options.env,
      options.agentId,
      options.runId,
      options.advancePool,
    );
    if (preparedPool?.source === "session_pool") {
      return preparedPool;
    }
    if (authMode === "session_pool") {
      return (
        preparedPool ?? {
          source: "none",
          env: {
            ...options.env,
            OPENAI_API_KEY: "",
          },
          billingType: "subscription",
          codexHome: resolveConfiguredCodexHome(options.env),
          commandNotes: [],
          check: {
            code: "codex_session_pool_missing",
            level: "error",
            message: "Codex auth mode is pinned to session_pool, but no usable session pool was found.",
            hint: "Set PAPERCLIP_CODEX_SESSION_POOL_FILE and PAPERCLIP_CODEX_SESSION_STORE_DIR, or place a controlplane-style pool under ~/Documents/Desarrollos.",
          },
          cleanup: async () => {},
        }
      );
    }
  }

  const codexHome = resolveConfiguredCodexHome(options.env);
  const localAuth = await validateAuthJson(path.resolve(codexHome, "auth.json"));
  if (authMode === "local_login" || (!hasApiKey && localAuth.ok)) {
    if (!localAuth.ok) {
      return {
        source: "none",
        env: {
          ...options.env,
          OPENAI_API_KEY: "",
        },
        billingType: "subscription",
        codexHome,
        commandNotes: [],
        check: {
          code: "codex_local_login_missing",
          level: "error",
          message: "Codex auth mode is pinned to local_login, but CODEX_HOME does not contain a valid auth.json.",
          detail: path.resolve(codexHome, "auth.json"),
          hint: "Run `codex login` or switch PAPERCLIP_CODEX_AUTH_MODE to session_pool.",
        },
        cleanup: async () => {},
      };
    }

    return {
      source: "local_login",
      env: {
        ...options.env,
        OPENAI_API_KEY: "",
        CODEX_HOME: codexHome,
      },
      billingType: "subscription",
      codexHome,
      commandNotes: [`Using existing Codex CLI login from ${codexHome}.`],
      check: {
        code: "codex_local_login_ready",
        level: "info",
        message: "Codex CLI login is available.",
        detail: codexHome,
      },
      cleanup: async () => {},
    };
  }

  if (hasApiKey) {
    return {
      source: "api_key",
      env: options.env,
      billingType: "api",
      codexHome,
      commandNotes: [],
      check: apiKeyCheck(options.env),
      cleanup: async () => {},
    };
  }

  return {
    source: "none",
    env: options.env,
    billingType: "subscription",
    codexHome,
    commandNotes: [],
    check: {
      code: "codex_auth_missing",
      level: "warn",
      message: "Codex authentication is not configured.",
      hint:
        "Set OPENAI_API_KEY, run `codex login`, or configure a session pool with PAPERCLIP_CODEX_SESSION_POOL_FILE and PAPERCLIP_CODEX_SESSION_STORE_DIR.",
    },
    cleanup: async () => {},
  };
}
