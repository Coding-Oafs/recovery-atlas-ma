import { mkdir, readFile, writeFile } from "node:fs/promises";
import zipcodes from "zipcodes";
const states = ["CT", "ME", "NH", "NJ", "NY", "PA", "RI", "VT"];
const jobs = [
  ...[
    "Psychiatry",
    "Psychologist",
    "Counselor",
    "Social Worker",
    "Psych/Mental Health",
    "Marriage & Family Therapist",
    "Addiction Medicine",
  ].map((term) => ({ type: "NPI-1", term })),
  ...[
    "Substance Abuse Rehabilitation Facility",
    "Psychiatric Hospital",
    "Methadone",
    "Mental Health",
    "Addiction Medicine",
  ].map((term) => ({ type: "NPI-2", term })),
];
const relevant = (t) =>
  /^103T|^101Y|^1041C|^106H|^363LP|^2084P|^2084A0391|^2084A0401|^2083A|^207RA|^207QA|^261QM|^261QS1200|^261QR0405|^261QX0200|^3245|^323P|^3208|^322D/.test(
    t.code,
  );
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await mkdir(".local/northeast/nppes", { recursive: true });
for (const state of states) {
  const providers = new Map(),
    coverage = [];
  let requests = 0;
  const tasks = jobs.flatMap((job) =>
    [...new Set(zipcodes.lookupByState(state).map((z) => z.zip.slice(0, 2)))]
      .sort()
      .map((prefix) => ({ ...job, prefix })),
  );
  let cursor = 0;
  async function run({ type, term, prefix }) {
    const cache = `.local/northeast/nppes/${state}-${type}-${jobs.findIndex((j) => j.type === type && j.term === term)}-${prefix}`;
    let list = [],
      complete = false;
    for (let skip = 0; skip <= 1000; skip += 200) {
      let data;
      const path = cache + "-" + skip + ".json";
      try {
        data = JSON.parse(await readFile(path, "utf8"));
      } catch {
        const url = new URL("https://npiregistry.cms.hhs.gov/api/");
        url.search = new URLSearchParams({
          version: "2.1",
          state,
          enumeration_type: type,
          address_purpose: "LOCATION",
          taxonomy_description: term,
          postal_code: prefix + "*",
          limit: "200",
          skip: String(skip),
        });
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
            if (!r.ok) throw Error("Registry status " + r.status);
            data = await r.json();
            await writeFile(path, JSON.stringify(data));
            break;
          } catch (e) {
            if (attempt === 3) {
              coverage.push({
                state,
                type,
                term,
                prefix,
                complete: false,
                error: e.message,
              });
              return;
            }
            await pause(500 * 2 ** attempt);
          }
        }
        requests++;
      }
      if (data.Errors) {
        coverage.push({
          state,
          type,
          term,
          prefix,
          complete: false,
          error: data.Errors,
        });
        return;
      }
      const found = data.results ?? [];
      list.push(...found);
      if (found.length < 200) {
        complete = true;
        break;
      }
    }
    if (!complete && prefix.length < 5) {
      for (let n = 0; n < 10; n++)
        await run({ type, term, prefix: prefix + n });
      return;
    }
    for (const p of list) {
      if (
        p.basic?.status !== "A" ||
        !p.taxonomies?.some(relevant) ||
        !p.addresses?.some(
          (a) => a.address_purpose === "LOCATION" && a.state === state,
        )
      )
        continue;
      providers.set(String(p.number), p);
    }
    coverage.push({
      state,
      type,
      term,
      prefix,
      returned: list.length,
      complete,
    });
    if (coverage.length % 50 === 0)
      console.log(
        state,
        "partitions",
        coverage.length,
        "unique",
        providers.size,
      );
  }
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (cursor < tasks.length) await run(tasks[cursor++]);
    }),
  );
  await writeFile(
    `.local/northeast/nppes-${state}.json`,
    JSON.stringify([...providers.values()]),
  );
  await writeFile(
    `.local/northeast/nppes-${state}-coverage.json`,
    JSON.stringify(
      {
        reviewedAt: "2026-10-26",
        state,
        providers: providers.size,
        requests,
        partitions: coverage,
        incomplete: coverage.filter((c) => !c.complete),
      },
      null,
      2,
    ),
  );
  console.log(
    "Completed registry",
    state,
    providers.size,
    "incomplete",
    coverage.filter((c) => !c.complete).length,
  );
}
