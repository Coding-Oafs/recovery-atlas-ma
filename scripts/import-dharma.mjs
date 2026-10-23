import { readFile, writeFile } from "node:fs/promises";
const data = JSON.parse(
  await readFile(".local/sources/dharma-feed.json", "utf8"),
);
const template = JSON.parse(
  await readFile(".local/imports/statewide-resources.json", "utf8"),
).find((r) => r.sourceName === "NERNA public BMLT meeting service");
const rows = [];
for (const m of data) {
  if (
    !(m.regions ?? []).includes("Massachusetts") &&
    m.region !== "Massachusetts"
  )
    continue;
  if ((m.types ?? []).includes("TC")) continue;
  const online = m.attendance_option === "online",
    hybrid = m.attendance_option === "hybrid";
  const lat = online ? null : Number(m.latitude) || null,
    lng = online ? null : Number(m.longitude) || null;
  if (lat !== null && (lat < 41 || lat > 43 || lng < -74 || lng > -69))
    throw Error("Dharma location outside Massachusetts");
  const address = online
    ? ""
    : (m.formatted_address ?? "").replace(/, USA$/, "");
  const city = address.match(/, ([^,]+), MA /)?.[1] ?? "Massachusetts";
  const start = Number(m.time?.slice(0, 2)) * 60 + Number(m.time?.slice(3, 5)),
    end =
      Number(m.end_time?.slice(0, 2)) * 60 + Number(m.end_time?.slice(3, 5));
  rows.push({
    ...template,
    id: "dharma-" + m.id,
    name: m.name,
    city,
    address,
    zip: address.match(/\bMA (\d{5})/)?.[1] ?? "",
    lat,
    lng,
    coordinateAccuracy:
      lat === null
        ? "unavailable"
        : m.approximate === "yes"
          ? "approximate"
          : "address",
    website: m.url,
    sourceUrl: m.url,
    sourceName: "Recovery Dharma official public meeting feed",
    sourceUpdatedAt: m.updated?.slice(0, 10) ?? null,
    fellowship: "Recovery Dharma",
    formats: hybrid
      ? ["in-person", "online", "hybrid"]
      : online
        ? ["online"]
        : ["in-person"],
    description:
      "Recovery Dharma peer-support meeting published by the official global meeting directory. Confirm current attendance details with the meeting page.",
    services: ["Peer support", "Meditation-based recovery"],
    languages: (m.types ?? []).includes("EN") ? ["English"] : [],
    accessibility: (m.types ?? []).includes("WA") ? ["Wheelchair access"] : [],
    populations: [],
    meeting: {
      days: [Number(m.day)],
      time: m.time,
      duration: (end - start + 1440) % 1440 || 60,
      timezone: "America/New_York",
      joinUrl: null,
      notes:
        "See the official meeting page for location access and joining instructions.",
    },
  });
}
await writeFile(".local/imports/dharma-resources.json", JSON.stringify(rows));
console.log("Recovery Dharma Massachusetts meetings", rows.length);
