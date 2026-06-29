import crypto from "node:crypto";

import type { Change } from "./types.js";

export type NotificationOutboxEntry = {
  id: string;
  discoveredAt: string;
  attempts: number;
  change: Change;
};

export type NotificationOutbox = {
  version: 1;
  entries: NotificationOutboxEntry[];
};

export function emptyNotificationOutbox(): NotificationOutbox {
  return { version: 1, entries: [] };
}

export function outboxEntryId(change: Change): string {
  const item = change.kind === "changed" ? change.after : change.item;
  return crypto
    .createHash("sha256")
    .update([change.kind, item.id, item.fingerprint].join("|"))
    .digest("hex");
}

export function mergeOutboxChanges(
  outbox: NotificationOutbox,
  changes: Change[],
  discoveredAt: string,
): NotificationOutbox {
  const entries = [...outbox.entries];
  const ids = new Set(entries.map((entry) => entry.id));

  for (const change of changes) {
    const id = outboxEntryId(change);
    if (ids.has(id)) continue;

    ids.add(id);
    entries.push({ id, discoveredAt, attempts: 0, change });
  }

  return { version: 1, entries };
}

export function removeOutboxEntry(
  outbox: NotificationOutbox,
  id: string,
): NotificationOutbox {
  return {
    version: 1,
    entries: outbox.entries.filter((entry) => entry.id !== id),
  };
}

export function incrementOutboxAttempt(
  outbox: NotificationOutbox,
  id: string,
): NotificationOutbox {
  return {
    version: 1,
    entries: outbox.entries.map((entry) =>
      entry.id === id ? { ...entry, attempts: entry.attempts + 1 } : entry,
    ),
  };
}
