import { getFilterSummary } from "./filter.js";
import { formatHealthReport } from "./scan-report.js";
import { readScanStatus } from "./storage/cloudflare-kv.js";

const status = await readScanStatus();

if (!status) {
  console.log("No LMS watcher scan status stored yet.");
  console.log(getFilterSummary());
} else {
  console.log(formatHealthReport(status));
  if (status.status === "failed" && status.error) {
    console.log("");
    console.log(`Last error: ${status.error}`);
  }
}
