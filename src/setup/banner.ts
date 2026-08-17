import boxen from "boxen";
import gradient from "gradient-string";
import pc from "picocolors";

export type BannerOptions = {
  columns?: number;
  color?: boolean;
};

const TITLE = "LMS-Watcher";
const TAGLINE = "SLTC LMS alerts for assignments, quizzes, resources, and deadlines.";

const BLOCK_LOGO = String.raw`
██      ███    ███  ██████        ██     ██  █████  ████████  ██████ ██   ██ ███████ ██████
██      ████  ████ ██             ██     ██ ██   ██    ██    ██      ██   ██ ██      ██   ██
██      ██ ████ ██  █████  █████  ██  █  ██ ███████    ██    ██      ███████ █████   ██████
██      ██  ██  ██      ██        ██ ███ ██ ██   ██    ██    ██      ██   ██ ██      ██   ██
███████ ██      ██ ██████          ███ ███  ██   ██    ██     ██████ ██   ██ ███████ ██   ██
`.trim();

const COMPACT_LOGO = String.raw`
██      ███    ███  ██████
██      ████  ████ ██
██      ██ ████ ██  █████
██      ██  ██  ██      ██
███████ ██      ██ ██████
`.trim();

function terminalSupportsColor(color?: boolean): boolean {
  if (color === false) return false;
  if (process.env.NO_COLOR) return false;
  return color === true || Boolean(process.stdout.isTTY);
}

export function renderBanner(options: BannerOptions = {}): string {
  const columns = options.columns ?? process.stdout.columns ?? 100;
  const supportsColor = terminalSupportsColor(options.color);
  const title = columns < 104 ? COMPACT_LOGO : BLOCK_LOGO;
  const label = columns < 104 ? TITLE : "";

  const coloredTitle = supportsColor
    ? gradient(["#67e8f9", "#818cf8", "#22d3ee"]).multiline(title)
    : title;

  const subtitle = supportsColor ? pc.cyan(TAGLINE) : TAGLINE;
  const content = [coloredTitle, label, subtitle].filter(Boolean).join("\n\n");

  return boxen(content, {
    padding: { top: 1, bottom: 1, left: 2, right: 2 },
    margin: { top: 1, bottom: 1 },
    borderStyle: "round",
    borderColor: supportsColor ? "cyan" : undefined
  });
}