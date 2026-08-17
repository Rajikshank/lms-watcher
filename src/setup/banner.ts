import boxen from "boxen";
import gradient from "gradient-string";
import pc from "picocolors";

export type BannerOptions = {
  columns?: number;
  color?: boolean;
};

const TITLE = "LMS-Watcher";
const TAGLINE = "SLTC LMS alerts for assignments, quizzes, resources, and deadlines.";

const LOGO = String.raw`
##      ###   ###  ######
##      #### #### ##
##      ## ### ##  #####
##      ##  #  ##      ##
####### ##     ## ######
`.trim();

function terminalSupportsColor(color?: boolean): boolean {
  if (color === false) return false;
  if (process.env.NO_COLOR) return false;
  return color === true || Boolean(process.stdout.isTTY);
}

export function renderBanner(options: BannerOptions = {}): string {
  const columns = options.columns ?? process.stdout.columns ?? 90;
  const supportsColor = terminalSupportsColor(options.color);
  const borderColor = supportsColor ? "blue" : undefined;

  const coloredLogo = supportsColor
    ? gradient(["#00AEEF", "#17417E"]).multiline(LOGO)
    : LOGO;

  const title = supportsColor ? pc.bold(pc.blue(TITLE)) : TITLE;
  const subtitle = supportsColor ? pc.cyan(TAGLINE) : TAGLINE;
  const content = [coloredLogo, title, subtitle].join("\n\n");

  return boxen(content, {
    padding: { top: 1, bottom: 1, left: 2, right: 2 },
    margin: { top: 1, bottom: 1 },
    borderStyle: columns < 70 ? "single" : "round",
    borderColor
  });
}
