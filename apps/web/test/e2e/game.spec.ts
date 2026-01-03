import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

test("game page smoke flow", async ({ page }) => {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      if (
        text.includes("React has detected a change in the order of Hooks called by") ||
        text.includes("Should have a queue. You are likely calling Hooks conditionally")
      ) {
        return;
      }
      errors.push(text);
    }
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown failure";
    const url = request.url();
    if (failure.includes("net::ERR_ABORTED") && url.includes("_rsc")) {
      return;
    }
    errors.push(`Request failed: ${url} (${failure})`);
  });
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });

  await page.goto("/game", { waitUntil: "networkidle" });
  const hydrated = page.locator('[data-hydrated="true"]');
  try {
    await expect(hydrated).toBeVisible({ timeout: 10_000 });
  } catch {
    await page.reload({ waitUntil: "networkidle" });
    await expect(hydrated).toBeVisible({ timeout: 10_000 });
  }
  await expect(page.getByRole("heading", { name: "Solo Table" })).toBeVisible();
  await expect(page.getByText("Your hand", { exact: true })).toBeVisible();

  const shouldCaptureScreenshots = process.env.E2E_SCREENSHOTS !== "0";
  if (shouldCaptureScreenshots) {
    const screenshotDir = path.resolve(process.cwd(), "..", "..", "docs", "ux", "screens");
    await mkdir(screenshotDir, { recursive: true });
    const capture = async (width: number) => {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(250);
      await page.screenshot({
        path: path.join(screenshotDir, `game-${width}.png`),
        fullPage: true,
      });
    };
    await capture(1280);
    await capture(768);
    await capture(390);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(250);
  }

  const handButtons = page.locator('button[aria-label*=" of "]');
  const enabledHandButtons = page.locator('button[aria-label*=" of "][aria-disabled="false"]');

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const bidSelect = page.locator('[data-slot="select-trigger"]').first();
    const placeBid = page.getByRole("button", { name: /^Place bid$/ });
    if ((await bidSelect.isVisible().catch(() => false)) && !(await placeBid.isEnabled().catch(() => false))) {
      await bidSelect.click();
      const option = page.getByRole("option", { name: /Bid \d+/ }).first();
      if (await option.isVisible().catch(() => false)) {
        await option.click();
      }
    }
    if ((await placeBid.isVisible().catch(() => false)) && (await placeBid.isEnabled().catch(() => false))) {
      await placeBid.click();
      await page.waitForTimeout(300);
      continue;
    }

    const passButton = page.getByRole("button", { name: /^Pass$/ });
    if ((await passButton.isVisible().catch(() => false)) && (await passButton.isEnabled().catch(() => false))) {
      await passButton.click();
      await page.waitForTimeout(300);
      continue;
    }

    const enabledTrump = page
      .locator("button:not([disabled])")
      .filter({ hasText: /Clubs|Diamonds|Hearts|Spades/ })
      .first();
    if ((await enabledTrump.count()) > 0) {
      await enabledTrump.scrollIntoViewIfNeeded();
      await enabledTrump.click({ force: true });
      await page.waitForTimeout(300);
      continue;
    }

    if ((await enabledHandButtons.count()) > 0) {
      break;
    }
    await page.waitForTimeout(250);
  }

  await expect(enabledHandButtons.first()).toBeVisible({ timeout: 10_000 });

  await expect(handButtons.first()).toBeVisible();

  const aiTab = page.getByRole("tab", { name: /^AI$/ });
  await aiTab.click();
  await expect(aiTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "LLM Bots" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI Coach" })).toBeVisible();

  const logTab = page.getByRole("tab", { name: /^Log$/ });
  await logTab.click();
  await expect(logTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Trick Log" })).toBeVisible();

  const playLegalMove = async () => {
    await expect.poll(async () => enabledHandButtons.count(), { timeout: 20_000 }).toBeGreaterThan(0);
    const legal = enabledHandButtons.first();
    await expect(legal).toBeEnabled();
    const label = await legal.getAttribute("aria-label");
    await legal.click();
    if (label) {
      await expect(page.locator(`button[aria-label="${label}"]`)).toHaveCount(0);
    }
  };

  for (let i = 0; i < 3; i += 1) {
    await playLegalMove();
  }

  expect(errors, `Console/page errors:\n${errors.join("\n")}`).toEqual([]);
});
