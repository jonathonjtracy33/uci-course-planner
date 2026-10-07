"use client";

import { useEffect, useState } from "react";
import { decodeCourse, type IndexCourse, type IndexRow } from "@/lib/course-index";
import type { GeCandidate } from "@/lib/ge-recommend";

export type CourseIndex = Map<string, IndexCourse>;
export type GeCourses = Map<string, GeCandidate>;

// Downloads a JSON file at most once per page load, shared by every component that asks for it.
function lazyJson<J, T>(url: string, transform: (json: J) => T) {
  let request: Promise<T> | null = null;
  const load = () =>
    (request ??= fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`${url}: ${res.status}`);
        return res.json() as Promise<J>;
      })
      .then(transform)
      .catch((err) => {
        request = null; // let the next attempt retry
        throw err;
      }));

  // Starts loading once `enabled` turns true (e.g. when a search box is focused).
  return function useLazyJson(enabled: boolean): T | null {
    const [data, setData] = useState<T | null>(null);
    useEffect(() => {
      if (!enabled || data) return;
      let cancelled = false;
      load().then((d) => !cancelled && setData(d), () => {});
      return () => {
        cancelled = true;
      };
    }, [enabled, data]);
    return data;
  };
}

// Every UCI course (~9,300), for searching courses taken.
export const useCourseIndex = lazyJson("/api/courses", (rows: IndexRow[]): CourseIndex => new Map(rows.map((row) => [row[0], decodeCourse(row)])));

// GE courses with prerequisites and restrictions (~800), for the GE picker.
// Fields default so a copy cached before a deploy (missing newer fields) still works.
export const useGeCourses = lazyJson("/api/ge-courses", (list: Partial<GeCandidate>[]): GeCourses =>
  new Map(list.map((c) => [c.id!, {
    ...c,
    ge: c.ge ?? [],
    seasons: c.seasons ?? "*",
    prerequisiteTree: c.prerequisiteTree ?? null,
    prerequisiteText: c.prerequisiteText ?? null,
    restriction: c.restriction ?? null,
    overlaps: c.overlaps ?? [],
  } as GeCandidate])));
