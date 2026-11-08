import { z } from "zod";
import { filtersSchema } from "./search-input";

export const directoryStorageKey = "atlas:directory:v1";
export const directorySnapshotSchema = z.object({
  version: z.literal(1),
  filters: filtersSchema,
  offset: z.number().int().min(0).max(10000000),
  asOf: z.iso.datetime(),
  location: z.string().max(200),
  locationLabel: z.string().max(500),
  mobileView: z.enum(["list", "map"]),
  more: z.boolean(),
  scrollTop: z.number().min(0).max(10000000),
  windowY: z.number().min(0).max(10000000),
});
export type DirectorySnapshot = z.infer<typeof directorySnapshotSchema>;
export type RestoredPage = { offset: number; asOf: string; token: number };
export function readDirectorySnapshot(value: unknown, now = Date.now()) {
  const parsed = directorySnapshotSchema.safeParse(value);
  if (!parsed.success) return null;
  const age = now - Date.parse(parsed.data.asOf);
  // Relative meeting windows should not resume an old day's search.
  return age >= -60000 && age <= 12 * 3600000 ? parsed.data : null;
}
export function directorySearchKey(
  s: Pick<DirectorySnapshot, "filters" | "offset" | "asOf">,
) {
  // Object property order is irrelevant when restoring validated storage.
  return JSON.stringify([filtersSchema.parse(s.filters), s.offset, s.asOf]);
}
export function resourceLink(id: string) {
  return "/?resource=" + encodeURIComponent(id);
}
export function resourceIdFromUrl(url: string) {
  const id = new URL(url).searchParams.get("resource");
  return id && /^[a-z0-9-]{1,150}$/.test(id) ? id : null;
}
