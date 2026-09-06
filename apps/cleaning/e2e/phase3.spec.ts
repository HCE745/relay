import { test, expect } from "@playwright/test"

// A 1x1 PNG as a proof-photo fixture.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
)

async function loginAs(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login")
  await page.fill("#email", email)
  await page.fill("#password", "password123")
  await page.click('button[type="submit"]')
}

test("cleaner performs a full shift; blocked until required photo added", async ({ page }) => {
  // Cleaner logs in and is routed to the field app.
  await loginAs(page, "cleaner@sparkle.test")
  await page.waitForURL("**/today")
  await expect(page.getByRole("heading", { name: "Today's Work" })).toBeVisible()

  // Open the assigned job.
  await page.getByText("Field Demo Co").click()
  await page.waitForURL("**/job/**")
  await expect(page.getByText("Field Demo Site")).toBeVisible()

  // Clock in.
  await page.getByRole("button", { name: "Clock in" }).click()
  await expect(page.getByRole("button", { name: "Clock out & finish" })).toBeVisible()

  // Complete both checklist items.
  const marks = page.getByRole("button", { name: "Mark complete" })
  await expect(marks).toHaveCount(2)
  await marks.first().click()
  await expect(marks).toHaveCount(1)
  await marks.first().click()
  await expect(marks).toHaveCount(0)

  // Attempt to clock out — blocked because a required photo is missing.
  await page.getByRole("button", { name: "Clock out & finish" }).click()
  await expect(page.getByText(/Finish required work/)).toBeVisible()
  await expect(page.getByText(/Photo required/)).toBeVisible()

  // Add the required proof photo, then a job note.
  await page.locator('input[type="file"]').first().setInputFiles({ name: "proof.png", mimeType: "image/png", buffer: PNG })
  await expect(page.getByText("Photo added ✓ — retake")).toBeVisible()
  await page.locator("textarea").first().fill("All done, lobby looked great.")
  await page.getByRole("button", { name: "Save note" }).click()

  // Now clock out succeeds.
  await page.getByRole("button", { name: "Clock out & finish" }).click()
  await expect(page.getByText("Job completed ✓")).toBeVisible()
})

test("manager sees execution results", async ({ page }) => {
  await loginAs(page, "admin@sparkle.test")
  await page.waitForURL("**/dashboard")

  // The seeded job is earlier today, so use the week Schedule (shows all of
  // today) rather than the future-only Jobs list.
  await page.goto("/schedule")
  await page.getByText("Field Demo Co").first().click()
  await page.waitForURL("**/jobs/**")

  await expect(page.getByText("Completed", { exact: true })).toBeVisible()
  // Actual start/end recorded.
  await expect(page.getByText("Actual start")).toBeVisible()
  await expect(page.getByText("Actual end")).toBeVisible()
  // Time worked shows the cleaner.
  await expect(page.getByText("Time worked")).toBeVisible()
  await expect(page.getByText("Casey Cleaner").first()).toBeVisible()
  // Proof of service present.
  await expect(page.getByText("Proof of service")).toBeVisible()
  await expect(page.locator('img[alt="Proof photo"]').first()).toBeVisible()
})
