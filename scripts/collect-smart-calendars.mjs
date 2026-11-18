import { readFile, writeFile, mkdir } from "node:fs/promises";
import { load } from "cheerio";
export async function collectSmartCalendars(root) {
  const directory = root + "/.local/national-meetings/smart",
    output = root + "/.local/expansion-v2/smart-calendars";
  await mkdir(output, { recursive: true });
  const urls = JSON.parse(await readFile(directory + "/urls.json", "utf8")),
    results = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 2 }, async () => {
      while (cursor < urls.length) {
        const [url, state] = urls[cursor++],
          id = url.match(/meetings\/(\d+)/)?.[1];
        if (!id) continue;
        try {
          const html = await readFile(
              directory + "/meeting-" + id + ".html",
              "utf8",
            ),
            $ = load(html);
          const link = $("a[href]")
            .toArray()
            .map((e) => $(e).attr("href"))
            .find((u) => u?.includes("/calendar/apple/"));
          if (!link) throw Error("No published calendar");
          const target = new URL(link);
          if (
            target.protocol !== "https:" ||
            ![
              "www.pathminder.co",
              "pathminder.co",
              "meetings.smartrecovery.org",
            ].includes(target.hostname)
          )
            throw Error("Changed calendar host");
          let calendar;
          try {
            calendar = await readFile(output + "/" + id + ".ics", "utf8");
          } catch {
            const r = await fetch(target, {
              signal: AbortSignal.timeout(18000),
            });
            if (!r.ok) throw Error("Calendar HTTP " + r.status);
            calendar = await r.text();
            // Retain schedule-only VCALENDAR data: no descriptions, emails or conferencing credentials.
            const lines = calendar
              .replace(/\r?\n[ \t]/g, "")
              .split(/\r?\n/)
              .filter((l) =>
                /^(?:BEGIN:(?:VCALENDAR|VEVENT)|END:(?:VCALENDAR|VEVENT)|DTSTART[;:]|DTEND[;:]|RRULE:|EXDATE[;:]|STATUS:)/.test(
                  l,
                ),
              );
            calendar = lines.join("\r\n");
            await writeFile(output + "/" + id + ".ics", calendar);
          }
          results.push({ url, state, id, status: "captured" });
        } catch (e) {
          results.push({
            url,
            state,
            id,
            status: "needs-review",
            error: e.message,
          });
        }
        if (results.length % 25 === 0)
          await writeFile(
            output + "/manifest.json",
            JSON.stringify(results, null, 2),
          );
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }),
  );
  await writeFile(output + "/manifest.json", JSON.stringify(results, null, 2));
  return {
    captured: results.filter((r) => r.status === "captured").length,
    review: results.filter((r) => r.status !== "captured").length,
  };
}
