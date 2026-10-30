import { z } from "zod";
import { regionStates } from "./region";
export const boundsSchema = z
  .array(z.number().finite())
  .length(4)
  .refine(
    (v) =>
      v[0] >= -180 &&
      v[2] <= 180 &&
      v[1] >= -85 &&
      v[3] <= 85 &&
      v[0] < v[2] &&
      v[1] < v[3],
  );
export const filtersSchema = z.object({
  state: z.enum(["", ...regionStates]).default(""),
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
  meetingWindow: z
    .enum(["", "today", "tomorrow", "24h", "weekend", "7days", "date"])
    .default(""),
  meetingDate: z.union([z.literal(""), z.iso.date()]).default(""),
  startAfter: z
    .string()
    .regex(/^$|^(?:[01]\d|2[0-3]):[0-5]\d$/)
    .default(""),
  startBefore: z
    .string()
    .regex(/^$|^(?:[01]\d|2[0-3]):[0-5]\d$/)
    .default(""),
  timeZone: z
    .string()
    .max(100)
    .refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    })
    .default("America/New_York"),
  radius: z.number().min(1).max(500),
  center: z
    .object({
      lat: z.number().min(-85).max(85),
      lng: z.number().min(-180).max(180),
    })
    .nullable(),
  bounds: boundsSchema.nullable(),
  savedOnly: z.boolean(),
});
export const savedSchema = z
  .array(z.string().regex(/^[a-z0-9-]{1,150}$/))
  .max(1000);
export const searchInput = z.object({
  offset: z.number().int().min(0).max(10000000).default(0),
  filters: filtersSchema,
  saved: savedSchema,
  limit: z.number().int().min(1).max(500),
});
export const mapInput = z.object({
  filters: filtersSchema,
  saved: savedSchema,
  bounds: boundsSchema,
  zoom: z.number().min(3).max(20),
});
export const selectionInput = z.object({
  filters: filtersSchema,
  saved: savedSchema,
  bounds: boundsSchema,
  offset: z.number().int().min(0).max(1000000).default(0),
});
