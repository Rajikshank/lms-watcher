import { existsSync } from "node:fs";
import { runCommand } from "./command.js";

export type DoctorCheck = {
  name: string;
  ok: boolean;
  detail: string;
};

async function commandAvailable(command: string, args: string[]): Promise<boolean> {
  try {
    await runCommand(command, args);
    return true;
  } catch {
    if (process.platform === "win32" && !command.endsWith(".cmd")) {
      try {
        await runCommand(`${command}.cmd`, args);
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }
}

function pnpmAvailableFromCurrentProcess(): boolean {
  const userAgent = process.env.npm_config_user_agent ?? "";
  const execPath = process.env.npm_execpath ?? "";
  return userAgent.includes("pnpm/") || execPath.toLowerCase().includes("pnpm");
}

export async function runDoctor(): Promise<DoctorCheck[]> {
  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  const pnpmOk = pnpmAvailableFromCurrentProcess() || (await commandAvailable("pnpm", ["--version"]));
  const wranglerOk =
    existsSync("node_modules/.bin/wrangler") ||
    existsSync("node_modules/.bin/wrangler.cmd") ||
    (await commandAvailable("pnpm", ["exec", "wrangler", "--version"])) ||
    (await commandAvailable("wrangler", ["--version"]));

  return [
    {
      name: "Node.js",
      ok: nodeMajor >= 22,
      detail: `Current version: ${process.versions.node}. Use Node.js 22 or newer.`
    },
    {
      name: "pnpm",
      ok: pnpmOk,
      detail: "Install with: npm install -g pnpm"
    },
    {
      name: "GitHub CLI",
      ok: await commandAvailable("gh", ["--version"]),
      detail: "Install GitHub CLI, then run: gh auth login"
    },
    {
      name: "Cloudflare Wrangler",
      ok: wranglerOk,
      detail: "Wrangler is installed through project dependencies. Try: pnpm exec wrangler --version"
    },
    {
      name: ".env",
      ok: existsSync(".env"),
      detail: "Run pnpm setup to create .env from guided answers."
    },
    {
      name: "GitHub Actions workflow",
      ok: existsSync(".github/workflows/watch.yml"),
      detail: "Expected .github/workflows/watch.yml"
    }
  ];
}

