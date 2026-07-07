// Minimal RFC 5545 ICS generator

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
}

function escape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n")
}

export interface ICSEvent {
  uid: string
  summary: string
  description?: string
  dtStart: Date
  dtEnd?: Date
  url?: string
  organizer?: string
}

export function buildICS(events: ICSEvent[], calName = "Relay"): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Relay//Relay//EN",
    `X-WR-CALNAME:${escape(calName)}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ]

  for (const ev of events) {
    const end = ev.dtEnd ?? new Date(ev.dtStart.getTime() + 3600000) // +1h default
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.uid}`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(ev.dtStart)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${escape(ev.summary)}`,
      ...(ev.description ? [`DESCRIPTION:${escape(ev.description)}`] : []),
      ...(ev.url ? [`URL:${ev.url}`] : []),
      "END:VEVENT",
    )
  }

  lines.push("END:VCALENDAR")
  return lines.join("\r\n")
}
