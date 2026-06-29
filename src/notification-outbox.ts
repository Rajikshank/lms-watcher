import crypto from "node:crypto";

import type { Change, Snapshot } from "./types.js";

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

type StageOptions = {
  writeOutbox: (outbox: NotificationOutbox) => Promise<void>;
  writeSnapshot: (snapshot: Snapshot) => Promise<void>;
};

export async function stageOutboxAndSnapshot(
  outbox: NotificationOutbox,
  changes: Change[],
  snapshot: Snapshot,
  options: StageOptions,
): Promise<NotificationOutbox> {
  const staged = mergeOutboxChanges(outbox, changes, snapshot.scannedAt);
  await options.writeOutbox(staged);
  await options.writeSnapshot(snapshot);
  return staged;
}

type DeliveryResult = { screenshotSent: boolean };

type DrainOptions = {
  persist: (outbox: NotificationOutbox) => Promise<void>;
  deliver: (
    entry: NotificationOutboxEntry,
    screenshotsSent: number,
    acknowledgeText: () => Promise<void>,
  ) => Promise<DeliveryResult>;
};

export async function drainNotificationOutbox(
  outbox: NotificationOutbox,
  options: DrainOptions,
): Promise<{
  outbox: NotificationOutbox;
  delivered: number;
  screenshotsSent: number;
}> {
  let current = outbox;
  let delivered = 0;
  let screenshotsSent = 0;

  while (current.entries.length > 0) {
    const entryId = current.entries[0]!.id;
    current = incrementOutboxAttempt(current, entryId);
    await options.persist(current);

    const entry = current.entries.find((candidate) => candidate.id === entryId)!;
    let acknowledged = false;
    const delivery = await options.deliver(entry, screenshotsSent, async () => {
      if (acknowledged) return;
      const remaining = removeOutboxEntry(current, entryId);
      await options.persist(remaining);
      current = remaining;
      acknowledged = true;
      delivered += 1;
    });

    if (!acknowledged) {
      throw new Error(`Notification delivery did not acknowledge text for outbox entry ${entryId}`);
    }

    if (delivery.screenshotSent) {
      screenshotsSent += 1;
    }
  }

  return { outbox: current, delivered, screenshotsSent };
}
