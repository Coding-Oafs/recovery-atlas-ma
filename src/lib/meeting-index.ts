import { load } from "cheerio";
const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
export function clock(value: string) {
  if (/noon/i.test(value)) return "12:00";
  if (/midnight/i.test(value)) return "00:00";
  const m = value.match(/(\d{1,2}):?(\d{2})?\s*([ap])\.?m/i);
  return m
    ? String(
        (Number(m[1]) % 12) + (m[3].toLowerCase() === "p" ? 12 : 0),
      ).padStart(2, "0") +
        ":" +
        (m[2] || "00")
    : "";
}
export function parseCrawlerIndex(html: string) {
  const $ = load(html);
  return $("table tr")
    .toArray()
    .flatMap((row) => {
      const cells = $(row).children("td");
      if (cells.length !== 10) return [];
      const c = cells.toArray().map((e) => clean($(e).text()));
      const types = c[7],
        online = /Online Meeting/.test(types),
        hybrid = /Hybrid|In.person and Online/i.test(types);
      return [
        {
          name: c[2],
          url: cells.eq(2).find("a").attr("href"),
          day: days.indexOf(c[0]),
          time: clock(c[1]),
          formatted_address: c[4],
          region: c[5],
          latitude: Number(c[8]),
          longitude: Number(c[9]),
          attendance_option: hybrid
            ? "hybrid"
            : online
              ? "online"
              : "in_person",
          types: [
            ...(/Open/.test(types) ? ["O"] : []),
            ...(/Closed/.test(types) ? ["C"] : []),
            ...(/Wheelchair/.test(types) ? ["X"] : []),
            ...(/Temporarily Closed/.test(types) ? ["TC"] : []),
          ],
        },
      ];
    });
}
export function parseMontana(html: string, city: string, url: string) {
  const $ = load(html);
  return $("table tr")
    .toArray()
    .flatMap((row) => {
      const c = $(row)
        .children("td")
        .toArray()
        .map((e) => clean($(e).text()));
      if (
        c.length !== 13 ||
        !days.includes(c[1]) ||
        /monthly|\b(?:1st|2nd|3rd|4th|first|second|third|fourth|last)\b/i.test(
          c[2],
        )
      )
        return [];
      return [
        {
          name: c[0].replace(/\([CO]\)$/, ""),
          url: undefined,
          slug: [city, c[0], c[1], c[3], c[4]].join("|"),
          day: days.indexOf(c[1]),
          time: clock(c[3]),
          formatted_address: c[4] + ", " + city + ", MT",
          types: [
            ...(c[5] ? ["C"] : []),
            ...(c[6] ? ["O"] : []),
            ...(c[7] ? ["X"] : []),
            ...(c[11] ? ["W"] : []),
            ...(c[12] ? ["M"] : []),
          ],
        },
      ];
    });
}
export function parseGeorgia(html: string) {
  const $ = load(html),
    rows: Record<string, unknown>[] = [];
  for (const row of $("table tr").toArray()) {
    const cells = $(row).children("td"),
      group = cells.first();
    if (cells.length !== 8) continue;
    const name = clean(group.find("h3").text()),
      url = new URL(
        group.find("h3 a").attr("href") || "/meetings/",
        "https://find.aageorgia.org",
      ).href;
    const address = clean(
      load(
        (group.find("p").first().html() || "").replace(/<br\s*\/?>/gi, ", "),
      ).text(),
    );
    for (let day = 0; day < 7; day++)
      for (const meeting of cells
        .eq(day + 1)
        .find(".meeting")
        .toArray()) {
        const elem = $(meeting),
          first = clean(elem.find("p").first().text());
        if (/\((?:1st|2nd|3rd|4th|5th|last)\)|monthly/i.test(first)) continue;
        const codes = elem
          .find(".codes span")
          .toArray()
          .map((e) => clean($(e).text()));
        rows.push({
          name,
          slug: url + "|" + day + "|" + clock(first),
          day,
          time: clock(first),
          formatted_address: address.replace(/^VIRTUAL MEETING,?\s*/i, ""),
          attendance_option: /VIRTUAL MEETING/i.test(address)
            ? "online"
            : "in_person",
          types: codes,
        });
      }
  }
  return rows;
}

export function parseSiouxFalls(html: string) {
  const $ = load(html),
    locations = new Map<
      string,
      { address: string; lat: number; lng: number }
    >();
  const begin = html.indexOf("e=[[") + 2;
  if (begin < 2) return [];
  let depth = 0,
    quote = false,
    escape = false,
    end = begin;
  for (; end < html.length; end++) {
    const c = html[end];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\" && quote) {
      escape = true;
      continue;
    }
    if (c === '"') {
      quote = !quote;
      continue;
    }
    if (!quote) {
      if (c === "[") depth++;
      if (c === "]" && --depth === 0) {
        end++;
        break;
      }
    }
  }
  let markers: unknown;
  try {
    markers = JSON.parse(html.slice(begin, end));
  } catch {
    return [];
  }
  if (!Array.isArray(markers)) return [];
  for (const marker of markers) {
    const h = String(marker[1]).replace(/\\u([a-f0-9]{4})/gi, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16)),
      ),
      m = load(h),
      key = m("a.maplink").attr("href");
    const address = clean(load(h.split(/<br\s*\/?>/i)[1] || "").text());
    if (key)
      locations.set(key, {
        address,
        lat: Number(marker[2]),
        lng: Number(marker[3]),
      });
  }
  const rows: Record<string, unknown>[] = [];
  for (const [day, name] of days.entries())
    for (const item of $("#" + name.toLowerCase())
      .next("ul")
      .children("li")
      .toArray()) {
      const li = $(item),
        a = li.find('a[href^="/meetings/"]').first(),
        key = a.attr("href"),
        title = clean(a.text());
      if (!key || /Al.?Anon|Narcotics|\bNA\b|Gamblers|Overeaters/i.test(title))
        continue;
      const location = locations.get(key);
      if (!location) continue;
      rows.push({
        name: title,
        slug: key + "|" + day + "|" + li.find("noscript").text(),
        day,
        time: li.find("noscript").text().trim(),
        formatted_address: location.address,
        latitude: location.lat,
        longitude: location.lng,
        types: li.find('img[alt="Wheelchair Accessible"]').length ? ["X"] : [],
      });
    }
  return rows;
}
