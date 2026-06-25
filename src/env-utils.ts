type EnvSource = Record<string, string | undefined>;

export function requiredAny(names: string[], source: EnvSource = process.env): string {
  for (const name of names) {
    const value = source[name];

    if (value && value.trim() !== "") {
      return value.trim();
    }
  }

  const [primaryName, ...aliases] = names;
  const aliasText = aliases.length > 0 ? ` (or ${aliases.join(", ")})` : "";
  throw new Error(`Missing required environment variable: ${primaryName}${aliasText}`);
}
