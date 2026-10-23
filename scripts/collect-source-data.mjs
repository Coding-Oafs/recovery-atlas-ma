import { readFile, writeFile, mkdir } from "node:fs/promises";
import { load } from "cheerio";
// Capture public source facts for review. Does not publish or change database records.
await mkdir(".local/sources/smart", { recursive: true });
async function capture(url, file) {
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok)
    throw Error(`Public source ${url} returned ${response.status}`);
  const text = await response.text();
  await writeFile(file, text);
  return text;
}
await capture(
  "https://nerna.org/main_server/client_interface/json/?switcher=GetSearchResults&get_used_formats=1&lang_enum=en",
  ".local/sources/na-all.json",
);
await capture(
  "https://arcgisserver.digital.mass.gov/arcgisserver/rest/services/AGOL/Hospitals/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=json",
  ".local/sources/hospitals.json",
);
for (const [name, origin] of [
  ["dharma", "https://recoverydharma.org"],
  ["refuge", "https://refugerecoverymeetings.org"],
]) {
  const html = await capture(
    origin + "/meetings/",
    `.local/sources/${name}.html`,
  );
  const $ = load(html),
    src = $("#tsml-ui").attr("data-src");
  if (!src)
    throw Error(name + " public feed not found; review source structure");
  const url = new URL(src, origin);
  if (url.origin !== origin) throw Error("Review changed feed origin");
  await capture(url, `.local/sources/${name}-feed.json`);
}
const centralUrl = "https://aaworcester.org/meetinglist.aspx?grp=wai";
const initial = await capture(centralUrl, ".local/sources/central-aa.html");
let $ = load(initial);
const body = new URLSearchParams();
for (const e of $('input[type="hidden"][name]').toArray())
  body.set($(e).attr("name"), String($(e).val() ?? ""));
for (const e of $("select[name]").toArray())
  body.set($(e).attr("name"), String($(e).val() ?? ""));
body.set("ctl00$contentPlaceHolder2$ddlDow", "7");
body.set("__EVENTTARGET", "ctl00$contentPlaceHolder2$ddlDow");
body.set("__EVENTARGUMENT", "");
const response = await fetch(centralUrl, {
  method: "POST",
  body,
  signal: AbortSignal.timeout(45000),
});
if (!response.ok) throw Error("Central AA all-days search unavailable");
await writeFile(".local/sources/central-aa-all.html", await response.text());
const smartOrigin = "https://meetings.smartrecovery.org";
const urls = new Set();
let next = new URL(
    "/meetings/?coordinates=250&location=Boston%2C+MA&finder_form=true",
    smartOrigin,
  ),
  page = 1;
while (next) {
  if (next.origin !== smartOrigin)
    throw Error("Review changed pagination origin");
  const html = await capture(next, `.local/sources/smart/page-${page}.html`);
  $ = load(html);
  for (const e of $("a.meetinglistrow[href]").toArray())
    if ($(e).text().includes("Massachusetts"))
      urls.add(new URL($(e).attr("href").split("?")[0], smartOrigin).href);
  const href =
    $('a[rel="next"]').attr("href") ??
    $("a[href]")
      .toArray()
      .map((e) => $(e).attr("href"))
      .find((h) => h.includes("page=" + (page + 1) + "#"));
  next = href ? new URL(href, new URL("/meetings/", smartOrigin)) : null;
  if (++page > 30) throw Error("Review unexpected SMART pagination");
}
for (const url of urls) {
  const id = url.match(/meetings\/(\d+)/)?.[1];
  if (!id) throw Error("Review SMART ID");
  await capture(url, `.local/sources/smart/meeting-${id}.html`);
}
await writeFile(".local/sources/smart-ma-urls.json", JSON.stringify([...urls]));
console.log(
  "Public source captures complete. Review and normalize before staging. SMART Massachusetts records:",
  urls.size,
);
