import { readCalendarItems } from "./watchers/calendar.js";

const items = await readCalendarItems();

console.log(`Calendar feed reachable. Filtered calendar items: ${items.length}`);
