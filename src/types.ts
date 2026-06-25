export type LmsItemType =
  | "calendar"
  | "assignment"
  | "quiz"
  | "forum"
  | "resource"
  | "course_page"
  | "unknown";

export type LmsSource =
  | "calendar"
  | "dashboard"
  | "course_page"
  | "assignment_index"
  | "quiz_index"
  | "forum_index"
  | "resource_index";

export type LmsItem = {
  id: string;
  type: LmsItemType;
  source: LmsSource;
  courseId?: string;
  courseName?: string;
  title: string;
  url?: string;
  dueAt?: string;
  description?: string;
  fingerprint: string;
};

export type Snapshot = {
  scannedAt: string;
  items: LmsItem[];
};

export type Change =
  | { kind: "new"; item: LmsItem }
  | { kind: "changed"; before: LmsItem; after: LmsItem }
  | { kind: "removed"; item: LmsItem };
