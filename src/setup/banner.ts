import boxen from "boxen";
import gradient from "gradient-string";
import pc from "picocolors";
import { BRAND_COLORS, BRAND_NAME, BRAND_TAGLINE, renderLogoText } from "./logo.js";

export type BannerOptions = {
  columns?: number;
  color?: boolean;
};

function terminalSupportsColor(color?: boolean): boolean {
  if (color === false) return false;
  if (process.env.NO_COLOR) return false;
  return color === true || Boolean(process.stdout.isTTY);
}

export function renderBanner(options: BannerOptions = {}): string {
  const columns = options.columns ?? process.stdout.columns ?? 100;
  const supportsColor = terminalSupportsColor(options.color);
  const logo = renderLogoText();

  const coloredLogo = supportsColor
    ? gradient([BRAND_COLORS.cyan, "#7BCBFF", BRAND_COLORS.blue]).multiline(logo)
    : logo;

  const title = supportsColor ? pc.bold(pc.blue(BRAND_NAME)) : BRAND_NAME;
  const subtitle = supportsColor ? pc.cyan(BRAND_TAGLINE) : BRAND_TAGLINE;
  const content = [coloredLogo, title, subtitle].join("\n\n");

  return boxen(content, {
    padding: { top: 1, bottom: 1, left: 2, right: 2 },
    margin: { top: 1, bottom: 1 },
    borderStyle: columns < 76 ? "single" : "round",
    borderColor: supportsColor ? "blue" : undefined
  });
}
