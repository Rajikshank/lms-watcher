import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type CommandRunnerOptions = {
  dryRun?: boolean;
  cwd?: string;
};

export type CommandResult = {
  stdout: string;
  stderr: string;
  dryRun: boolean;
};

function commandCandidates(command: string): string[] {
  if (process.platform === "win32" && !command.endsWith(".cmd")) {
    return [command, `${command}.cmd`];
  }

  return [command];
}

export async function runCommand(
  command: string,
  args: string[],
  options: CommandRunnerOptions = {}
): Promise<CommandResult> {
  if (options.dryRun) {
    return {
      stdout: `[dry-run] ${command} ${args.join(" ")}`,
      stderr: "",
      dryRun: true
    };
  }

  let lastError: unknown;

  for (const candidate of commandCandidates(command)) {
    try {
      const result = await execFileAsync(candidate, args, {
        cwd: options.cwd,
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 1024 * 1024
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        dryRun: false
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}