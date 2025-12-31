import { spawn } from "node:child_process";

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

const nextArgs = ["exec", "next", "dev", "--webpack"];
if (hostname) {
  nextArgs.push("--hostname", hostname);
}
if (port) {
  nextArgs.push("--port", port);
}

const child = spawn("pnpm", nextArgs, {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
