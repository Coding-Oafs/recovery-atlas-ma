import { clock } from "./meeting-index";
/** RFC 4180 CSV, including quoted newlines and doubled quotes. No contact columns are retained. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw Error("Unterminated CSV field");
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const headers =
    rows.shift()?.map((h) => h.replace(/^\uFEFF/, "").trim()) || [];
  return rows
    .filter((r) => r.some(Boolean))
    .map((r) =>
      Object.fromEntries(headers.map((h, i) => [h, r[i]?.trim() || ""])),
    );
}
export function parsePublisherMeetings(text: string, state: string) {
  const records = parseCsv(text);
  if (
    !records.length ||
    !["Day", "Time", "Name", "Address", "City"].every((k) => k in records[0])
  )
    throw Error("Changed publisher spreadsheet layout");
  return records.map((r) => {
    const types = r.Types || "",
      status = r.Status || "",
      coords = (r.Coordinates || "").split(",").map(Number);
    const street = r.Address || "",
      zip = r.Zip || r["Postal Code"] || "";
    const address = street.includes(",")
      ? street
      : street + ", " + r.City + ", " + (r.State || state) + " " + zip;
    return {
      name: r.Name,
      id: r.Id || r.ID,
      slug: r.Id || r.ID || [r.Name, r.Day, r.Time, street].join("|"),
      day: [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ].indexOf(r.Day),
      time: clock(r.Time),
      city: r.City,
      state: r.State || state,
      formatted_address: address.replace(/,\s*Puerto Rico\b/i, ", PR"),
      coordinates: coords.length === 2 ? r.Coordinates : undefined,
      conference_url: r["Conference URL"],
      conference_phone: r["Conference Phone"],
      attendance_option: /hybrid/i.test(status)
        ? "hybrid"
        : /online|virtual/i.test(status)
          ? "online"
          : undefined,
      notes: r.Notes,
      types: [
        ...(/temporarily closed|^closed$/i.test(status) ? ["TC"] : []),
        ...(/Open/i.test(types) ? ["O"] : []),
        ...(/Closed/i.test(types) ? ["C"] : []),
        ...(/Wheelchair|Handicap/i.test(types) ? ["X"] : []),
        ...(/Spanish/i.test(types) ? ["S"] : []),
        ...(/English/i.test(types) ? ["EN"] : []),
        ...(/Women/i.test(types) ? ["W"] : []),
        ...(/\bMen\b/i.test(types) ? ["M"] : []),
      ],
    };
  });
}
