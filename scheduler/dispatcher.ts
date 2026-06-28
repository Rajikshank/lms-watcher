export interface DispatcherEnv {
  GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_WORKFLOW: string;
  GITHUB_REF: string;
  GITHUB_DISPATCH_SOURCE: string;
}

export interface DispatchResult {
  status: number;
  requestId?: string;
}

const required = (value: string | undefined, name: string): string => {
  const trimmed = value?.trim();
  if (!trimmed) {
    const kind = name === "GITHUB_TOKEN" ? "Worker secret" : "Worker variable";
    throw new Error(`Missing required ${kind}: ${name}`);
  }
  return trimmed;
};

export async function dispatchWatcherWorkflow(
  env: DispatcherEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<DispatchResult> {
  const token = required(env.GITHUB_TOKEN, "GITHUB_TOKEN");
  const owner = required(env.GITHUB_OWNER, "GITHUB_OWNER");
  const repo = required(env.GITHUB_REPO, "GITHUB_REPO");
  const workflow = required(env.GITHUB_WORKFLOW, "GITHUB_WORKFLOW");
  const ref = required(env.GITHUB_REF, "GITHUB_REF");
  const source = required(env.GITHUB_DISPATCH_SOURCE, "GITHUB_DISPATCH_SOURCE");
  const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`;

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "sltc-lms-watcher-scheduler",
      "X-GitHub-Api-Version": "2026-03-10",
    },
    body: JSON.stringify({ ref, inputs: { source } }),
  });

  const requestId = response.headers.get("x-github-request-id") ?? undefined;
  if (!response.ok) {
    const body = (await response.text()).slice(0, 500);
    const requestLabel = requestId ? `, request ${requestId}` : "";
    throw new Error(
      `GitHub workflow dispatch failed (${response.status})${requestLabel}: ${body || response.statusText}`,
    );
  }

  return { status: response.status, requestId };
}
