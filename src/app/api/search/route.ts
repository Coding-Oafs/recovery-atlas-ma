import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sameOrigin, rateLimit } from "@/lib/security";
import { queryDirectory } from "@/lib/directory-query";
import { gzipSync } from "node:zlib";
const input = z.object({
  filters: z.object({
    query: z.string().max(200),
    category: z.enum([
      "all",
      "meetings",
      "treatment",
      "mental-health",
      "counseling",
      "support",
    ]),
    format: z.enum(["", "online", "in-person", "hybrid", "telehealth"]),
    fellowship: z.string().max(80),
    payment: z.string().max(100),
    service: z.string().max(100),
    language: z.string().max(80),
    accessibility: z.boolean(),
    population: z.string().max(100),
    day: z.union([z.literal(""), z.string().regex(/^[0-6]$/)]),
    soon: z.boolean(),
    radius: z.number().min(1).max(500),
    center: z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .nullable(),
    bounds: z
      .array(z.number())
      .length(4)
      .refine(
        (v) =>
          v[0] >= -180 &&
          v[2] <= 180 &&
          v[1] >= -90 &&
          v[3] <= 90 &&
          v[0] < v[2] &&
          v[1] < v[3],
      )
      .nullable(),
    savedOnly: z.boolean(),
  }),
  saved: z.array(z.string().max(150)).max(1000),
  limit: z.number().int().min(1).max(500),
});
export async function POST(request: NextRequest) {
  if (!(await sameOrigin()))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const parsed = input.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid search filters" },
        { status: 400 },
      );
    if (!(await rateLimit("search", 180, 10)))
      return NextResponse.json(
        { error: "Please pause before searching again." },
        { status: 429 },
      );
    const { filters, saved, limit } = parsed.data;
    const body = gzipSync(
      JSON.stringify(await queryDirectory(filters, saved, limit)),
    );
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": "application/json",
        "Content-Encoding": "gzip",
        "Cache-Control": "no-store",
        Vary: "Accept-Encoding",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Search is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
}
