#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const NEXT_DIR = path.join(ROOT, "apps/web/.next");
const MANIFESTS = ["build-manifest.json", "app-build-manifest.json"];
const FILE_PATTERN = /\.(js|css|map|woff2?|ttf|png|svg|jpg|jpeg|webp)$/i;
const BUILD_ID_PATH = path.join(NEXT_DIR, "BUILD_ID");

if (!fs.existsSync(NEXT_DIR)) {
  console.error(`verify-next-build: missing ${NEXT_DIR}`);
  process.exit(1);
}

if (!fs.existsSync(BUILD_ID_PATH)) {
  console.error(`verify-next-build: missing ${BUILD_ID_PATH}`);
  process.exit(1);
}

const files = new Set();

const normalizePath = (value) => {
  if (typeof value !== "string") return null;
  let rel = value.replace(/^\/_next\//, "");
  rel = rel.replace(/^\/+/, "");
  if (!rel || !FILE_PATTERN.test(rel)) return null;
  return rel;
};

const collectPaths = (value) => {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") {
        const rel = normalizePath(item);
        if (rel) files.add(rel);
      } else if (item && typeof item === "object") {
        collectPaths(item);
      }
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) {
      collectPaths(nested);
    }
  }
};

for (const manifest of MANIFESTS) {
  const manifestPath = path.join(NEXT_DIR, manifest);
  if (!fs.existsSync(manifestPath)) continue;
  const data = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  collectPaths(data);
}

if (files.size === 0) {
  console.error("verify-next-build: no asset entries found in manifests.");
  process.exit(1);
}

const missing = [];
for (const rel of files) {
  const fullPath = path.join(NEXT_DIR, rel);
  if (!fs.existsSync(fullPath)) {
    missing.push(rel);
  }
}

if (missing.length > 0) {
  console.error("verify-next-build: missing build assets:");
  for (const rel of missing) {
    console.error(`- ${rel}`);
  }
  process.exit(1);
}

console.log(`verify-next-build: ok (${files.size} assets checked)`);
