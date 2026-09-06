import { test, expect } from "@playwright/test"

// Phase 2 end-to-end: an admin turns a recurring plan into scheduled work and
// assigns a cleaner; a supervisor gets read-only visibility.

const today = new Date().toISOString().slice(0, 10)

async function loginAs(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login")
  await page.fill("#email", email)
  await page.fill("#password", "password123")
  await page.click('button[type="submit"]')
  await page.waitForURL("**/dashboard")
}

test("admin: service plan → generate jobs → schedule → assign cleaner", async ({ page }) => {
  const stamp = Date.now()
  const customerName = `Sched Co ${stamp}`
  const siteName = `Sched Site ${stamp}`
  const checklistName = `Sched List ${stamp}`
  const planName = `Nightly ${stamp}`

  await loginAs(page, "admin@sparkle.test")

  // Fixtures: customer → site.
  await page.goto("/customers")
  await page.getByRole("button", { name: "New customer" }).click()
  await page.getByRole("dialog").locator("#c-name").fill(customerName)
  await page.getByRole("dialog").getByRole("button", { name: "Create customer" }).click()
  await page.getByRole("link", { name: customerName }).click()
  await page.getByRole("button", { name: "Add site" }).click()
  await page.getByRole("dialog").locator("#s-name").fill(siteName)
  await page.getByRole("dialog").getByRole("button", { name: "Add site" }).click()
  await page.getByRole("link", { name: siteName }).first().click()

  // Scope + recurring plan (daily, starting today).
  await page.getByRole("button", { name: "New checklist" }).click()
  await page.getByRole("dialog").locator("#sc-name").fill(checklistName)
  await page.getByRole("dialog").locator('input[placeholder^="Task"]').first().fill("Empty trash")
  await page.getByRole("dialog").getByRole("button", { name: "Create checklist" }).click()
  await expect(page.getByText(checklistName, { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Create service plan" }).click()
  const planDialog = page.getByRole("dialog")
  await planDialog.locator("#p-name").fill(planName)
  await planDialog.locator("#p-freq").selectOption("DAILY")
  await planDialog.locator("#p-start").fill(today)
  await planDialog.locator("#p-tpl").selectOption({ label: checklistName })
  await planDialog.getByRole("button", { name: "Create service plan" }).click()
  await expect(page.getByText(planName)).toBeVisible()

  // Generate concrete jobs.
  await page.getByRole("button", { name: "Generate jobs" }).click()
  const genDialog = page.getByRole("dialog")
  await genDialog.getByRole("button", { name: "Generate jobs" }).click()
  await expect(genDialog.getByText(/Created \d+ job/)).toBeVisible()
  await page.keyboard.press("Escape")

  // Schedule renders; Jobs list shows the generated work.
  await page.goto("/schedule")
  await expect(page.getByText(/Week of/)).toBeVisible()
  await page.goto("/jobs")
  await expect(page.getByText(customerName).first()).toBeVisible()

  // Open the first job (its date cell links to the detail page).
  await page.getByRole("row").nth(1).getByRole("link").first().click()
  await page.waitForURL("**/jobs/**")
  await expect(page.getByText("Assigned cleaners")).toBeVisible()
  await page.getByRole("combobox").selectOption({ label: "Casey Cleaner" })
  await page.getByRole("button", { name: "Assign", exact: true }).click()
  await expect(page.getByText("Casey Cleaner")).toBeVisible()

  // Persist across reload.
  await page.reload()
  await expect(page.getByText("Casey Cleaner")).toBeVisible()
})

test("supervisor: read-only schedule access", async ({ page }) => {
  await loginAs(page, "supervisor@sparkle.test")
  // Can view jobs…
  await page.goto("/jobs")
  await expect(page.getByRole("heading", { name: "Jobs" })).toBeVisible()
  // …but has no create controls.
  await expect(page.getByRole("button", { name: "New job" })).toHaveCount(0)
  // …and cannot reach customer administration (redirected to dashboard).
  await page.goto("/customers")
  await page.waitForURL("**/dashboard")
})
