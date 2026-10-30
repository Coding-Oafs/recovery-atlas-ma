import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { sameOrigin, rateLimit } from "@/lib/security";
import { db } from "@/lib/db";
import { savedSchema, filtersSchema } from "@/lib/search-input";
import { resourceSchema } from "@/lib/types";
import {
  savedCSV,
  savedCalendar,
  savedPrint,
  printScript,
  isSameOriginPrintNavigation,
} from "@/lib/saved-export";
export async function POST(request: NextRequest) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "X-Content-Type-Options": "nosniff",
  };
  if (!(await sameOrigin()) && !isSameOriginPrintNavigation(request))
    return NextResponse.json(
      { error: "Invalid origin" },
      { status: 403, headers },
    );
  try {
    if (!(await rateLimit("saved-export", 30, 60)))
      return NextResponse.json(
        { error: "Please wait before downloading more copies." },
        { status: 429, headers },
      );
    const form = request.headers
      .get("content-type")
      ?.includes("application/x-www-form-urlencoded");
    const body = form
      ? Object.fromEntries(await request.formData())
      : await request.json();
    const ids = savedSchema.safeParse(
        form ? JSON.parse(String(body.ids)) : body.ids,
      ),
      format = request.nextUrl.searchParams.get("format") ?? body.format;
    if (
      !ids.success ||
      !ids.data.length ||
      !["csv", "json", "ics", "print"].includes(format)
    )
      return NextResponse.json(
        { error: "Choose saved resources and a download format." },
        { status: 400, headers },
      );
    const rows =
      await db()`SELECT data FROM resources WHERE id=ANY(${[...new Set(ids.data)]}::text[]) AND published ORDER BY resource_name,id`;
    const resources = rows.map((r) => resourceSchema.parse(r.data));
    if (!resources.length)
      return NextResponse.json(
        { error: "No published resources are available in this saved list." },
        { status: 404, headers },
      );
    if (format === "ics" && !resources.some((r) => r.meeting))
      return NextResponse.json(
        { error: "Save a meeting to create a calendar file." },
        { status: 400, headers },
      );
    const content =
      format === "csv"
        ? savedCSV(resources)
        : format === "ics"
          ? savedCalendar(
              resources,
              new Date(),
              z
                .object({
                  reminder: z.boolean().optional(),
                  nextOnly: z.boolean().optional(),
                  duration: z.number().int().min(1).max(720).optional(),
                  timeFilters: filtersSchema.partial().optional(),
                })
                .parse(body),
            )
          : format === "print"
            ? savedPrint(resources)
            : JSON.stringify(
                {
                  exportedAt: new Date().toISOString(),
                  notice:
                    "Your private saved list. Confirm current details with each source.",
                  requested: ids.data.length,
                  exported: resources.length,
                  unavailable: ids.data.length - resources.length,
                  resources,
                },
                null,
                2,
              );
    if (Buffer.byteLength(content) > 4_000_000)
      return NextResponse.json(
        { error: "This download is too large. Try the CSV format." },
        { status: 413, headers },
      );
    const type = {
      csv: "text/csv; charset=utf-8",
      json: "application/json; charset=utf-8",
      ics: "text/calendar; charset=utf-8",
      print: "text/html; charset=utf-8",
    }[format as "csv" | "json" | "ics" | "print"]!;
    return new Response(content, {
      headers: {
        ...headers,
        "Content-Type": type,
        ...(format === "print"
          ? {
              "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-${createHash("sha256").update(printScript).digest("base64")}'; base-uri 'none'; frame-ancestors 'none'`,
            }
          : {
              "Content-Disposition": `attachment; filename="recovery-atlas-saved-${new Date().toISOString().slice(0, 10)}.${format}"`,
            }),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Your download could not be prepared. Please try again." },
      { status: 503, headers },
    );
  }
}
