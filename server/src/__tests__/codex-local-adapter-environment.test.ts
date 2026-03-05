import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { testEnvironment } from "@paperclipai/adapter-codex-local/server";

describe("codex_local environment diagnostics", () => {
  it("creates a missing working directory when cwd is absolute", async () => {
    const cwd = path.join(
      os.tmpdir(),
      `paperclip-codex-local-cwd-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      "workspace",
    );

    await fs.rm(path.dirname(cwd), { recursive: true, force: true });

    const result = await testEnvironment({
      companyId: "company-1",
      adapterType: "codex_local",
      config: {
        command: process.execPath,
        cwd,
      },
    });

    expect(result.checks.some((check) => check.code === "codex_cwd_valid")).toBe(true);
    expect(result.checks.some((check) => check.level === "error")).toBe(false);
    const stats = await fs.stat(cwd);
    expect(stats.isDirectory()).toBe(true);
    await fs.rm(path.dirname(cwd), { recursive: true, force: true });
  });

  it("detects a configured Codex session pool without requiring OPENAI_API_KEY", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-codex-pool-env-"));
    const cwd = path.join(root, "workspace");
    const storeDir = path.join(root, "codex_session_store");
    const sessionId = "pool-session-1";
    const poolFile = path.join(root, "codex_account_pool.json");

    await fs.mkdir(path.join(storeDir, sessionId), { recursive: true });
    await fs.writeFile(
      path.join(storeDir, sessionId, "auth.json"),
      JSON.stringify({
        auth_mode: "chatgpt",
        tokens: {
          access_token: "access-token",
          refresh_token: "refresh-token",
        },
      }),
      "utf8",
    );
    await fs.writeFile(
      poolFile,
      JSON.stringify({
        accounts: [
          {
            id: "pool-user@example.com",
            auth_mode: "chatgpt_session",
            enabled: true,
            session_id: sessionId,
          },
        ],
      }),
      "utf8",
    );

    const result = await testEnvironment({
      companyId: "company-1",
      adapterType: "codex_local",
      config: {
        command: process.execPath,
        cwd,
        env: {
          PAPERCLIP_CODEX_AUTH_MODE: "session_pool",
          PAPERCLIP_CODEX_SESSION_POOL_FILE: poolFile,
          PAPERCLIP_CODEX_SESSION_STORE_DIR: storeDir,
        },
      },
    });

    expect(result.checks.some((check) => check.code === "codex_session_pool_ready")).toBe(true);
    expect(result.checks.some((check) => check.code === "codex_openai_api_key_missing")).toBe(false);
    expect(result.status).toBe("pass");

    await fs.rm(root, { recursive: true, force: true });
  });

  it("auto-discovers the controlplane Codex pool under ~/Documents/Desarrollos", async () => {
    const homeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-codex-home-"));
    const previousHome = process.env.HOME;
    const repoRoot = path.join(
      homeRoot,
      "Documents",
      "Desarrollos",
      "codex-controlplane-core-main",
      "planning",
      "state",
    );
    const storeDir = path.join(repoRoot, "codex_session_store");
    const sessionId = "auto-discovered-session";
    const poolFile = path.join(repoRoot, "codex_account_pool.json");
    const cwd = path.join(homeRoot, "workspace");

    await fs.mkdir(path.join(storeDir, sessionId), { recursive: true });
    await fs.writeFile(
      path.join(storeDir, sessionId, "auth.json"),
      JSON.stringify({
        auth_mode: "chatgpt",
        tokens: {
          access_token: "access-token",
          refresh_token: "refresh-token",
        },
      }),
      "utf8",
    );
    await fs.writeFile(
      poolFile,
      JSON.stringify({
        accounts: [
          {
            id: "auto-user@example.com",
            auth_mode: "chatgpt_session",
            enabled: true,
            session_id: sessionId,
          },
        ],
      }),
      "utf8",
    );

    process.env.HOME = homeRoot;
    try {
      const result = await testEnvironment({
        companyId: "company-1",
        adapterType: "codex_local",
        config: {
          command: process.execPath,
          cwd,
        },
      });

      expect(result.checks.some((check) => check.code === "codex_session_pool_ready")).toBe(true);
      expect(result.status).toBe("pass");
    } finally {
      if (previousHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHome;
      }
      await fs.rm(homeRoot, { recursive: true, force: true });
    }
  });
});
