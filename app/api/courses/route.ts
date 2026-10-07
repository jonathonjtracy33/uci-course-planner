import { getCourseIndex } from "@/lib/data";

// Prerendered at build time (the data comes from a cached function), so it's served as a static file.
export async function GET() {
  return Response.json(await getCourseIndex());
}
