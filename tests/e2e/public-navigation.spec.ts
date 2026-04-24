import { expect, test } from "@playwright/test";

test("landing page CTAs navigate to auth screens", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: /login/i }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/");
  await page.getByRole("link", { name: /get started|claim your subdomain/i }).first().click();
  await expect(page).toHaveURL(/\/register$/);
});
