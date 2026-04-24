import { expect, test } from "@playwright/test";

test("auth pages expose their primary submit buttons", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();

  await page.goto("/register");
  await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
});
