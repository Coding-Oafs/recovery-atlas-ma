import { Unzip, UnzipInflate } from "fflate";
import taxonomy from "../../data/provider-taxonomies.json";
const taxonomies = new Map(taxonomy.map((t) => [t.code, t]));
/** Incremental RFC 4180 records; quoted delimiters can straddle compressed chunks. */
export class CsvStream {
  private row: string[] = [];
  private cell = "";
  private quoted = false;
  private quotePending = false;
  private skipLf = false;
  constructor(private emit: (row: string[]) => void) {}
  push(text: string, final = false) {
    for (const c of text) {
      if (this.skipLf) {
        this.skipLf = false;
        if (c === "\n") continue;
      }
      if (this.quotePending) {
        this.quotePending = false;
        if (c === '"') {
          this.cell += '"';
          continue;
        }
        this.quoted = false;
      }
      if (this.quoted) {
        if (c === '"') this.quotePending = true;
        else this.cell += c;
      } else if (c === '"') this.quoted = true;
      else if (c === ",") {
        this.row.push(this.cell);
        this.cell = "";
      } else if (c === "\r" || c === "\n") {
        this.row.push(this.cell);
        this.emit(this.row);
        this.row = [];
        this.cell = "";
        this.skipLf = c === "\r";
      } else this.cell += c;
      if (this.cell.length > 1000000 || this.row.length > 500)
        throw Error("Unexpected NPPES CSV field size");
    }
    if (final) {
      if (this.quoted && !this.quotePending) throw Error("Truncated NPPES CSV");
      if (this.cell || this.row.length) {
        this.row.push(this.cell);
        this.emit(this.row);
        this.row = [];
        this.cell = "";
      }
    }
  }
}
export async function readNppesWeekly(url: string) {
  const u = new URL(url);
  if (
    u.origin !== "https://download.cms.gov" ||
    !/^\/nppes\/NPPES_Data_Dissemination_\d{6}_\d{6}_Weekly_V2\.zip$/.test(
      u.pathname,
    )
  )
    throw Error("Unapproved weekly NPPES file");
  const response = await fetch(url, {
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(150000),
  });
  if (!response.ok) throw Error("NPPES HTTP " + response.status);
  const selected: any[] = [],
    deactivated: string[] = [];
  let files = 0,
    scanned = 0,
    error: Error | undefined,
    headers: string[] = [];
  const decoder = new TextDecoder();
  const csv = new CsvStream((row) => {
    if (!headers.length) {
      headers = row.map((v) => v.replace(/^\uFEFF/, ""));
      if (!headers.includes("NPI")) throw Error("Changed NPPES columns");
      return;
    }
    scanned++;
    const r = Object.fromEntries(headers.map((k, i) => [k, row[i] || ""])),
      npi = r.NPI;
    if (!/^\d{10}$/.test(npi)) return;
    const d = r["NPI Deactivation Date"],
      reactivated = r["NPI Reactivation Date"];
    if (d && (!reactivated || Date.parse(reactivated) <= Date.parse(d))) {
      deactivated.push(npi);
      return;
    }
    const matches = Array.from({ length: 15 }, (_, i) =>
      taxonomies.get(r["Healthcare Provider Taxonomy Code_" + (i + 1)]),
    ).filter(Boolean);
    if (
      !matches.length ||
      !["", "US", "USA"].includes(
        r[
          "Provider Business Practice Location Address Country Code (If outside U.S.)"
        ],
      )
    )
      return;
    selected.push({
      npi,
      entity: r["Entity Type Code"],
      organization: r["Provider Organization Name (Legal Business Name)"],
      first: r["Provider First Name"],
      middle: r["Provider Middle Name"],
      last: r["Provider Last Name (Legal Name)"],
      address: r["Provider First Line Business Practice Location Address"],
      address2: r["Provider Second Line Business Practice Location Address"],
      city: r["Provider Business Practice Location Address City Name"],
      state: r["Provider Business Practice Location Address State Name"],
      postal: r["Provider Business Practice Location Address Postal Code"],
      phone: r["Provider Business Practice Location Address Telephone Number"],
      updated: r["Last Update Date"],
      taxonomies: matches,
    });
    if (selected.length > 200000)
      throw Error("Unexpected NPPES weekly selection size");
  });
  const unzip = new Unzip((file) => {
    if (
      !/^npidata_pfile_.*\.csv$/i.test(file.name) ||
      /fileheader/i.test(file.name)
    )
      return;
    files++;
    file.ondata = (err, chunk, final) => {
      if (err) {
        error = err;
        return;
      }
      try {
        csv.push(decoder.decode(chunk, { stream: !final }), final);
      } catch (e) {
        error = e as Error;
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  const reader = response.body!.getReader();
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 300000000) {
      await reader.cancel();
      throw Error("NPPES weekly archive size limit");
    }
    unzip.push(value);
    if (error) {
      await reader.cancel();
      throw error;
    }
  }
  unzip.push(new Uint8Array(), true);
  if (error) throw error;
  if (files !== 1 || scanned < 1)
    throw Error("Incomplete NPPES weekly archive");
  return { selected, deactivated, scanned };
}
