import boxen from "boxen";
import figlet from "figlet";
import gradient from "gradient-string";
import pc from "picocolors";

export type BannerOptions = {
  columns?: number;
  color?: boolean;
};

const TITLE = "LMS-Watcher";
const TAGLINE = "Assignment, quiz, resource, and course update alerts.";

function terminalSupportsColor(color?: boolean): boolean {
  if (color === false) return false;
  if (process.env.NO_COLOR) return false;
  return color === true || Boolean(process.stdout.isTTY);
}

export function renderBanner(options: BannerOptions = {}): string {
  const columns = options.columns ?? process.stdout.columns ?? 80;
  const supportsColor = terminalSupportsColor(options.color);

  const title =
    columns < 64
      ? TITLE
      : figlet.textSync(TITLE, {
          font: "Rectangles",
          horizontalLayout: "fitted",
          verticalLayout: "default",
          width: Math.max(columns - 6, 40),
          whitespaceBreak: true
        });

  const coloredTitle = supportsColor
    ? gradient(["#38bdf8", "#818cf8", "#22d3ee"]).multiline(title)
    : title;

  const subtitle = supportsColor ? pc.cyan(TAGLINE) : TAGLINE;

  return boxen(`${coloredTitle}\n\n${subtitle}`, {
    padding: { top: 1, bottom: 1, left: 2, right: 2 },
    margin: { top: 1, bottom: 1 },
    borderStyle: "round",
    borderColor: supportsColor ? "cyan" : undefined
  });
}

