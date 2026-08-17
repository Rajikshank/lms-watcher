import { existsSync, readFileSync, writeFileSync } from "node:fs";

export type EnvMap = Map<string, string>;

export function parseEnv(content: string): EnvMap {
  const values: EnvMap = new Map();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    let value = rawValue.trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values.set(key, value);
  }

  return values;
}

export function formatEnv(values: EnvMap): string {
  return `${Array.from(values.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")}\n`;
}

export function readEnvFile(path = ".env"): EnvMap {
  if (!existsSync(path)) return new Map();
  return parseEnv(readFileSync(path, "utf8"));
}

export function writeEnvFile(values: EnvMap, path = ".env"): void {
  writeFileSync(path, formatEnv(values), { encoding: "utf8" });
}

export function mergeEnv(existing: EnvMap, updates: Record<string, string>): EnvMap {
  const merged = new Map(existing);

  for (const [key, value] of Object.entries(updates)) {
    merged.set(key, value);
  }

  return merged;
}

export function csv(values: string[]): string {
  return values.map((value) => value.trim()).filter(Boolean).join(",");
}

