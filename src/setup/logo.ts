import figlet from "figlet";

export const BRAND_NAME = "LMS-Watcher";
export const BRAND_WORDMARK = "LMS\nWatcher";
export const BRAND_TAGLINE = "SLTC LMS alerts for assignments, quizzes, resources, and deadlines.";

export const BRAND_COLORS = {
  blue: "#17417E",
  cyan: "#00AEEF"
} as const;

export function renderLogoText(): string {
  return figlet
    .textSync(BRAND_WORDMARK, {
      font: "ANSI Shadow",
      horizontalLayout: "fitted",
      verticalLayout: "default",
      width: 80
    })
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trimEnd();
}
