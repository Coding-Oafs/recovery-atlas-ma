import { mkdir, readFile, writeFile } from "node:fs/promises";
await mkdir(".local/sources/nppes", { recursive: true });
const terms = [
  "Psychiatry",
  "Psychologist",
  "Counselor",
  "Social Worker",
  "Psych/Mental Health",
  "Marriage & Family Therapist",
  "Addiction Medicine",
];
const tasks = [];
for (const term of terms)
  for (let zip = 10; zip <= 27; zip++)
    tasks.push({ term, prefix: String(zip).padStart(3, "0") });
const providers = new Map(),
  coverage = [];
let cursor = 0;
const relevant = (t) =>
  /^103T|^101Y|^1041C|^106H|^363LP|^2084P|^2084A|^2083A|^207RA|^207QA/.test(
    t.code,
  );
async function run({ term, prefix }) {
  const key = terms.indexOf(term) + "-" + prefix;
  let list = [],
    complete = false,
    requests = 0;
  for (let skip = 0; skip <= 1000; skip += 200) {
    const file = `.local/sources/nppes/${key}-${skip}.json`;
    let data;
    try {
      data = JSON.parse(await readFile(file, "utf8"));
    } catch {
      const url = new URL("https://npiregistry.cms.hhs.gov/api/");
      url.search = new URLSearchParams({
        version: "2.1",
        state: "MA",
        enumeration_type: "NPI-1",
        address_purpose: "LOCATION",
        taxonomy_description: term,
        postal_code: prefix + "*",
        limit: "200",
        skip: String(skip),
      });
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
          if (!res.ok) throw Error("Registry returned " + res.status);
          data = await res.json();
          await writeFile(file, JSON.stringify(data));
          break;
        } catch (e) {
          if (attempt === 2) {
            coverage.push({ term, prefix, complete: false, error: e.message });
            return;
          }
        }
      }
    }
    requests++;
    if (data.Errors) {
      coverage.push({ term, prefix, complete: false, error: data.Errors });
      return;
    }
    const result = data.results ?? [];
    list.push(...result);
    if (result.length < 200) {
      complete = true;
      break;
    }
  }
  if (!complete) {
    // The registry caps a query at 1,200 results. Split capped postal prefixes further.
    if (prefix.length < 5) {
      for (let n = 0; n < 10; n++) await run({ term, prefix: prefix + n });
      return;
    }
  }
  let matched = 0;
  for (const p of list) {
    if (p.basic?.status !== "A" || !p.taxonomies?.some(relevant)) continue;
    const address = p.addresses?.find(
      (a) => a.address_purpose === "LOCATION" && a.state === "MA",
    );
    if (!address) continue;
    providers.set(String(p.number), p);
    matched++;
  }
  coverage.push({
    term,
    prefix,
    returned: list.length,
    matched,
    complete,
    requests,
  });
  if (coverage.length % 15 === 0)
    console.log(
      "Registry partitions completed:",
      coverage.length,
      "unique relevant providers:",
      providers.size,
    );
}
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (cursor < tasks.length) {
      const task = tasks[cursor++];
      await run(task);
    }
  }),
);
await writeFile(
  ".local/sources/nppes-providers.json",
  JSON.stringify([...providers.values()]),
);
await writeFile(
  ".local/sources/nppes-coverage.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      partitions: coverage,
      uniqueProviders: providers.size,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    {
      providers: providers.size,
      partitions: coverage.length,
      incomplete: coverage.filter((x) => !x.complete),
    },
    null,
    2,
  ),
);
