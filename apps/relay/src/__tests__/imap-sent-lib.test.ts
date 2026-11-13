/**
 * Unit tests for appendToSentFolder (lib/imap-sent.ts).
 * Tests the real function with mocked imapflow.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

// Shared appendMock — reassigned in beforeEach via closures
let appendMock: ReturnType<typeof vi.fn>
let listMock:   ReturnType<typeof vi.fn>
let connectMock: ReturnType<typeof vi.fn>
let closeMock:  ReturnType<typeof vi.fn>
let logoutMock: ReturnType<typeof vi.fn>

vi.mock("imapflow", () => ({
  ImapFlow: vi.fn().mockImplementation(() => ({
    get connect() { return connectMock },
    get list()    { return listMock },
    get append()  { return appendMock },
    get logout()  { return logoutMock },
    get close()   { return closeMock },
  })),
}))

import { appendToSentFolder } from "@/lib/imap-sent"

const MIME_BUFFER = Buffer.from("MIME-Version: 1.0\r\nContent-Type: text/plain\r\n\r\nHello")

beforeEach(() => {
  appendMock  = vi.fn().mockResolvedValue({ uid: 100 })
  listMock    = vi.fn()
  connectMock = vi.fn().mockResolvedValue(undefined)
  closeMock   = vi.fn()
  logoutMock  = vi.fn().mockResolvedValue(undefined)
})

describe("appendToSentFolder", () => {
  it("returns ok=true and folderPath on success (special-use flag)", async () => {
    listMock.mockResolvedValue([
      { path: "Sent",  name: "Sent",  specialUse: "\\Sent" },
      { path: "INBOX", name: "INBOX", specialUse: null },
    ])

    const result = await appendToSentFolder(
      { host: "imap.titan.email", port: 993, emailAddress: "rachel@getrelay.software" },
      "pw",
      MIME_BUFFER,
    )

    expect(result.ok).toBe(true)
    expect(result.folderPath).toBe("Sent")
    expect(appendMock).toHaveBeenCalledWith("Sent", MIME_BUFFER, ["\\Seen"], expect.any(Date))
  })

  it("returns ok=false and error when IMAP connect fails (never throws)", async () => {
    connectMock = vi.fn().mockRejectedValue(new Error("Auth not allowed for mailbox"))

    const result = await appendToSentFolder(
      { host: "imap.titan.email", port: 993, emailAddress: "rachel@getrelay.software" },
      "pw",
      MIME_BUFFER,
    )

    expect(result.ok).toBe(false)
    expect(result.error).toContain("Auth not allowed")
    expect(appendMock).not.toHaveBeenCalled()
  })

  it("discovers Sent folder by \\Sent special-use flag on non-standard path", async () => {
    listMock.mockResolvedValue([
      { path: "[Gmail]/Sent Mail", name: "Sent Mail", specialUse: "\\Sent" },
      { path: "INBOX",             name: "INBOX",     specialUse: null },
    ])

    const result = await appendToSentFolder(
      { host: "imap.titan.email", port: 993, emailAddress: "u@example.com" },
      "pw",
      MIME_BUFFER,
    )

    expect(result.ok).toBe(true)
    expect(result.folderPath).toBe("[Gmail]/Sent Mail")
    expect(appendMock).toHaveBeenCalledWith("[Gmail]/Sent Mail", MIME_BUFFER, ["\\Seen"], expect.any(Date))
  })

  it("falls back to 'Sent' folder name when no special-use flag is advertised", async () => {
    listMock.mockResolvedValue([
      { path: "INBOX", name: "INBOX", specialUse: null },
      { path: "Sent",  name: "Sent",  specialUse: null },
      { path: "Trash", name: "Trash", specialUse: null },
    ])

    const result = await appendToSentFolder(
      { host: "imap.titan.email", port: 993, emailAddress: "u@example.com" },
      "pw",
      MIME_BUFFER,
    )

    expect(result.ok).toBe(true)
    expect(result.folderPath).toBe("Sent")
  })

  it("falls back to 'Sent Items' name when that folder exists and no flag is set", async () => {
    listMock.mockResolvedValue([
      { path: "INBOX",      name: "INBOX",      specialUse: null },
      { path: "Sent Items", name: "Sent Items", specialUse: null },
    ])

    const result = await appendToSentFolder(
      { host: "imap.titan.email", port: 993, emailAddress: "u@example.com" },
      "pw",
      MIME_BUFFER,
    )

    expect(result.ok).toBe(true)
    expect(result.folderPath).toBe("Sent Items")
  })

  it("passes sentAt date to append as IMAP internal date", async () => {
    listMock.mockResolvedValue([{ path: "Sent", name: "Sent", specialUse: "\\Sent" }])
    const sentAt = new Date("2024-11-01T10:00:00Z")

    await appendToSentFolder(
      { host: "imap.titan.email", port: 993, emailAddress: "u@example.com" },
      "pw",
      MIME_BUFFER,
      sentAt,
    )

    expect(appendMock).toHaveBeenCalledWith("Sent", MIME_BUFFER, ["\\Seen"], sentAt)
  })

  it("returns ok=false when append itself throws", async () => {
    listMock.mockResolvedValue([{ path: "Sent", name: "Sent", specialUse: "\\Sent" }])
    appendMock = vi.fn().mockRejectedValue(new Error("IMAP APPEND rejected: mailbox full"))

    const result = await appendToSentFolder(
      { host: "imap.titan.email", port: 993, emailAddress: "u@example.com" },
      "pw",
      MIME_BUFFER,
    )

    expect(result.ok).toBe(false)
    expect(result.error).toContain("APPEND rejected")
  })
})
