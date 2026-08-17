import fs from "node:fs";
import figlet from "figlet";

const logo = figlet
  .textSync("LMS\nWatcher", {
    font: "ANSI Shadow",
    horizontalLayout: "fitted",
    verticalLayout: "default",
    width: 80
  })
  .split("\n")
  .map((line) => line.trimEnd())
  .join("\n")
  .trimEnd();

const escapeXml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const lines = logo.split("\n");
const tspans = lines
  .map((line, index) => `    <tspan x="250" dy="${index === 0 ? 0 : 25}">${escapeXml(line || " ")}</tspan>`)
  .join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="560" viewBox="0 0 1200 560" role="img" aria-labelledby="title desc">
  <title id="title">LMS-Watcher</title>
  <desc id="desc">Terminal-style SLTC LMS watcher logo for Telegram assignment, quiz, resource, forum, and deadline alerts.</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#061224"/>
      <stop offset="0.58" stop-color="#102B5C"/>
      <stop offset="1" stop-color="#17417E"/>
    </linearGradient>
    <linearGradient id="wordmark" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#00AEEF"/>
      <stop offset="0.5" stop-color="#7BCBFF"/>
      <stop offset="1" stop-color="#17417E"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0 0 0 0 0 0.68 0 0 0 0 0.94 0 0 0 0.55 0"/>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <pattern id="scanlines" width="1" height="8" patternUnits="userSpaceOnUse">
      <rect width="1" height="3" fill="#FFFFFF" opacity="0.04"/>
    </pattern>
  </defs>

  <rect width="1200" height="560" rx="34" fill="url(#bg)"/>
  <rect width="1200" height="560" rx="34" fill="url(#scanlines)"/>
  <rect x="36" y="36" width="1128" height="488" rx="26" fill="#04111F" opacity="0.5"/>
  <rect x="64" y="64" width="1072" height="432" rx="20" fill="none" stroke="#00AEEF" stroke-width="2" opacity="0.46"/>

  <g fill="#00AEEF" opacity="0.56">
    <rect x="96" y="94" width="10" height="10"/><rect x="116" y="94" width="10" height="10"/>
    <rect x="1074" y="94" width="10" height="10"/><rect x="1094" y="94" width="10" height="10"/>
    <rect x="96" y="456" width="10" height="10"/><rect x="116" y="456" width="10" height="10"/>
    <rect x="1074" y="456" width="10" height="10"/><rect x="1094" y="456" width="10" height="10"/>
  </g>

  <text x="250" y="110" fill="url(#wordmark)" filter="url(#glow)"
        font-family="Consolas, 'Cascadia Mono', 'SFMono-Regular', 'Courier New', monospace"
        font-size="22" font-weight="900" letter-spacing="0" xml:space="preserve">
${tspans}
  </text>

  <text x="600" y="508" text-anchor="middle" fill="#FFFFFF"
        font-family="Inter, Segoe UI, Arial, sans-serif" font-size="28" font-weight="800">
    SLTC LMS Telegram alerts
  </text>
  <text x="600" y="538" text-anchor="middle" fill="#BDEFFF"
        font-family="Inter, Segoe UI, Arial, sans-serif" font-size="18" font-weight="600">
    Assignments, quizzes, resources, forums, and deadlines
  </text>
</svg>
`;

fs.writeFileSync("assets/lms-watcher-terminal-logo.svg", svg, "utf8");
