import { test, expect } from "@playwright/test";

test("game page smoke flow", async ({ page }) => {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown failure";
    errors.push(`Request failed: ${request.url()} (${failure})`);
  });
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });

  await page.goto("/game", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Game Table" })).toBeVisible();
  await expect(page.getByText("Current Trick")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Trick Log" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "LLM Bots" })).toBeVisible();

  const currentPlayerRow = page.getByText("Current player").first().locator("..");
  await expect
    .poll(async () => currentPlayerRow.locator("span").nth(1).textContent())
    .toContain("You");

  const handButtons = page
    .locator("section")
    .locator("button")
    .filter({ hasText: /^(10|[7-9]|J|Q|K|A)[CDHS]$/ });
  const enabledHandButtons = page
    .locator("section")
    .locator("button:not([disabled])")
    .filter({ hasText: /^(10|[7-9]|J|Q|K|A)[CDHS]$/ });

  await expect(handButtons.first()).toBeVisible();
  const firstLegal = enabledHandButtons.first();
  await expect(firstLegal).toBeEnabled();
  const firstLabel = await firstLegal.textContent();
  await firstLegal.click();

  if (firstLabel) {
    await expect(
      handButtons.filter({ hasText: firstLabel })
    ).toHaveCount(0);
  }

  await expect.poll(async () => enabledHandButtons.count(), { timeout: 15_000 })
    .toBeGreaterThan(0);

  const secondLegal = enabledHandButtons.first();
  await secondLegal.click();

  expect(errors, `Console/page errors:\n${errors.join("\n")}`).toEqual([]);
});
