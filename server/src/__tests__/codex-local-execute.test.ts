import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execute } from "@paperclipai/adapter-codex-local/server";

async function writeFakeCodexCommand(commandPath: string): Promise<void> {
  const script = `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const capturePath = process.env.PAPERCLIP_TEST_CAPTURE_PATH;
const codexHome = process.env.CODEX_HOME || "";
const authPath = codexHome ? path.join(codexHome, "auth.json") : "";
const auth = authPath && fs.existsSync(authPath)
  ? JSON.parse(fs.readFileSync(authPath, "utf8"))
  : null;
const payload = {
  argv: process.argv.slice(2),
  prompt: fs.readFileSync(0, "utf8"),
  codexHome,
  authExists: Boolean(auth),
  authMode: auth && typeof auth.auth_mode === "string" ? auth.auth_mode : null,
  openAiKey: process.env.OPENAI_API_KEY ?? null,
};
if (capturePath) {
  fs.writeFileSync(capturePath, JSON.stringify(payload), "utf8");
}
console.log(JSON.stringify({ type: "thread.started", thread_id: "pool-thread-1" }));
console.log(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "hello from pool" } }));
console.log(JSON.stringify({ type: "turn.completed", usage: { input_tokens: 12, cached_input_tokens: 0, output_tokens: 7 } }));
`;
  await fs.writeFile(commandPath, script, "utf8");
  await fs.chmod(commandPath, 0o755);
}

type CapturePayload = {
  argv: string[];
  prompt: string;
  codexHome: string;
  authExists: boolean;
  authMode: string | null;
  openAiKey: string | null;
};

describe("codex execute", () => {
  it("restores session-pool auth into an isolated CODEX_HOME and forces subscription billing", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-codex-execute-"));
    const workspace = path.join(root, "workspace");
    const commandPath = path.join(root, "codex");
    const capturePath = path.join(root, "capture.json");
    const storeDir = path.join(root, "codex_session_store");
    const sessionId = "pool-session-1";
    const poolFile = path.join(root, "codex_account_pool.json");
    await fs.mkdir(workspace, { recursive: true });
    await fs.mkdir(path.join(storeDir, sessionId), { recursive: true });
    await writeFakeCodexCommand(commandPath);
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

    const previousOpenAiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-host-value";

    try {
      const result = await execute({
        runId: "run-1",
        agent: {
          id: "agent-1",
          companyId: "company-1",
          name: "Codex Pool Agent",
          adapterType: "codex_local",
          adapterConfig: {},
        },
        runtime: {
          sessionId: null,
          sessionParams: null,
          sessionDisplayId: null,
          taskKey: null,
        },
        config: {
          command: commandPath,
          cwd: workspace,
          model: "gpt-5.3-codex",
          env: {
            PAPERCLIP_TEST_CAPTURE_PATH: capturePath,
            PAPERCLIP_CODEX_AUTH_MODE: "session_pool",
            PAPERCLIP_CODEX_SESSION_POOL_FILE: poolFile,
            PAPERCLIP_CODEX_SESSION_STORE_DIR: storeDir,
          },
          promptTemplate: "Follow the paperclip heartbeat.",
        },
        context: {},
        authToken: "run-jwt-token",
        onLog: async () => {},
      });

      expect(result.exitCode).toBe(0);
      expect(result.errorMessage).toBeNull();
      expect(result.billingType).toBe("subscription");
      expect(result.sessionId).toBe("pool-thread-1");

      const capture = JSON.parse(await fs.readFile(capturePath, "utf8")) as CapturePayload;
      expect(capture.authExists).toBe(true);
      expect(capture.authMode).toBe("chatgpt");
      expect(capture.openAiKey).toBe("");
      expect(capture.argv).toContain("exec");
      expect(capture.argv).toContain("--json");
      expect(capture.argv).toContain("--skip-git-repo-check");
      expect(capture.prompt).toContain("Follow the paperclip heartbeat.");

      const codexHomeExists = await fs.stat(capture.codexHome).then(() => true).catch(() => false);
      expect(codexHomeExists).toBe(false);
    } finally {
      if (previousOpenAiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = previousOpenAiKey;
      }
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
