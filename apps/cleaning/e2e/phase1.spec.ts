import { test, expect } from "@playwright/test"

// First end-to-end flow: an admin builds the front half of the cleaning
// workflow — Customer → Service Location → Scope/Checklist → Service Plan —
// and confirms every record persists and displays.

test("admin: customer → site → scope → service plan", async ({ page }) => {
  const stamp = Date.now()
  const customerName = `E2E Facilities ${stamp}`
  const siteName = `E2E Site ${stamp}`
  const checklistName = `E2E Nightly ${stamp}`
  const planName = `E2E Plan ${stamp}`

  // Log in as an admin (management shell).
  await page.goto("/login")
  await page.fill("#email", "admin@sparkle.test")
  await page.fill("#password", "password123")
  await page.click('button[type="submit"]')
  await page.waitForURL("**/dashboard")

  // Create a customer.
  await page.goto("/customers")
  await page.getByRole("button", { name: "New customer" }).click()
  const customerDialog = page.getByRole("dialog")
  await customerDialog.locator("#c-name").fill(customerName)
  await customerDialog.getByRole("button", { name: "Create customer" }).click()
  await expect(page.getByRole("link", { name: customerName })).toBeVisible()

  // Open the customer and add a service location.
  await page.getByRole("link", { name: customerName }).click()
  await page.getByRole("button", { name: "Add site" }).click()
  const siteDialog = page.getByRole("dialog")
  await siteDialog.locator("#s-name").fill(siteName)
  await siteDialog.locator("#s-city").fill("Detroit")
  await siteDialog.getByRole("button", { name: "Add site" }).click()
  await expect(page.getByRole("link", { name: siteName })).toBeVisible()

  // Open the site, define a scope/checklist.
  await page.getByRole("link", { name: siteName }).first().click()
  await page.getByRole("button", { name: "New checklist" }).click()
  const scopeDialog = page.getByRole("dialog")
  await scopeDialog.locator("#sc-name").fill(checklistName)
  await scopeDialog.locator('input[placeholder^="Task"]').first().fill("Empty all trash")
  await scopeDialog.getByRole("button", { name: "Create checklist" }).click()
  await expect(page.getByText(checklistName, { exact: true })).toBeVisible()

  // Create a recurring service plan referencing that scope.
  await page.getByRole("button", { name: "Create service plan" }).click()
  const planDialog = page.getByRole("dialog")
  await planDialog.locator("#p-name").fill(planName)
  await planDialog.locator("#p-tpl").selectOption({ label: checklistName })
  await planDialog.getByRole("button", { name: "Create service plan" }).click()
  await expect(page.getByText(planName)).toBeVisible()

  // Reload and confirm persistence.
  await page.reload()
  await expect(page.getByText(planName)).toBeVisible()
  await expect(page.getByText(checklistName, { exact: true })).toBeVisible()
})
