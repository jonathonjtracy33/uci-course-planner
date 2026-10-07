import { getExploreCourses } from "@/lib/data";

// Prerendered at build time, like /api/courses.
export async function GET() {
  return Response.json(await getExploreCourses());
}
