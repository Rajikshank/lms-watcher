import ICAL from "ical.js";
import { env } from "../env.js";
import { makeFingerprint } from "../diff.js";
import { isWatchedCalendarItem } from "../filter.js";
import type { LmsItem } from "../types.js";

function extractCourseId(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = value.match(/(?:course\/view\.php\?id=|[?&]course=)(\d+)/i);
  return match?.[1];
}

export async function readCalendarItems(): Promise<LmsItem[]> {
  const response = await fetch(env.moodleCalendarUrl, {
    headers: { "User-Agent": "lms-watcher/0.1" }
  });

  if (!response.ok) {
    throw new Error(`Calendar fetch failed: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();

  if (!text.includes("BEGIN:VCALENDAR")) {
    throw new Error("Calendar URL did not return ICS calendar data. Check your Moodle calendar export URL.");
  }

  const jcal = ICAL.parse(text);
  const calendar = new ICAL.Component(jcal);
  const events = calendar.getAllSubcomponents("vevent");

  const items = events.map((component) => {
    const event = new ICAL.Event(component);
    const title = event.summary || "Untitled calendar event";
    const dueAt = event.startDate?.toString();
    const urlValue = event.component.getFirstPropertyValue("url");
    const url = urlValue ? String(urlValue) : undefined;
    const description = event.description || undefined;
    const stableId = event.uid || `${title}-${dueAt ?? ""}-${url ?? ""}`;
    const courseId = extractCourseId(`${url ?? ""} ${description ?? ""}`);

    return {
      id: `calendar:${stableId}`,
      type: "calendar" as const,
      source: "calendar" as const,
      courseId,
      title,
      url,
      dueAt,
      description,
      fingerprint: makeFingerprint(["calendar", stableId, courseId, title, dueAt, url, description])
    };
  });

  return items.filter(isWatchedCalendarItem);
}
