import { test, expect, type Page } from "@playwright/test"

async function signIn(page: Page, email: string, password: string) {
  await page.context().clearCookies()
  await page.goto("/login")
  await page.fill("#email", email)
  await page.fill("#password", password)
  await page.click('button[type="submit"]')
}

test("bootstrap → team → credentials → deactivated login blocked", async ({ page }) => {
  const stamp = Date.now()
  const company = `Bootstrap Co ${stamp}`
  const ownerEmail = `owner${stamp}@bootstrap.test`
  const cleanerEmail = `cleaner${stamp}@bootstrap.test`

  // Create the organization + owner via the product bootstrap (token-gated).
  await page.goto("/register")
  await page.fill('input[name="orgName"]', company)
  await page.fill('input[name="name"]', "Owner Person")
  await page.fill('input[name="email"]', ownerEmail)
  await page.fill('input[name="password"]', "ownerpass123")
  await page.fill('input[name="bootstrapToken"]', "e2e-setup-code")
  await page.getByRole("button", { name: "Create company" }).click()
  await page.waitForURL("**/dashboard")

  // Add an employee with a temporary password.
  await page.goto("/team")
  await page.getByRole("button", { name: "Add employee" }).click()
  const dlg = page.getByRole("dialog")
  await dlg.locator("#u-name").fill("Field Worker")
  await dlg.locator("#u-email").fill(cleanerEmail)
  await dlg.locator("#u-pass").fill("temppass123")
  await dlg.getByRole("button", { name: "Create employee" }).click()
  await expect(page.getByText(cleanerEmail)).toBeVisible()

  // The new employee can sign in and reaches the field app.
  await signIn(page, cleanerEmail, "temppass123")
  await page.waitForURL("**/today")
  await expect(page.getByRole("heading", { name: "Today's Work" })).toBeVisible()

  // Owner deactivates the employee.
  await signIn(page, ownerEmail, "ownerpass123")
  await page.waitForURL("**/dashboard")
  await page.goto("/team")
  const row = page.getByRole("row").filter({ hasText: cleanerEmail })
  await row.getByRole("button", { name: "Deactivate" }).click()
  await expect(page.getByRole("row").filter({ hasText: cleanerEmail })).toContainText("Inactive")

  // Deactivated employee can no longer sign in.
  await signIn(page, cleanerEmail, "temppass123")
  await expect(page.getByRole("alert").first()).toContainText("Invalid credentials")
})

test("manager works an issue from open to resolved", async ({ page }) => {
  await signIn(page, "admin@sparkle.test", "password123")
  await page.waitForURL("**/dashboard")

  await page.goto("/issues")
  await page.getByText("Broken soap dispenser").click()
  await page.waitForURL("**/issues/**")

  // Assign an owner.
  await page.getByRole("combobox").selectOption({ label: "Casey Cleaner" })
  // Acknowledge.
  await page.getByRole("button", { name: "Acknowledge" }).click()
  await expect(page.getByText("ACKNOWLEDGED").first()).toBeVisible()
  // Add a note.
  await page.locator("textarea").fill("Ordered a replacement dispenser.")
  await page.getByRole("button", { name: "Add note" }).click()
  await expect(page.getByText("Ordered a replacement dispenser.")).toBeVisible()
  // Resolve.
  await page.getByRole("button", { name: "Resolve" }).click()
  await expect(page.getByText("RESOLVED").first()).toBeVisible()
})
