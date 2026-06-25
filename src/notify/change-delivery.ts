import type { Change, LmsItem } from "../types.js";
import { formatChange, shouldAttachScreenshot } from "./telegram.js";

type DeliveryOptions = {
  screenshotsEnabled: boolean;
  maxScreenshotsPerRun: number;
  captureScreenshot: (item: LmsItem) => Promise<Buffer | null>;
  sendText: (message: string) => Promise<void>;
  sendPhoto: (photo: Buffer, caption: string) => Promise<void>;
  logScreenshotFailure?: (context: ScreenshotFailureContext) => void;
};

type DeliveryResult = {
  screenshotSent: boolean;
};

export type ScreenshotFailureContext = {
  stage: "capture" | "send_photo";
  error: unknown;
  changeKind: Change["kind"];
  itemType: LmsItem["type"];
  courseName?: string;
  title: string;
  url?: string;
};

function screenshotItem(change: Change): LmsItem | null {
  if (!shouldAttachScreenshot(change)) return null;
  if (change.kind === "new") return change.item;
  if (change.kind === "changed") return change.after;
  return null;
}

function logFailure(options: DeliveryOptions, context: ScreenshotFailureContext): void {
  if (options.logScreenshotFailure) {
    options.logScreenshotFailure(context);
  }
}

export async function deliverChangeNotification(
  change: Change,
  screenshotsSent: number,
  options: DeliveryOptions
): Promise<DeliveryResult> {
  const message = formatChange(change);
  const item = screenshotItem(change);

  if (!options.screenshotsEnabled || screenshotsSent >= options.maxScreenshotsPerRun || !item) {
    await options.sendText(message);
    return { screenshotSent: false };
  }

  let screenshot: Buffer | null;

  try {
    screenshot = await options.captureScreenshot(item);
  } catch (error) {
    logFailure(options, {
      stage: "capture",
      error,
      changeKind: change.kind,
      itemType: item.type,
      courseName: item.courseName,
      title: item.title,
      url: item.url
    });
    await options.sendText(message);
    return { screenshotSent: false };
  }

  if (!screenshot) {
    await options.sendText(message);
    return { screenshotSent: false };
  }

  try {
    await options.sendPhoto(screenshot, message);
    return { screenshotSent: true };
  } catch (error) {
    logFailure(options, {
      stage: "send_photo",
      error,
      changeKind: change.kind,
      itemType: item.type,
      courseName: item.courseName,
      title: item.title,
      url: item.url
    });
    await options.sendText(message);
    return { screenshotSent: false };
  }
}
