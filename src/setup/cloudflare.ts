export function parseKvNamespaceId(output: string): string | null {
  const jsonId = output.match(/"id"\s*:\s*"([^"]+)"/);
  if (jsonId) return jsonId[1];

  const idLine = output.match(/\bid\s*=\s*"([^"]+)"/i);
  if (idLine) return idLine[1];

  const plain = output.match(/\b([a-f0-9]{32})\b/i);
  return plain?.[1] ?? null;
}

export function defaultWorkerName(repoName: string): string {
  return `${repoName.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}-scheduler`;
}

