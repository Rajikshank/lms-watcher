import crypto from "node:crypto";

import type { ScanStatus } from "./types.js";

export type FailureIncidentDecision = {
  errorFingerprint: string;
  incidentStartedAt: string;
  lastErrorNotifiedAt?: string;
  consecutiveFailures: number;
  shouldNotify: boolean;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function fingerprint(error: unknown): string {
  return crypto
    .createHash("sha256")
    .update(errorMessage(error).trim().toLowerCase())
    .digest("hex");
}

export function decideFailureIncident(
  previousStatus: ScanStatus | null,
  error: unknown,
  failedAt: string,
  reminderHours: number,
): FailureIncidentDecision {
  const errorFingerprint = fingerprint(error);
  const continuing =
    previousStatus?.status === "failed" &&
    previousStatus.errorFingerprint === errorFingerprint;

  if (!continuing) {
    return {
      errorFingerprint,
      incidentStartedAt: failedAt,
      lastErrorNotifiedAt: failedAt,
      consecutiveFailures: 1,
      shouldNotify: true,
    };
  }

  const lastNotifiedAt =
    previousStatus.lastErrorNotifiedAt ??
    previousStatus.incidentStartedAt ??
    previousStatus.scannedAt;
  const elapsedMs = Date.parse(failedAt) - Date.parse(lastNotifiedAt);
  const reminderDue =
    reminderHours > 0 &&
    Number.isFinite(elapsedMs) &&
    elapsedMs >= reminderHours * 60 * 60 * 1000;

  return {
    errorFingerprint,
    incidentStartedAt: previousStatus.incidentStartedAt ?? previousStatus.scannedAt,
    lastErrorNotifiedAt: reminderDue ? failedAt : previousStatus.lastErrorNotifiedAt,
    consecutiveFailures: (previousStatus.consecutiveFailures ?? 1) + 1,
    shouldNotify: reminderDue,
  };
}

export function shouldSendRecovery(previousStatus: ScanStatus | null): boolean {
  return previousStatus?.status === "failed";
}
