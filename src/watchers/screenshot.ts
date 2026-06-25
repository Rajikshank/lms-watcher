import { chromium } from "playwright";
import type { LmsItem } from "../types.js";
import { login } from "./moodle.js";

export async function captureLmsItemScreenshot(item: LmsItem): Promise<Buffer | null> {
  if (!item.url) return null;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

  try {
    await login(page);
    await page.goto(item.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    await page.waitForTimeout(1000);
    return await page.screenshot({ type: "png", fullPage: false });
  } finally {
    await browser.close();
  }
}
