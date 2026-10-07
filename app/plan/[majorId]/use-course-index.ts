"use client";

import { useEffect, useState } from "react";
import { decodeCourse, type IndexCourse, type IndexRow } from "@/lib/course-index";

export type CourseIndex = Map<string, IndexCourse>;

// Shared across components and plan pages: download the ~9k-course index at most once.
let request: Promise<CourseIndex> | null = null;
const load = () =>
  (request ??= fetch("/api/courses")
    .then((res) => {
      if (!res.ok) throw new Error(`course index: ${res.status}`);
      return res.json() as Promise<IndexRow[]>;
    })
    .then((rows) => new Map(rows.map((row) => [row[0], decodeCourse(row)])))
    .catch((err) => {
      request = null; // let the next attempt retry
      throw err;
    }));

// Loads the full course index once `enabled` turns true (e.g. when a search box is focused).
export function useCourseIndex(enabled: boolean): CourseIndex | null {
  const [index, setIndex] = useState<CourseIndex | null>(null);
  useEffect(() => {
    if (!enabled || index) return;
    let cancelled = false;
    load().then((i) => !cancelled && setIndex(i), () => {});
    return () => {
      cancelled = true;
    };
  }, [enabled, index]);
  return index;
}
