import { env } from "../env.js";
import type { Snapshot } from "../types.js";

export const SNAPSHOT_KEY = "lms-watcher:snapshot";

function kvValueUrl(key: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${env.cfAccountId}/storage/kv/namespaces/${env.cfKvNamespaceId}/values/${encodeURIComponent(key)}`;
}

async function cfFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.cfApiToken}`,
      ...(init.headers ?? {})
    }
  });
}

export async function readJson<T>(key: string): Promise<T | null> {
  const response = await cfFetch(kvValueUrl(key));

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(`Cloudflare KV read failed: ${response.status} ${await response.text()}`);
  }

  const text = await response.text();
  return text.trim() ? (JSON.parse(text) as T) : null;
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  const response = await cfFetch(kvValueUrl(key), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value)
  });

  if (!response.ok) {
    throw new Error(`Cloudflare KV write failed: ${response.status} ${await response.text()}`);
  }
}

export function readSnapshot(): Promise<Snapshot | null> {
  return readJson<Snapshot>(SNAPSHOT_KEY);
}

export function writeSnapshot(snapshot: Snapshot): Promise<void> {
  return writeJson(SNAPSHOT_KEY, snapshot);
}
