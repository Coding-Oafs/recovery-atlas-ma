import { z } from "zod";
import { regionStates } from "./region";
const webUrl = z
  .string()
  .url()
  .refine((v) => new URL(v).protocol === "https:", "Use an https website");
const date = z.iso.date();
export const resourceSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .max(150),
    name: z.string().min(2).max(220),
    kind: z.enum([
      "clinic",
      "treatment",
      "hospital",
      "meeting",
      "support",
      "provider",
    ]),
    categories: z
      .array(
        z.enum([
          "meetings",
          "treatment",
          "mental-health",
          "counseling",
          "support",
        ]),
      )
      .min(1),
    address: z.string().max(300),
    city: z.string().max(100),
    state: z.string().min(1).max(100),
    country: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional(),
    postalCode: z.string().max(24).optional(),
    zip: z.string().regex(/^\d{5}$|^$/),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
    coordinateAccuracy: z.enum(["address", "approximate", "unavailable"]),
    phone: z.string().max(70),
    website: webUrl,
    description: z.string().min(5).max(3000),
    services: z.array(z.string().max(100)).max(30),
    formats: z.array(z.enum(["in-person", "online", "hybrid", "telehealth"])),
    fellowship: z.string().max(80).nullable(),
    languages: z.array(z.string().max(80)),
    accessibility: z.array(z.string().max(100)),
    populations: z.array(z.string().max(100)),
    hours: z.string().max(500),
    intake: z.string().max(1000),
    payment: z.array(z.string().max(100)),
    paymentNote: z.string().max(1800),
    insurance: z.array(
      z.object({
        name: z.string().max(100),
        plan: z.string().max(150),
        status: z.enum(["reported", "published", "confirmed"]),
        note: z.string().max(1000),
        sourceUrl: webUrl,
        checkedAt: date,
      }),
    ),
    sourceUrl: webUrl,
    sourceName: z.string().max(160),
    sourceCheckedAt: date,
    verifiedAt: date.nullable(),
    sourceUpdatedAt: date.nullable(),
    meeting: z
      .object({
        days: z.array(z.number().int().min(0).max(6)).min(1),
        time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
        duration: z.number().min(1).max(720).nullable(),
        timezone: z
          .string()
          .max(100)
          .refine((v) => {
            try {
              new Intl.DateTimeFormat("en", { timeZone: v });
              return true;
            } catch {
              return false;
            }
          }, "Use a valid IANA time zone"),
        exceptions: z
          .array(
            z.object({
              date: date,
              cancelled: z.boolean(),
              note: z.string().max(300),
            }),
          )
          .max(100)
          .optional(),
        joinUrl: webUrl.nullable(),
        notes: z.string().max(1000),
      })
      .nullable(),
    availability: z.string().max(200),
    practical: z
      .object({
        walkIn: z.enum(["yes", "no", "unknown"]),
        referral: z.enum(["yes", "no", "unknown"]),
        minimumAge: z.number().int().min(0).max(120).nullable(),
        maximumAge: z.number().int().min(0).max(120).nullable(),
        transit: z.string().max(500),
        entrance: z.string().max(500),
        childcare: z.enum(["yes", "no", "unknown"]),
        newcomers: z.string().max(500),
        notes: z.string().max(1000),
      })
      .optional(),
    evidence: z
      .array(
        z.object({
          field: z.enum([
            "contact",
            "services",
            "schedule",
            "payment",
            "accessibility",
            "intake",
          ]),
          note: z.string().min(5).max(600),
          sourceUrl: webUrl,
          checkedAt: date,
          expiresAt: date.nullable(),
        }),
      )
      .max(20)
      .optional(),
  })
  .superRefine((r, c) => {
    if ((r.lat === null) !== (r.lng === null))
      c.addIssue({ code: "custom", message: "Coordinates must be a pair" });
    if (
      r.formats.includes("online") &&
      !r.formats.includes("hybrid") &&
      r.kind === "meeting" &&
      r.lat !== null
    )
      c.addIssue({
        code: "custom",
        message: "Online-only meetings must not have map pins",
      });
    if (r.kind === "meeting" && !r.meeting)
      c.addIssue({ code: "custom", message: "Meetings require a schedule" });
  });
export type Resource = z.infer<typeof resourceSchema>;
export type MapResource = Pick<Resource, "id" | "kind" | "lat" | "lng">;
export type MapPoint = {
  id: string;
  kind: Resource["kind"] | "cluster";
  lat: number;
  lng: number;
  count: number;
  bounds: number[];
};
export const categories = [
  { id: "all", label: "All resources" },
  { id: "meetings", label: "Meetings" },
  { id: "treatment", label: "Treatment & detox" },
  { id: "mental-health", label: "Mental health" },
  { id: "counseling", label: "Therapy & counseling" },
  { id: "support", label: "Recovery support" },
] as const;
export type Filters = {
  state?: string;
  query: string;
  category: string;
  format: string;
  fellowship: string;
  payment: string;
  service: string;
  language: string;
  accessibility: boolean;
  population: string;
  day: string;
  soon: boolean;
  meetingWindow?:
    "" | "today" | "tomorrow" | "24h" | "weekend" | "7days" | "date";
  meetingDate?: string;
  startAfter?: string;
  startBefore?: string;
  timeZone?: string;
  radius: number;
  center: { lat: number; lng: number } | null;
  bounds: number[] | null;
  savedOnly: boolean;
};
