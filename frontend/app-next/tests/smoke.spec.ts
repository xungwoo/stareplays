import { test, expect } from "@playwright/test";

test("replay vault page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Replay Upload Module" })).toBeVisible();
});

test("rankings page renders", async ({ page }) => {
  await page.goto("/rankings");
  await expect(page.getByRole("heading", { name: "Rankings Workspace" })).toBeVisible();
});

test("analyzer page renders", async ({ page }) => {
  await page.goto("/analyzer");
  await expect(page.getByRole("heading", { name: "Game Analyzer" })).toBeVisible();
});
