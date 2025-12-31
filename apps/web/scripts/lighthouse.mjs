import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

const baseUrlEnv =
  process.env.LIGHTHOUSE_BASE_URL ?? process.env.AUDIT_BASE_URL ?? "";
const rawBaseUrl =
  baseUrlEnv.length > 0
    ? baseUrlEnv
    : `http://${process.env.HOSTNAME ?? "127.0.0.1"}:${process.env.PORT ?? 3000}`;
const baseURL = rawBaseUrl.replace(/\/game\/?$/, "").replace(/\/$/, "");
const parsedBaseUrl = new URL(baseURL);
const host = parsedBaseUrl.hostname;
const port = parsedBaseUrl.port ? Number(parsedBaseUrl.port) : 3000;
const url = `${baseURL}/game`;

const waitForServer = async (targetUrl, timeoutMs = 60_000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(targetUrl, { method: "GET" });
      if (response.ok) {
        return;
      }
    } catch {
      // ignore and retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not become ready at ${targetUrl}`);
};

const startServer = () =>
  spawn(
    "pnpm",
    ["exec", "next", "start", "--hostname", host, "--port", String(port)],
    {
      cwd: process.cwd(),
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_ENV: "production",
      },
    }
  );

let serverProcess;

const cleanup = async () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGTERM");
  }
};

process.on("SIGINT", () => {
  void cleanup().finally(() => process.exit(1));
});

process.on("exit", () => {
  void cleanup();
});

try {
  let useExistingServer = false;
  if (!baseUrlEnv) {
    try {
      await waitForServer(url, 1500);
      useExistingServer = true;
    } catch {
      useExistingServer = false;
    }
  }

  if (!baseUrlEnv && !useExistingServer) {
    serverProcess = startServer();
    const serverExit = new Promise((_, reject) => {
      serverProcess.once("exit", (code, signal) => {
        if (code === 0) {
          return;
        }
        reject(
          new Error(
            `Server exited before ready (code ${code ?? "unknown"}, signal ${
              signal ?? "none"
            })`
          )
        );
      });
    });
    const serverError = new Promise((_, reject) => {
      serverProcess.once("error", reject);
    });

    await Promise.race([waitForServer(url), serverExit, serverError]);
  } else {
    await waitForServer(url);
  }

  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless=new", "--no-sandbox"],
  });

  const result = await lighthouse(url, {
    port: chrome.port,
    output: "html",
    onlyCategories: ["performance", "accessibility", "best-practices"],
    logLevel: "info",
  });

  const reportDir = path.resolve(process.cwd(), "reports", "lighthouse");
  await mkdir(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, "game.html");
  await writeFile(reportPath, result.report);

  await chrome.kill();
  await cleanup();

  console.log(`Lighthouse report saved to ${reportPath}`);
} catch (error) {
  await cleanup();
  console.error(error);
  process.exit(1);
}
