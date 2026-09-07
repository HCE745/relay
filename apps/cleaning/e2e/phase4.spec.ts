import { test, expect } from "@playwright/test"

async function loginAs(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login")
  await page.fill("#email", email)
  await page.fill("#password", "password123")
  await page.click('button[type="submit"]')
  await page.waitForURL("**/dashboard")
}

async function openCompletedJob(page: import("@playwright/test").Page) {
  await page.goto("/schedule")
  await page.getByText("Inspect Co").first().click()
  await page.waitForURL("**/jobs/**")
  await expect(page.getByText("Completed", { exact: true })).toBeVisible()
}

// Score the runner: choices[i] applies to item i; then finalize.
async function scoreAndFinalize(page: import("@playwright/test").Page, choices: string[]) {
  const finalize = page.getByRole("button", { name: /Score all items|Finalize inspection/ })
  for (let i = 0; i < choices.length; i++) {
    await page.getByRole("button", { name: choices[i], exact: true }).nth(i).click()
    const n = i + 1
    await expect(finalize).toContainText(n < choices.length ? `${n}/${choices.length}` : "Finalize inspection")
  }
  await finalize.click()
}

test("manager runs a PASSING inspection", async ({ page }) => {
  await loginAs(page, "admin@sparkle.test")
  await openCompletedJob(page)

  await page.getByRole("button", { name: "Inspect work" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Start inspection" }).click()
  await page.waitForURL("**/inspections/**")

  await expect(page.getByRole("button", { name: "Pass", exact: true })).toHaveCount(4)
  await scoreAndFinalize(page, ["Pass", "Pass", "Pass", "Pass"])
  await expect(page.getByText(/PASS · 100%/)).toBeVisible()
})

test("manager runs a FAILING inspection → quality issue created", async ({ page }) => {
  await loginAs(page, "admin@sparkle.test")
  await openCompletedJob(page)

  await page.getByRole("button", { name: "Inspect work" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Start inspection" }).click()
  await page.waitForURL("**/inspections/**")

  // Fail the critical item (index 1: "Restrooms…"); pass the rest.
  await scoreAndFinalize(page, ["Pass", "Fail", "Pass", "Pass"])
  await expect(page.getByText(/FAIL/).first()).toBeVisible()
  await expect(page.getByText(/quality issue was created/i)).toBeVisible()

  // The linked issue shows up on the job.
  await page.getByRole("link", { name: "← Job" }).click()
  await expect(page.getByText("Reported problems")).toBeVisible()
  await expect(page.getByText("Failed inspection").first()).toBeVisible()
})

test("manager corrects then approves a time entry", async ({ page }) => {
  await loginAs(page, "admin@sparkle.test")
  await page.goto("/time")

  const row = page.getByRole("row").filter({ hasText: "Dana Cleaner" })
  await expect(row).toContainText("Pending")

  // Correct with a required reason.
  await row.getByRole("button", { name: "Correct" }).click()
  const dlg = page.getByRole("dialog")
  await dlg.locator("#c-reason").fill("Adjusting clock-out per supervisor")
  await dlg.getByRole("button", { name: "Save correction" }).click()
  await expect(dlg).toBeHidden()

  // Approve, then confirm it persists.
  await page.getByRole("row").filter({ hasText: "Dana Cleaner" }).getByRole("button", { name: "Approve" }).click()
  await expect(page.getByRole("row").filter({ hasText: "Dana Cleaner" })).toContainText("Approved")
  await page.reload()
  await expect(page.getByRole("row").filter({ hasText: "Dana Cleaner" })).toContainText("Approved")
})
