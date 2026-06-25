import crypto from "node:crypto";
import type { Change, LmsItem } from "./types.js";

export function hashText(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function makeFingerprint(parts: Array<string | undefined | null>): string {
  return hashText(parts.filter(Boolean).join("|").toLowerCase().trim());
}

export function diffItems(previous: LmsItem[], current: LmsItem[]): Change[] {
  const previousMap = new Map(previous.map((item) => [item.id, item]));
  const currentMap = new Map(current.map((item) => [item.id, item]));
  const changes: Change[] = [];

  for (const item of current) {
    const oldItem = previousMap.get(item.id);

    if (!oldItem) {
      changes.push({ kind: "new", item });
      continue;
    }

    if (oldItem.fingerprint !== item.fingerprint) {
      changes.push({ kind: "changed", before: oldItem, after: item });
    }
  }

  for (const item of previous) {
    if (!currentMap.has(item.id)) {
      changes.push({ kind: "removed", item });
    }
  }

  return changes;
}
