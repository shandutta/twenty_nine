#!/usr/bin/env node
"use strict";

const { execSync } = require("child_process");
const fs = require("fs");

function ts() {
  return new Date().toISOString();
}

function log(msg) {
  process.stdout.write(`[${ts()}] ${msg}\n`);
}

function run(cmd, options = {}) {
  return execSync(cmd, { encoding: "utf8", ...options }).trim();
}

function exists(path) {
  try {
    return fs.existsSync(path);
  } catch {
    return false;
  }
}

function hasUnmergedFiles() {
  try {
    return run("git ls-files -u") !== "";
  } catch {
    return false;
  }
}

function getGitConfig(key) {
  try {
    return run(`git config --get ${key}`);
  } catch {
    return "";
  }
}

function isRepoDirty() {
  try {
    return run("git status --porcelain") !== "";
  } catch {
    return false;
  }
}

function stagedChanges() {
  try {
    return run("git diff --cached --name-only") !== "";
  } catch {
    return false;
  }
}

function ensureGitIdentity(env) {
  const name = getGitConfig("user.name");
  const email = getGitConfig("user.email");
  if (!name) env.GIT_AUTHOR_NAME = env.GIT_AUTHOR_NAME || "auto-commit";
  if (!email) env.GIT_AUTHOR_EMAIL = env.GIT_AUTHOR_EMAIL || "auto-commit@local";
  if (!name) env.GIT_COMMITTER_NAME = env.GIT_COMMITTER_NAME || env.GIT_AUTHOR_NAME;
  if (!email) env.GIT_COMMITTER_EMAIL = env.GIT_COMMITTER_EMAIL || env.GIT_AUTHOR_EMAIL;
}

function main() {
  log("Starting auto-commit run");

  if (!exists(".git")) {
    log("Not a git repository. Skipping.");
    return 0;
  }

  const branch = run("git rev-parse --abbrev-ref HEAD");
  if (branch !== "main") {
    log(`Skipping: on branch ${branch}`);
    return 0;
  }

  if (exists(".git/MERGE_HEAD") || exists(".git/rebase-apply") || exists(".git/rebase-merge")) {
    log("Skipping: merge/rebase in progress");
    return 0;
  }

  if (hasUnmergedFiles()) {
    log("Skipping: unmerged files");
    return 0;
  }

  if (!isRepoDirty()) {
    log("No pending changes. Nothing to commit.");
    return 0;
  }

  log("Pulling latest changes from origin...");
  try {
    execSync("git pull --rebase --autostash origin main", { stdio: "inherit" });
  } catch (err) {
    log("git pull failed");
    if (err && err.message) log(err.message);
    return 1;
  }

  if (!isRepoDirty()) {
    log("No pending changes after pull. Nothing to commit.");
    return 0;
  }

  log("Staging changes...");
  try {
    execSync("git add -A", { stdio: "inherit" });
  } catch (err) {
    log("git add failed");
    if (err && err.message) log(err.message);
    return 1;
  }

  if (!stagedChanges()) {
    log("No staged changes. Nothing to commit.");
    return 0;
  }

  const env = { ...process.env };
  ensureGitIdentity(env);
  const msg = `chore: auto-commit ${ts()}`;

  log(`Committing with message: ${msg}`);
  try {
    execSync(`git commit -m "${msg}"`, { stdio: "inherit", env });
  } catch (err) {
    log("git commit failed");
    if (err && err.message) log(err.message);
    return 1;
  }

  log("Pushing to origin...");
  try {
    execSync("git push origin main", { stdio: "inherit" });
  } catch (err) {
    log("git push failed");
    if (err && err.message) log(err.message);
    return 1;
  }

  log("Auto-commit completed and pushed successfully");
  return 0;
}

const exitCode = main();
process.exit(exitCode);
