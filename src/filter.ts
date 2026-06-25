import { env } from "./env.js";
import type { LmsItem } from "./types.js";

type CourseLike = {
  id?: string;
  name?: string;
};

function normalizeText(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function hasActiveCourseFilter(): boolean {
  return env.watchedCourseIds.length > 0 || env.watchedCourseNames.length > 0;
}

function textMatchesWatchedCourseNames(text: string): boolean {
  const normalizedText = normalizeText(text);

  if (!normalizedText) return false;

  return env.watchedCourseNames.some((name) => {
    const normalizedName = normalizeText(name);
    return normalizedName.length > 0 && normalizedText.includes(normalizedName);
  });
}

export function isWatchedCourse(course: CourseLike): boolean {
  if (!hasActiveCourseFilter()) return true;

  if (course.id && env.watchedCourseIds.includes(course.id)) {
    return true;
  }

  if (course.name && textMatchesWatchedCourseNames(course.name)) {
    return true;
  }

  return false;
}

function extractCourseIdFromText(text: string): string | undefined {
  const match = text.match(/(?:course\/view\.php\?id=|[?&]course=)(\d+)/i);
  return match?.[1];
}

export function isWatchedCalendarItem(item: LmsItem): boolean {
  if (!hasActiveCourseFilter()) return true;

  const searchableText = [item.courseName, item.title, item.description, item.url]
    .filter(Boolean)
    .join(" ");

  const courseId = item.courseId ?? extractCourseIdFromText(searchableText);

  if (courseId && env.watchedCourseIds.includes(courseId)) {
    return true;
  }

  if (textMatchesWatchedCourseNames(searchableText)) {
    return true;
  }

  // Moodle calendar events often do not include the course name clearly.
  // In loose mode, keep unmatched calendar items so you do not miss deadlines.
  return env.calendarFilterMode === "loose";
}

export function isWatchedItem(item: LmsItem): boolean {
  if (!hasActiveCourseFilter()) return true;

  if (item.source === "calendar") {
    return isWatchedCalendarItem(item);
  }

  if (isWatchedCourse({ id: item.courseId, name: item.courseName })) {
    return true;
  }

  const searchableText = [item.courseName, item.title, item.description, item.url]
    .filter(Boolean)
    .join(" ");

  return textMatchesWatchedCourseNames(searchableText);
}

export function getFilterSummary(): string {
  if (!hasActiveCourseFilter()) {
    return "Watching all LMS modules";
  }

  const parts: string[] = [];

  if (env.watchedCourseIds.length > 0) {
    parts.push(`course IDs: ${env.watchedCourseIds.join(", ")}`);
  }

  if (env.watchedCourseNames.length > 0) {
    parts.push(`course names/codes: ${env.watchedCourseNames.join(", ")}`);
  }

  parts.push(`calendar mode: ${env.calendarFilterMode}`);

  return `Watching only ${parts.join(" | ")}`;
}
