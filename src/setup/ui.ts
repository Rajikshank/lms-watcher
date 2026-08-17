import boxen from "boxen";
import ora, { type Ora } from "ora";
import pc from "picocolors";

export function section(title: string, body: string): string {
  return boxen(body, {
    title,
    titleAlignment: "center",
    padding: 1,
    borderStyle: "round",
    borderColor: "cyan"
  });
}

export function info(message: string): void {
  console.log(pc.cyan(message));
}

export function success(message: string): void {
  console.log(pc.green(`[OK] ${message}`));
}

export function warning(message: string): void {
  console.log(pc.yellow(`[CHECK] ${message}`));
}

export function fail(message: string): void {
  console.log(pc.red(`[ERROR] ${message}`));
}

export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 6) return "*".repeat(value.length);
  return `${value.slice(0, 3)}${"*".repeat(Math.min(value.length - 6, 18))}${value.slice(-3)}`;
}

export async function withSpinner<T>(
  text: string,
  operation: () => Promise<T>,
  options: { dryRun?: boolean } = {}
): Promise<T> {
  let spinner: Ora | undefined;

  if (process.stdout.isTTY) {
    spinner = ora(`${options.dryRun ? "[dry-run] " : ""}${text}`).start();
  } else {
    info(`${options.dryRun ? "[dry-run] " : ""}${text}`);
  }

  try {
    const result = await operation();
    spinner?.succeed(text);
    return result;
  } catch (error) {
    spinner?.fail(text);
    throw error;
  }
}

