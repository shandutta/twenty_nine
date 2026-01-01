#!/usr/bin/env node
"use strict";

// Load local env so OPENROUTER_API_KEY can live in .env/.env.local
const path = require("path");
const fs = require("fs");

// Ensure dotenv is available; if missing (e.g., cron after cache cleanup), install it on the fly.
try {
  const dotenv = require("dotenv");
  dotenv.config();
  dotenv.config({ path: ".env.local", override: true });
} catch (error) {
  console.warn("[auto-commit] dotenv missing, installing locally...", error);
  const { spawnSync } = require("child_process");
  const install = spawnSync(
    process.execPath,
    ["-e", "require('child_process').execSync('pnpm add dotenv --save-dev', { stdio: 'inherit' })"],
    { stdio: "inherit" }
  );
  if (install.status !== 0) {
    console.error("[auto-commit] failed to install dotenv; aborting run");
    process.exit(1);
  }

  // Retry load after install
  const dotenv = require("dotenv");
  dotenv.config();
  dotenv.config({ path: ".env.local", override: true });
}

/**
 * Auto-commit helper that:
 * 1. Checks for pending git changes.
 * 2. Runs repo checks (with Codex auto-fix on failure).
 * 3. Asks OpenRouter for a short Conventional Commit summary.
 * 4. Commits (and optionally pushes) using that AI-generated message.
 *
 * Required env vars:
 *   OPENROUTER_API_KEY  - API key from https://openrouter.ai
 *
 * Optional env vars:
 *   AUTO_COMMIT_MODEL   - Override OpenRouter model (default: google/gemini-2.0-flash-exp:free)
 *   AUTO_COMMIT_PUSH    - Set to "false" to skip git push
 *   OPENROUTER_REFERER  - Referer header recommended by OpenRouter
 *   OPENROUTER_TITLE    - Title header recommended by OpenRouter
 */

const { execSync, spawnSync } = require("child_process");
const repoRoot = path.resolve(__dirname, "..");

const timestamp = () =>
  new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
const log = (message) => console.log(`[${timestamp()}] ${message}`);

const AUTO_COMMIT_MODEL = process.env.AUTO_COMMIT_MODEL || "google/gemini-2.0-flash-exp:free";
const AUTO_COMMIT_FALLBACK_MODELS = (
  process.env.AUTO_COMMIT_FALLBACK_MODELS || "openai/gpt-oss-20b,meta-llama/llama-3.1-8b-instruct"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
const OPENROUTER_RETRY_ATTEMPTS = Number(process.env.AUTO_COMMIT_RETRY_ATTEMPTS || 2);
const OPENROUTER_RETRY_BASE_DELAY_MS = Number(process.env.AUTO_COMMIT_RETRY_BASE_DELAY_MS || 1200);
const AUTO_COMMIT_MAX_TOKENS = Number(process.env.AUTO_COMMIT_MAX_TOKENS || 80);

const resolveOpenRouterApiKey = () => {
  if (process.env.OPENROUTER_API_KEY) {
    return process.env.OPENROUTER_API_KEY;
  }

  const keyFile = process.env.OPENROUTER_KEY_FILE
    ? path.resolve(process.env.OPENROUTER_KEY_FILE)
    : process.env.HOME
      ? path.join(process.env.HOME, ".config", "openrouter.key")
      : null;

  if (!keyFile) {
    return null;
  }

  try {
    if (fs.existsSync(keyFile)) {
      const key = fs.readFileSync(keyFile, "utf8").trim();
      if (key) {
        log(`Loaded OPENROUTER_API_KEY from ${keyFile}`);
        return key;
      }
    }
  } catch (error) {
    console.warn(`[${timestamp()}] Failed to read OpenRouter key file at ${keyFile}:`, error.message);
  }

  return null;
};

const CHECK_COMMANDS = [
  { label: "lint", cmd: "pnpm --filter web lint" },
  { label: "engine test", cmd: "pnpm --filter @twentynine/engine test" },
];

const run = (command, options = {}) => {
  return execSync(command, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  }).trim();
};

const gitDir = path.join(repoRoot, ".git");

const getCurrentBranch = () => {
  try {
    return run("git rev-parse --abbrev-ref HEAD");
  } catch (error) {
    console.error(`[${timestamp()}] Failed to read current git branch:`, error.message);
    process.exit(1);
  }
};

