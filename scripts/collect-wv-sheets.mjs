import { readFile, writeFile } from "node:fs/promises";
import { load } from "cheerio";
export async function collectWestVirginia(directory) {
  const registry = [];
  const districts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17];
  let next = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (next < districts.length) {
        const n = districts[next++],
          page = "https://www.aawv.org/district-" + n;
        const source = {
          id: "aa-wv-district-" + n,
          state: "WV",
          page,
          fellowship: "AA",
          adapter: "publisher-csv",
        };
        try {
          const p = await fetch(page, { signal: AbortSignal.timeout(12000) });
          if (p.status !== 200) throw Error("Publisher HTTP " + p.status);
          const $ = load(await p.text());
          const link = $("a[href]")
            .toArray()
            .map((e) => $(e).attr("href"))
            .find((u) =>
              u?.startsWith("https://docs.google.com/spreadsheets/"),
            );
          if (!link) throw Error("No publisher-advertised public spreadsheet");
          const id = link.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
          if (!id) throw Error("Changed spreadsheet link");
          const gid = link.match(/gid=(\d+)/)?.[1];
          source.feed =
            "https://docs.google.com/spreadsheets/d/" +
            id +
            "/export?format=csv" +
            (gid ? "&gid=" + gid : "");
          source.advertised = link;
          const response = await fetch(source.feed, {
            signal: AbortSignal.timeout(15000),
          });
          if (response.status !== 200)
            throw Error("Spreadsheet HTTP " + response.status);
          const csv = await response.text();
          if (!csv.startsWith("Day,"))
            throw Error("Changed spreadsheet structure");
          await writeFile(directory + "/" + source.id + ".csv", csv);
          registry.push({ ...source, status: "public-feed" });
        } catch (e) {
          registry.push({
            ...source,
            status: "needs-review",
            error: e.message,
          });
        }
        await writeFile(
          directory + "/wv-manifest.json",
          JSON.stringify(registry, null, 2),
        );
      }
    }),
  );
  return registry;
}
