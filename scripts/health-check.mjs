const base = process.env.HEALTH_BASE_URL || "https://recoveryatlas.vercel.app";
const probe = async (path, options = {}) => {
  const r = await fetch(base + path, {
    ...options,
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  return r;
};
const home = await probe("/");
if (!home.ok || !(await home.text()).includes("Your next step starts"))
  throw Error("Public directory is unavailable");
const health = await probe("/api/health");
if (!health.ok || (await health.json()).status !== "ok")
  throw Error("Database health check failed");
const search = await probe("/api/search", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({
    filters: {
      state: "MA",
      query: "",
      category: "meetings",
      format: "",
      fellowship: "",
      payment: "",
      service: "",
      language: "",
      accessibility: false,
      population: "",
      day: "",
      soon: false,
      radius: 25,
      center: null,
      bounds: null,
      savedOnly: false,
    },
    saved: [],
    limit: 1,
  }),
});
if (!search.ok) throw Error("Meeting search failed");
const data = await search.json();
if (
  !data.resources?.length ||
  !(data.total > (new URL(base).hostname === "localhost" ? 0 : 100))
)
  throw Error("Meeting results are missing");
if (new URL(base).hostname === "recoveryatlas.vercel.app") {
  const paloAlto = async (radius) => {
    const response = await probe("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({
        filters: {
          state: "CA",
          query: "",
          category: "meetings",
          format: "in-person",
          fellowship: "AA",
          payment: "",
          service: "",
          language: "",
          accessibility: false,
          population: "",
          day: "",
          soon: false,
          radius,
          center: { lat: 37.4419, lng: -122.143 },
          bounds: null,
          savedOnly: false,
        },
        saved: [],
        limit: 1,
      }),
    });
    if (!response.ok)
      throw Error(`Palo Alto AA search failed at ${radius} miles`);
    return response.json();
  };
  const [near, wide] = await Promise.all([paloAlto(50), paloAlto(100)]);
  if (near.total < 100 || near.mapped !== near.total || wide.total < near.total)
    throw Error("Palo Alto in-person AA coverage regressed");
}
for (const path of ["/api/me/saved", "/api/community/profile"]) {
  const r = await probe(path);
  if (r.status !== 401) throw Error("Private access guard failed: " + path);
}
console.log(
  "Public directory, database, meeting search and private access guards passed.",
);
