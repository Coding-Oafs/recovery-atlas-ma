import { mkdir, writeFile } from "node:fs/promises";
import { load } from "cheerio";
await mkdir(".local/northeast/meetings", { recursive: true });
const pages = [
  ["aa-nh", "AA", "https://nhaa.net/meetings/"],
  ["aa-ny", "AA", "https://www.nyintergroup.org/meetings/"],
  ["aa-ct", "AA", "https://ct-aa.org/meetings?tsml-day=any"],
  ["aa-vt-all", "AA", "https://aavt.org/meetings/?tsml-day=any"],
  ["aa-maine-all", "AA", "https://csoaamaine.org/meetings/?tsml-day=any"],
  [
    "aa-downeast-all",
    "AA",
    "https://downeastintergroup.org/?post_type=tsml_meeting&tsml-day=any",
  ],
  [
    "aa-ri-all",
    "AA",
    "https://rhodeisland-aa.org/archives/meetings/?tsml-day=any",
  ],
  ["aa-pa", "AA", "https://area59aa.org/meetings/"],
  ["aa-lehigh", "AA", "https://www.aalv.org/meetings/"],
  ["aa-south-nj", "AA", "https://aasj.org/meetings/"],
  ["aa-buffalo", "AA", "https://buffaloaany.org/meetings/"],
  ["aa-syracuse", "AA", "https://www.aasyracuse.org/meetings/"],
  ["aa-nj", "AA", "https://www.nnjaa.org/meetings/"],
  ["aa-cape-nj", "AA", "https://capeatlanticaa.org/meetings/"],
  ["aa-rochester", "AA", "https://meetings.rochesteraa.org/"],
  [
    "aa-albany",
    "AA",
    "https://ulsterdistricts.nenyaa.org/meetings/?tsml-day=any",
  ],
  ["aa-pittsburgh", "AA", "https://www.pghaa.org/meetings"],
  ["dharma", "Recovery Dharma", "https://recoverydharma.org/meetings/"],
  ["refuge", "Refuge Recovery", "https://refugerecoverymeetings.org/meetings/"],
];
const manifest = [];
let cursor = 0;
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (cursor < pages.length) {
      const [id, fellowship, url] = pages[cursor++];
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(35000) });
        if (!res.ok) throw Error("Page status " + res.status);
        const html = await res.text();
        await writeFile(`.local/northeast/meetings/${id}.html`, html);
        const $ = load(html),
          src = $("#tsml-ui").attr("data-src");
        const item = {
          id,
          fellowship,
          url,
          status: "public-page",
          rows: $("tr").length,
          feed: null,
        };
        if (src) {
          const feed = new URL(src, res.url);
          const r = await fetch(feed, { signal: AbortSignal.timeout(35000) });
          if (!r.ok) throw Error("Feed status " + r.status);
          const data = await r.json();
          await writeFile(
            `.local/northeast/meetings/${id}.json`,
            JSON.stringify(data),
          );
          item.feed = feed.href;
          item.status = "public-feed";
          console.log(
            id,
            "public feed",
            Array.isArray(data) ? data.length : Object.keys(data),
          );
        } else {
          console.log(id, "HTML rows", item.rows);
          console.log(
            "Relevant links",
            $("a[href]")
              .toArray()
              .map((e) => ({
                name: $(e).text().trim().slice(0, 60),
                href: $(e).attr("href"),
              }))
              .filter((a) =>
                /locations|meeting|csoaamaine/i.test(a.name + " " + a.href),
              )
              .slice(0, 8),
          );
        }
        manifest.push(item);
      } catch (e) {
        manifest.push({ id, fellowship, url, error: e.message });
        console.log(id, e.message);
      }
    }
  }),
);
await writeFile(
  ".local/northeast/meetings/manifest.json",
  JSON.stringify(manifest, null, 2),
);
const r = await fetch(
  "https://nerna.org/main_server/client_interface/json/?switcher=GetSearchResults&get_used_formats=1&lang_enum=en",
  { signal: AbortSignal.timeout(30000) },
);
if (r.ok) await writeFile(".local/northeast/nerna.json", await r.text());
