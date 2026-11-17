/** Only committed or publisher-advertised URLs on explicitly approved hosts reach this reader. */
export async function readPublicSource(
  url: string,
  options: {
    hosts: string[];
    max?: number;
    etag?: string;
    modified?: string;
    timeout?: number;
    signal?: AbortSignal;
  },
): Promise<{
  text: Buffer | null;
  etag: string | null;
  modified: string | null;
}> {
  const allowed = (u: URL) =>
    u.protocol === "https:" &&
    !u.username &&
    !u.password &&
    !u.port &&
    (options.hosts.includes(u.hostname) ||
      (options.hosts.includes("docs.google.com") &&
        u.hostname.endsWith(".googleusercontent.com")));
  let target = new URL(url);
  if (!allowed(target)) throw Error("Source host requires review");
  for (let n = 0; n < 4; n++) {
    const timeout = AbortSignal.timeout(options.timeout ?? 15000);
    const r = await fetch(target, {
      redirect: "manual",
      cache: "no-store",
      signal: options.signal
        ? AbortSignal.any([timeout, options.signal])
        : timeout,
      headers: {
        ...(options.etag ? { "If-None-Match": options.etag } : {}),
        ...(options.modified ? { "If-Modified-Since": options.modified } : {}),
      },
    });
    if (r.status >= 300 && r.status < 400 && r.status !== 304) {
      target = new URL(r.headers.get("location") || "", target);
      if (!allowed(target)) throw Error("Source redirect requires review");
      continue;
    }
    if (r.status === 304)
      return {
        text: null,
        etag: r.headers.get("etag") || options.etag || null,
        modified: r.headers.get("last-modified") || options.modified || null,
      };
    if (!r.ok || r.status === 202) throw Error("Source HTTP " + r.status);
    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = r.body!.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > (options.max ?? 20000000)) {
        await reader.cancel();
        throw Error("Source size limit");
      }
      chunks.push(value);
    }
    return {
      text: Buffer.concat(chunks),
      etag: r.headers.get("etag"),
      modified: r.headers.get("last-modified"),
    };
  }
  throw Error("Too many source redirects");
}
