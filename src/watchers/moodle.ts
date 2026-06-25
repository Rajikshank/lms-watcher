import { chromium, type Page } from "playwright";
import { env } from "../env.js";
import { hashText, makeFingerprint } from "../diff.js";
import { isWatchedCourse, isWatchedItem } from "../filter.js";
import type { LmsItem, LmsItemType, LmsSource } from "../types.js";

type Course = { id: string; name: string; url: string };

export function typeFromUrl(url: string): LmsItemType {
  if (url.includes("/mod/assign/")) return "assignment";
  if (url.includes("/mod/quiz/")) return "quiz";
  if (url.includes("/mod/forum/")) return "forum";
  if (url.includes("/mod/resource/") || url.includes("/mod/folder/") || url.includes("/mod/url/")) return "resource";
  return "unknown";
}

export function shouldKeepMoodleAnchor(url: string, title: string): boolean {
  if (!title.trim() || !url.trim()) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.hash.includes("tab-panel")) return false;

  const type = typeFromUrl(url);
  if (type === "unknown") return false;

  return parsed.pathname.includes("/mod/") && !parsed.pathname.endsWith("/index.php");
}

async function login(page: Page): Promise<void> {
  await page.goto(env.lmsLoginUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });

  const username = page.locator('input[name="username"], input#username').first();
  const password = page.locator('input[name="password"], input#password').first();

  await username.waitFor({ state: "visible", timeout: 30_000 });
  await password.waitFor({ state: "visible", timeout: 30_000 });

  await username.fill(env.lmsUsername);
  await password.fill(env.lmsPassword);

  await page.locator('button[type="submit"], input[type="submit"]').first().click();
  await page.waitForLoadState("domcontentloaded", { timeout: 60_000 }).catch(() => undefined);
  await page.waitForTimeout(1500);

  if (page.url().includes("/login/")) {
    const loginError = await page.locator(".loginerrors, .alert-danger, .error").first().textContent().catch(() => "");
    throw new Error(`Moodle login failed. ${loginError?.trim() || "Check credentials, CAPTCHA, or SSO."}`);
  }
}

async function extractCourses(page: Page): Promise<Course[]> {
  for (const url of [`${env.lmsRootUrl}/my/courses.php`, `${env.lmsRootUrl}/my/`]) {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });

    const courses = await page.locator('a[href*="/course/view.php?id="]').evaluateAll((links) => {
      const seen = new Set<string>();
      return links.map((link) => {
        const anchor = link as HTMLAnchorElement;
        const href = anchor.href;
        const name = anchor.innerText.trim().replace(/\s+/g, " ");
        const match = href.match(/[?&]id=(\d+)/);
        if (!href || !name || !match) return null;
        const key = `${match[1]}:${href}`;
        if (seen.has(key)) return null;
        seen.add(key);
        return { id: match[1], name, url: href };
      }).filter(Boolean);
    });

    if (courses.length > 0) return courses as Course[];
  }

  return [];
}

async function extractItemsFromPage(page: Page, source: LmsSource, course?: Course): Promise<LmsItem[]> {
  const anchors = await page.locator("a[href]").evaluateAll((links) => links.map((link) => {
    const anchor = link as HTMLAnchorElement;
    return { title: anchor.innerText.trim().replace(/\s+/g, " "), url: anchor.href };
  }));

  const items: LmsItem[] = [];

  for (const anchor of anchors) {
    if (!anchor.title || !anchor.url) continue;

    if (!shouldKeepMoodleAnchor(anchor.url, anchor.title)) continue;

    const type = typeFromUrl(anchor.url);
    const idRaw = [source, course?.id, type, anchor.url, anchor.title].join("|");

    const item: LmsItem = {
      id: `${source}:${hashText(idRaw).slice(0, 24)}`,
      type,
      source,
      courseId: course?.id,
      courseName: course?.name,
      title: anchor.title,
      url: anchor.url,
      fingerprint: makeFingerprint([source, course?.id, course?.name, type, anchor.title, anchor.url])
    };

    if (isWatchedItem(item)) {
      items.push(item);
    }
  }

  return items;
}

async function crawlCourseIndexes(page: Page, course: Course): Promise<LmsItem[]> {
  const indexPages: Array<{ source: LmsSource; url: string }> = [
    { source: "assignment_index", url: `${env.lmsRootUrl}/mod/assign/index.php?id=${course.id}` },
    { source: "quiz_index", url: `${env.lmsRootUrl}/mod/quiz/index.php?id=${course.id}` },
    { source: "forum_index", url: `${env.lmsRootUrl}/mod/forum/index.php?id=${course.id}` },
    { source: "resource_index", url: `${env.lmsRootUrl}/mod/resource/index.php?id=${course.id}` }
  ];

  const items: LmsItem[] = [];

  for (const indexPage of indexPages) {
    try {
      await page.goto(indexPage.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      items.push(...await extractItemsFromPage(page, indexPage.source, course));
    } catch {
      // Some Moodle installations disable some index pages. Ignore for v0.
    }
  }

  return items;
}

export async function crawlMoodleItems(): Promise<LmsItem[]> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

  try {
    await login(page);

    await page.goto(`${env.lmsRootUrl}/my/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const dashboardItems = await extractItemsFromPage(page, "dashboard");
    const allCourses = await extractCourses(page);
    const watchedCourses = allCourses.filter((course) => isWatchedCourse(course));
    const courseItems: LmsItem[] = [];

    for (const course of watchedCourses) {
      await page.goto(course.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      courseItems.push(...await extractItemsFromPage(page, "course_page", course));
      courseItems.push(...await crawlCourseIndexes(page, course));
    }

    return [...dashboardItems, ...courseItems];
  } finally {
    await browser.close();
  }
}