const hasMergeInProgress = () => {
  return (
    fs.existsSync(path.join(gitDir, "MERGE_HEAD")) ||
    fs.existsSync(path.join(gitDir, "rebase-apply")) ||
    fs.existsSync(path.join(gitDir, "rebase-merge"))
  );
};

const hasUnmergedFiles = () => {
  try {
    return run("git ls-files -u").length > 0;
  } catch (error) {
    console.error(`[${timestamp()}] Failed to check for unmerged files:`, error.message);
    process.exit(1);
  }
};

const ensureSafeGitState = () => {
  const branch = getCurrentBranch();
  const allowNonMain = process.env.AUTO_COMMIT_ALLOW_NON_MAIN === "true";

  if (branch !== "main" && !allowNonMain) {
    log(`Skipping auto-commit: on branch ${branch}`);
    log("exit_code=0 status=success");
    process.exit(0);
  }

  if (hasMergeInProgress()) {
    log("Skipping auto-commit: merge/rebase in progress");
    log("exit_code=0 status=success");
    process.exit(0);
  }

  if (hasUnmergedFiles()) {
    log("Skipping auto-commit: unmerged files");
    log("exit_code=0 status=success");
    process.exit(0);
  }
};

const hasChanges = () => {
  try {
    const result = run("git status --porcelain");
    return result.length > 0;
  } catch (error) {
    console.error(`[${timestamp()}] Failed to check git status:`, error.message);
    process.exit(1);
  }
};

const getCommitContext = () => {
  try {
    const shortStatus = run("git status --short");
    const diffStat = run("git diff --stat HEAD");
    const diff = run("git diff HEAD");
    return { shortStatus, diffStat, diff };
  } catch (error) {
    console.error(`[${timestamp()}] Failed to collect git diff context:`, error.message);
    process.exit(1);
  }
};

const ensureFetch = async () => {
  if (typeof fetch === "undefined") {
    const nodeFetch = await import("node-fetch");
    global.fetch = nodeFetch.default;
  }
};

const parseRetryAfterMs = (response) => {
  const header = response?.headers?.get?.("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  if (!Number.isNaN(seconds) && seconds > 0) return seconds * 1000;
  const asDate = Date.parse(header);
  if (!Number.isNaN(asDate)) return Math.max(0, asDate - Date.now());
  return null;
};

const backoffDelayMs = (attempt, retryAfterMs) => {
  if (retryAfterMs && retryAfterMs > 0) return retryAfterMs;
  const base = OPENROUTER_RETRY_BASE_DELAY_MS * Math.max(1, attempt + 1);
  const jitter = Math.floor(Math.random() * 200);
  return Math.min(base + jitter, 10_000);
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableNetworkError = (error) => {
  const message = (error?.message || String(error || "")).toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("fetch failed") ||
    message.includes("etimedout") ||
    message.includes("eai_again") ||
    message.includes("network")
  );
};

const shortenForLog = (input, max = 320) => {
  if (!input) return "";
  const clean = String(input).replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
};

const callOpenRouter = async ({ shortStatus, diffStat, diff }) => {
  const apiKey = resolveOpenRouterApiKey();
  if (!apiKey) {
    console.error(`[${timestamp()}] OPENROUTER_API_KEY is not set. Cannot request commit message.`);
    process.exit(1);
  }

  const payloadBase = {
    max_tokens: AUTO_COMMIT_MAX_TOKENS,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: "You generate concise, **lowercase** Conventional Commit titles (max 65 characters).",
      },
      {
        role: "user",
        content: [
          "Summarize the code changes below as a short Conventional Commit title.",
          "",
          "Git status:",
          shortStatus,
          "",
          "Diff summary:",
          diffStat,
          "",
          "Full diff:",
          diff,
        ].join("\n"),
      },
    ],
  };

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (process.env.OPENROUTER_REFERER) {
    headers["HTTP-Referer"] = process.env.OPENROUTER_REFERER;
  }

  if (process.env.OPENROUTER_TITLE) {
    headers["X-Title"] = process.env.OPENROUTER_TITLE;
  }

  await ensureFetch();

  const models = Array.from(new Set([AUTO_COMMIT_MODEL, ...AUTO_COMMIT_FALLBACK_MODELS]));
  const errors = [];

  for (const model of models) {
    const result = await requestCommitMessage({
      model,
      headers,
      payloadBase,
    });

    if (result.ok) {
      if (result.requestId) {
        log(`OpenRouter request_id=${result.requestId} model=${model}`);
      }
      return result.message;
    }

    errors.push(`${model}: ${result.error}`);
  }

  throw new Error(errors.join(" | ") || "OpenRouter failed to return commit message.");
};

