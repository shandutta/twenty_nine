import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");

const postcssCjs = path.join(appRoot, "postcss.config.cjs");
const postcssJs = path.join(appRoot, "postcss.config.js");
const postcssMjs = path.join(appRoot, "postcss.config.mjs");
const globalsCss = path.join(appRoot, "app", "globals.css");

const errors = [];

const hasCjs = fs.existsSync(postcssCjs);
const hasJs = fs.existsSync(postcssJs);
const hasMjs = fs.existsSync(postcssMjs);

if (!hasCjs && !hasJs) {
  errors.push("Missing postcss.config.cjs or postcss.config.js.");
}

if (hasMjs) {
  errors.push("Found postcss.config.mjs; remove it to avoid PostCSS loader issues.");
}

const configPath = hasCjs ? postcssCjs : hasJs ? postcssJs : null;
if (configPath) {
  const configText = fs.readFileSync(configPath, "utf8");
  if (!configText.includes("@tailwindcss/postcss")) {
    errors.push("PostCSS config does not reference @tailwindcss/postcss.");
  }
}

if (!fs.existsSync(globalsCss)) {
  errors.push("Missing app/globals.css.");
} else {
  const globalsText = fs.readFileSync(globalsCss, "utf8");
  if (!globalsText.includes("@import \"tailwindcss\"")) {
    errors.push("app/globals.css does not import tailwindcss.");
  }
}

if (errors.length > 0) {
  console.error("[check:tailwind] Tailwind preflight failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("[check:tailwind] Tailwind preflight OK.");
