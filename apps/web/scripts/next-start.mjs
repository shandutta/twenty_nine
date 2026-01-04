import { spawn } from "node:child_process";
import net from "node:net";

const DEFAULT_START_PORT = process.env.NEXT_START_PORT ?? process.env.PORT ?? "3100";
const allowPortOverride = process.env.TWENTYNINE_ALLOW_PORT_OVERRIDE === "1";

const isPortAvailable = (port, host) =>
  new Promise((resolve) => {
    const server = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => {
        server.close(() => resolve(true));
      })
      .listen(port, host);
  });

const args = process.argv.slice(2);
let hostname;
let port;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--hostname" && i + 1 < args.length) {
    hostname = args[i + 1];
    i += 1;
    continue;
  }
  if (arg === "--port" && i + 1 < args.length) {
    port = args[i + 1];
    i += 1;
  }
}

const nextArgs = ["exec", "next", "start"];
if (hostname) {
  nextArgs.push("--hostname", hostname);
}
if (port && !allowPortOverride && port !== DEFAULT_START_PORT) {
  console.error(
    `[next-start] Port override blocked (${port}). Expected ${DEFAULT_START_PORT}. Set TWENTYNINE_ALLOW_PORT_OVERRIDE=1 to override.`,
  );
  process.exit(1);
}

if (!port) {
  port = DEFAULT_START_PORT;
}

const resolvedPort = Number(port);
if (!Number.isInteger(resolvedPort) || resolvedPort <= 0) {
  console.error(`[next-start] Invalid port: ${port}`);
  process.exit(1);
}

const hostToCheck = hostname ?? "0.0.0.0";
if (!(await isPortAvailable(resolvedPort, hostToCheck))) {
  console.error(
    `[next-start] Port ${resolvedPort} is already in use. Stop the existing process or pass --port explicitly.`,
  );
  process.exit(1);
}

process.env.PORT = String(resolvedPort);
nextArgs.push("--port", String(resolvedPort));

const child = spawn("pnpm", nextArgs, {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
  },
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