const requestCommitMessage = async ({ model, headers, payloadBase }) => {
  let lastError = "unknown error";
  let lastRequestId = null;

  for (let attempt = 0; attempt <= OPENROUTER_RETRY_ATTEMPTS; attempt++) {
    const result = await sendOpenRouterRequest({
      model,
      headers,
      payloadBase,
    });

    if (result.ok) {
      return result;
    }

    lastError = result.error || lastError;
    lastRequestId = result.requestId || lastRequestId;

    if (!result.retryable || attempt === OPENROUTER_RETRY_ATTEMPTS) break;

    const waitMs = backoffDelayMs(attempt, result.retryAfterMs);
    log(`Retrying OpenRouter (model=${model}) in ${waitMs}ms after error: ${shortenForLog(lastError, 160)}`);
    await delay(waitMs);
  }

  return { ok: false, error: lastError, requestId: lastRequestId };
};

const sendOpenRouterRequest = async ({ model, headers, payloadBase }) => {
  const payload = { ...payloadBase, model };

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const requestId = response.headers.get("x-request-id") || "n/a";
    const responseText = await response.text();

    let data = null;
    try {
      data = JSON.parse(responseText);
    } catch {
      // ignore parse errors; data stays null
    }

    if (!response.ok) {
      const message = data?.error?.message || response.statusText || "unknown error";
      const retryable = response.status === 429 || response.status >= 500;
      return {
        ok: false,
        error: `${response.status} ${message}; request_id=${requestId}; body=${shortenForLog(responseText)}`,
        retryable,
        retryAfterMs: parseRetryAfterMs(response),
        requestId,
      };
    }

    const message = data?.choices?.[0]?.message?.content?.split("\n")[0]?.trim() ?? "";

    if (!message) {
      return {
        ok: false,
        error: `OpenRouter returned an empty commit message; request_id=${requestId}; body=${shortenForLog(
          responseText
        )}`,
        retryable: false,
        retryAfterMs: null,
        requestId,
      };
    }

    return { ok: true, message: message.replace(/^"|"$/g, ""), requestId };
  } catch (error) {
    return {
      ok: false,
      error: `OpenRouter request error: ${error?.message || "unknown error"}`,
      retryable: isRetryableNetworkError(error),
      retryAfterMs: null,
      requestId: null,
    };
  }
};

const gitCommit = (message) => {
  try {
    run("git add -A");
  } catch (error) {
    console.error(`[${timestamp()}] Failed to stage changes:`, error.message);
    process.exit(1);
  }

  const stagedDiff = spawnSync("git", ["diff", "--cached", "--quiet"], {
    cwd: repoRoot,
  });

  // `git diff --cached --quiet` returns:
  // - 0 when there are NO staged changes
  // - 1 when there ARE staged changes
  if (stagedDiff.status === 0) {
    log("No pending changes. Nothing to commit.");
    log("exit_code=0 status=success");
    return false;
  }
  if (stagedDiff.status !== 1) {
    console.error(`[${timestamp()}] Failed to check staged changes; aborting commit.`);
    process.exit(stagedDiff.status ?? 1);
  }

  const commitEnv = { ...process.env };
  // Skip pre-commit hook since we already ran the checks in runChecksWithCodex()
  commitEnv.SKIP_SIMPLE_GIT_HOOKS = "1";

  const commit = spawnSync("git", ["commit", "-m", message], {
    stdio: "inherit",
    env: commitEnv,
  });

  if (commit.status !== 0) {
    process.exit(commit.status ?? 1);
  }

  return true;
};

const gitPush = () => {
  if (process.env.AUTO_COMMIT_PUSH === "false") {
    return;
  }

  const push = spawnSync("git", ["push"], { stdio: "inherit" });
  if (push.status !== 0) {
    console.error(`[${timestamp()}] git push failed.`);
    process.exit(push.status ?? 1);
  }
};

const resolveCodexBin = () => {
  if (process.env.CODEX_BIN) {
    return process.env.CODEX_BIN;
  }

  const found = spawnSync("which codex", {
    shell: true,
    cwd: repoRoot,
    encoding: "utf8",
  });

  if (found.status === 0 && found.stdout.trim()) {
    return found.stdout.trim();
  }

  return null;
};

