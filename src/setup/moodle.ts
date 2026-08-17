export type MoodleCourseChoice = {
  id: string;
  name: string;
};

export function choicesToCourseIds(courses: MoodleCourseChoice[]): string {
  return courses.map((course) => course.id.trim()).filter(Boolean).join(",");
}

export function choicesToCourseNames(courses: MoodleCourseChoice[]): string {
  return courses.map((course) => course.name.trim()).filter(Boolean).join(",");
}

