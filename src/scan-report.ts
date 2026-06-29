import type { LmsItem, ScanStatus } from "./types.js";

type GapWarningInput = {
  previousScannedAt: string;
  currentScannedAt: string;
  gapMinutes: number;
  thresholdMinutes: number;
};

function formatCounts(counts: Record<string, number>): string {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([type, count]) => `${type}: ${count}`)
    .join(", ");
}

function minutesBetween(left: string | undefined, right: string): number {
  if (!left) return Number.POSITIVE_INFINITY;

  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);

  if (Number.isNaN(leftMs) || Number.isNaN(rightMs)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.floor((rightMs - leftMs) / 60_000);
}

export function countItemsByType(items: LmsItem[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const item of items) {
    counts[item.type] = (counts[item.type] ?? 0) + 1;
  }

  return Object.fromEntries(Object.entries(counts).sort());
}

export function shouldSendGapWarning(
  previousScannedAt: string | undefined,
  currentScannedAt: string,
  thresholdMinutes: number
): { shouldSend: boolean; gapMinutes: number } {
  const gapMinutes = minutesBetween(previousScannedAt, currentScannedAt);
  return {
    shouldSend: Number.isFinite(gapMinutes) && gapMinutes >= thresholdMinutes,
    gapMinutes
  };
}

export function shouldSendHealthReport(
  previousStatus: ScanStatus | null,
  currentScannedAt: string,
  intervalHours: number
): boolean {
  if (intervalHours <= 0) return false;

  const gapMinutes = minutesBetween(previousStatus?.lastHealthNotifiedAt, currentScannedAt);
  return !Number.isFinite(gapMinutes) || gapMinutes >= intervalHours * 60;
}

export function formatGapWarning(input: GapWarningInput): string {
  return [
    "[WARN] LMS Watcher scan gap",
    "",
    `Gap: ${input.gapMinutes} minutes`,
    "Expected: every 30 minutes",
    `Warning threshold: ${input.thresholdMinutes} minutes`,
    `Previous scan: ${input.previousScannedAt}`,
    `Current scan: ${input.currentScannedAt}`,
    "",
    "This usually means GitHub Actions schedule was delayed or skipped."
  ].join("\n");
}

export function formatHealthReport(status: ScanStatus): string {
  const countText = formatCounts(status.itemCounts);
  const heading = status.status === "failed"
    ? "[ERROR] LMS Watcher last scan failed"
    : "[OK] LMS Watcher scan healthy";

  return [
    heading,
    "",
    `Scanned: ${status.scannedAt}`,
    `Items: ${status.totalItems}`,
    countText ? `Types: ${countText}` : undefined,
    `Raw Moodle items: ${status.rawMoodleItems}`,
    `Raw calendar items: ${status.rawCalendarItems}`,
    `Changes notified: ${status.notifiedChanges}`,
    `Pending alerts: ${status.pendingNotifications ?? 0}`,
    status.status === "failed"
      ? `Consecutive failures: ${status.consecutiveFailures ?? 1}`
      : undefined,
    `Screenshots sent: ${status.screenshotsSent}`,
    `Duration: ${Math.round(status.durationMs / 1000)}s`,
    status.filterSummary
  ].filter(Boolean).join("\n");
}

export function formatRecoveryReport(input: {
  scannedAt: string;
  consecutiveFailures: number;
  pendingNotifications: number;
}): string {
  return [
    "[RECOVERED] LMS Watcher is working again",
    "",
    `Recovered: ${input.scannedAt}`,
    `Failed scans: ${input.consecutiveFailures}`,
    `Pending alerts: ${input.pendingNotifications}`,
    "Monitoring continues normally.",
  ].join("\n");
}