const runCheck = (command) => {
  log(`Running check: ${command}`);
  const result = spawnSync(command, {
    shell: true,
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 10,
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  return result;
};

const runChecksWithCodex = () => {
  let failure;

  for (const command of CHECK_COMMANDS) {
    const result = runCheck(command.cmd);
    if (result.status !== 0) {
      failure = { ...command, result };
      break;
    }
  }

  if (!failure) {
    return;
  }

  const failureSummary = [
    `Command: ${failure.cmd}`,
    failure.result.stdout ? `stdout:\n${failure.result.stdout}` : null,
    failure.result.stderr ? `stderr:\n${failure.result.stderr}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const autoFixEnv = process.env.CODEX_AUTO_FIX;
  const shouldAutoFix = autoFixEnv === undefined || (autoFixEnv !== "0" && autoFixEnv.toLowerCase() !== "false");

  if (!shouldAutoFix) {
    console.error(
      `[${timestamp()}] Checks failed. Set CODEX_AUTO_FIX back to 1/true (default) to let Codex attempt an auto-fix.`
    );
    process.exit(failure.result.status ?? 1);
  }

  const codexBin = resolveCodexBin();
  if (!codexBin) {
    console.error(
      `[${timestamp()}] Checks failed and Codex CLI is not available. Install/login to Codex, set CODEX_BIN, or set CODEX_AUTO_FIX=0 to skip auto-fix.`
    );
    process.exit(failure.result.status ?? 1);
  }

  spawnSync(codexBin, ["--version"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  console.warn(`[${timestamp()}] Checks failed; invoking Codex for auto-fix...`);

  const prompt = [
    "You are helping with an automated auto-commit task for the twentynine repo.",
    "Goal: fix only the lint/test failures so that these commands succeed:",
    CHECK_COMMANDS.map((c) => c.cmd).join(" && "),
    "Keep behavior unchanged; follow existing code style.",
    "Do not run git commit or push. Make minimal edits needed to fix the errors.",
    "Failure output:",
    failureSummary,
  ].join("\n\n");

  const codexResult = spawnSync(
    codexBin,
    ["--ask-for-approval", "never", "--sandbox", "workspace-write", "exec", "--cd", repoRoot, "-"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["pipe", "inherit", "inherit"],
      input: prompt,
    }
  );

  if (codexResult.status !== 0) {
    console.error(`[${timestamp()}] Codex auto-fix failed or was interrupted. Aborting.`);
    process.exit(failure.result.status ?? 1);
  }

  log("Re-running checks after Codex auto-fix...");

  for (const command of CHECK_COMMANDS) {
    const result = runCheck(command.cmd);
    if (result.status !== 0) {
      console.error(`[${timestamp()}] Still failing after Codex auto-fix. Command: ${command.cmd}`);
      process.exit(result.status ?? 1);
    }
  }
};

const gitPullRebase = () => {
  log("Pulling latest changes from origin...");
  const pull = spawnSync("git", ["pull", "--rebase", "--autostash", "origin", "main"], {
    stdio: "inherit",
    cwd: repoRoot,
  });
  if (pull.status !== 0) {
    console.error(`[${timestamp()}] git pull --rebase failed. Resolve conflicts manually.`);
    process.exit(pull.status ?? 1);
  }
};

const main = async () => {
  log("Starting auto-commit run");
  ensureSafeGitState();

  // Always pull first to stay in sync with other machines
  gitPullRebase();

  if (!hasChanges()) {
    log("No pending changes. Nothing to commit.");
    log("exit_code=0 status=success");
    return;
  }

  log("Running pre-commit checks (with Codex auto-fix if needed)...");
  runChecksWithCodex();

  // If lint/test fixed the working tree back to clean, skip the LLM call entirely.
  if (!hasChanges()) {
    log("No pending changes. Nothing to commit.");
    log("exit_code=0 status=success");
    return;
  }

  const context = getCommitContext();
  log("Generating commit message via OpenRouter...");
  const commitMessage = await callOpenRouter(context);

  log(`AI-generated commit message: ${commitMessage}`);
  const committed = gitCommit(commitMessage);
  if (!committed) {
    return;
  }
  gitPush();

  log("Auto-commit completed and pushed successfully");
  log("exit_code=0 status=success");
};

main().catch((error) => {
  console.error(`[${timestamp()}] Unexpected auto-commit error:`, error);
  process.exit(1);
});
