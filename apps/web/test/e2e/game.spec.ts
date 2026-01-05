import { test, expect, type Locator } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

test("game page smoke flow", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      if (
        text.includes("React has detected a change in the order of Hooks called by") ||
        text.includes("Should have a queue. You are likely calling Hooks conditionally") ||
        (text.includes("WebSocket connection to") && text.includes("/_next/webpack-hmr"))
      ) {
        return;
      }
      errors.push(text);
    }
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown failure";
    const url = request.url();
    if (
      (failure.includes("net::ERR_ABORTED") && url.includes("_rsc")) ||
      (url.includes("/_next/webpack-hmr") && failure.includes("ERR_CONNECTION_REFUSED"))
    ) {
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
  await expect(page.getByTestId("player-hand-status")).toBeVisible();

  const aiTab = page.getByRole("tab", { name: /^AI$/ });
  await aiTab.click();
  await expect(aiTab).toHaveAttribute("aria-selected", "true");
  const llmHeading = page.getByRole("heading", { name: "LLM Bots" });
  await expect(llmHeading).toBeVisible();
  const llmCard = llmHeading.locator("..").locator("..");
  const aiSwitch = llmCard.getByRole("switch").first();
  if ((await aiSwitch.getAttribute("aria-checked")) === "true") {
    await aiSwitch.click();
  }
  const overviewTab = page.getByRole("tab", { name: /^Overview$/ });
  await overviewTab.click();
  await expect(overviewTab).toHaveAttribute("aria-selected", "true");

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
  const resolveTrickButton = page.getByRole("button", { name: /OK - Next trick/i });
  const dismissTrickDialog = async () => {
    if (await resolveTrickButton.isVisible({ timeout: 500 }).catch(() => false)) {
      await resolveTrickButton.click();
      await page.waitForTimeout(250);
    }
  };
  const clickIfReady = async (locator: Locator, timeoutMs = 2000) => {
    if ((await locator.count()) === 0) return false;
    const target = locator.first();
    const visible = await target.isVisible({ timeout: 0 }).catch(() => false);
    if (!visible) return false;
    const enabled = await target.isEnabled({ timeout: 0 }).catch(() => true);
    if (!enabled) return false;
    await target.click({ timeout: timeoutMs }).catch(() => {});
    return true;
  };

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    await dismissTrickDialog();
    const bidSelect = page.locator('[data-slot="select-trigger"]').first();
    const placeBid = page.getByRole("button", { name: /^Place bid$/ });
    const bidSelectVisible =
      (await bidSelect.count()) > 0 && (await bidSelect.isVisible({ timeout: 0 }).catch(() => false));
    const placeBidEnabled =
      (await placeBid.count()) > 0 &&
      (await placeBid
        .first()
        .isEnabled({ timeout: 0 })
        .catch(() => false));
    if (bidSelectVisible && !placeBidEnabled) {
      await clickIfReady(bidSelect);
      const option = page.getByRole("option", { name: /Bid \d+/ }).first();
      if (await option.isVisible({ timeout: 0 }).catch(() => false)) {
        await option.click({ timeout: 2000 }).catch(() => {});
      }
    }
    if (placeBidEnabled && (await clickIfReady(placeBid))) {
      await page.waitForTimeout(300);
      continue;
    }

    const passButton = page.getByRole("button", { name: /^Pass$/ });
    const passEnabled =
      (await passButton.count()) > 0 &&
      (await passButton
        .first()
        .isEnabled({ timeout: 0 })
        .catch(() => false));
    if (passEnabled && (await clickIfReady(passButton))) {
      await page.waitForTimeout(300);
      continue;
    }

    const useSeventh = page.getByRole("button", { name: /Use 7th card/i });
    if (await clickIfReady(useSeventh)) {
      await page.waitForTimeout(300);
      continue;
    }

    const noTrump = page.getByRole("button", { name: /No trump/i });
    if (await clickIfReady(noTrump)) {
      await page.waitForTimeout(300);
      continue;
    }

    const joker = page.getByRole("button", { name: /Joker/i });
    if (await clickIfReady(joker)) {
      await page.waitForTimeout(300);
      continue;
    }

    const trumpSuitButton = page.getByRole("button", { name: /Clubs|Diamonds|Hearts|Spades/i });
    if (await clickIfReady(trumpSuitButton)) {
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

  await aiTab.click();
  await expect(aiTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "LLM Bots" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI Coach" })).toBeVisible();

  const logTab = page.getByRole("tab", { name: /^Log$/ });
  await logTab.click();
  await expect(logTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Trick Log" })).toBeVisible();

  const playLegalMove = async () => {
    await expect
      .poll(
        async () => {
          await dismissTrickDialog();
          return enabledHandButtons.count();
        },
        { timeout: 20_000 }
      )
      .toBeGreaterThan(0);
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
