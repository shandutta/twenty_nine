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

  await page.goto("/game", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Game Table" })).toBeVisible();
  await expect(page.getByText("Current Trick")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Trick Log" })).toBeVisible();
  await expect(page.getByText("You")).toBeVisible();

  const youPanel = page.getByText("You").locator("..").locator("..");
  const firstLegal = youPanel.locator("button:not([disabled])").first();
  await expect(firstLegal).toBeVisible();
  await firstLegal.click();

  await expect(page.getByText(/Last move:/)).toContainText(/played/i);

  await expect.poll(
    async () => youPanel.locator("button:not([disabled])").count(),
    { timeout: 15_000 }
  ).toBeGreaterThan(0);

  const secondLegal = youPanel.locator("button:not([disabled])").first();
  await secondLegal.click();

  expect(errors, `Console/page errors:\n${errors.join("\n")}`).toEqual([]);
});
