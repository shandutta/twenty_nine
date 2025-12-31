import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

test("game page smoke flow", async ({ page }) => {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
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

  await expect(page.getByRole("heading", { name: "Game Table" })).toBeVisible();
  await expect(page.getByText("Current Trick")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Trick Log" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "LLM Bots" })).toBeVisible();

  const screenshotDir = path.resolve(
    process.cwd(),
    "..",
    "..",
    "docs",
    "ux",
    "screens"
  );
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

  const handButtons = page
    .locator("section")
    .locator("button")
    .filter({ hasText: /^(10|[7-9]|J|Q|K|A)[CDHS]$/ });
  const enabledHandButtons = page
    .locator("section")
    .locator("button:not([disabled])")
    .filter({ hasText: /^(10|[7-9]|J|Q|K|A)[CDHS]$/ });

  const biddingHeading = page.getByRole("heading", { name: "Bidding" });
  const trumpHeading = page.getByRole("heading", { name: "Choose Trump" });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await biddingHeading.isVisible().catch(() => false)) {
      const enabledBid = page
        .locator("button:not([disabled])")
        .filter({ hasText: /Bid \d+/ })
        .first();
      if (await enabledBid.isVisible().catch(() => false)) {
        await enabledBid.click();
        await page.waitForTimeout(300);
        continue;
      }
      const passButton = page
        .locator("button:not([disabled])")
        .filter({ hasText: /^Pass$/ })
        .first();
      if (await passButton.isVisible().catch(() => false)) {
        await passButton.click();
        await page.waitForTimeout(300);
        continue;
      }
    }

    if (await trumpHeading.isVisible().catch(() => false)) {
      const enabledTrump = page
        .locator("button:not([disabled])")
        .filter({ hasText: /Clubs|Diamonds|Hearts|Spades/ })
        .first();
      if (await enabledTrump.isVisible().catch(() => false)) {
        await enabledTrump.click();
        await page.waitForTimeout(300);
        continue;
      }
    }

    if ((await enabledHandButtons.count()) > 0) {
      break;
    }
    await page.waitForTimeout(250);
  }

  await expect(enabledHandButtons.first()).toBeVisible({ timeout: 10_000 });

  await expect(handButtons.first()).toBeVisible();

  const playLegalMove = async () => {
    await expect
      .poll(async () => enabledHandButtons.count(), { timeout: 20_000 })
      .toBeGreaterThan(0);
    const legal = enabledHandButtons.first();
    await expect(legal).toBeEnabled();
    const label = await legal.textContent();
    await legal.click();
    if (label) {
      await expect(handButtons.filter({ hasText: label })).toHaveCount(0);
    }
  };

  for (let i = 0; i < 3; i += 1) {
    await playLegalMove();
  }

  expect(errors, `Console/page errors:\n${errors.join("\n")}`).toEqual([]);
});
