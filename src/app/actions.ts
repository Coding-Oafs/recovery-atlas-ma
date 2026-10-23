"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, sameOrigin } from "@/lib/security";
const submission = z.object({
  resourceId: z.string().max(150),
  kind: z.enum(["correction", "new"]),
  message: z.string().trim().min(15).max(2500),
  sourceUrl: z.union([
    z.literal(""),
    z
      .string()
      .url()
      .refine((v) => new URL(v).protocol === "https:"),
  ]),
  website: z.literal(""),
});
export async function submitCorrection(input: unknown) {
  if (!(await sameOrigin()))
    return { error: "Please submit from this website." };
  const parsed = submission.safeParse(input);
  if (!parsed.success)
    return {
      error:
        "Add at least 15 characters and a valid https source link, if provided.",
    };
  try {
    if (!(await rateLimit("submission", 6)))
      return { error: "Too many submissions. Please try again later." };
    const x = parsed.data;
    await db()`INSERT INTO submissions(resource_id,kind,message,source_url) VALUES(${x.resourceId || null},${x.kind},${x.message},${x.sourceUrl})`;
    return { success: true };
  } catch {
    return {
      error:
        "The review inbox is temporarily unavailable. Please try again later.",
    };
  }
}
