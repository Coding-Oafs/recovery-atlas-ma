import { NextRequest, NextResponse } from "next/server";
import zipcodes from "zipcodes";
import { rateLimit, sameOrigin } from "@/lib/security";
export async function POST(request: NextRequest) {
  if (!(await sameOrigin()))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const body = await request.json();
    if (typeof body.query !== "string" || body.query.length > 200)
      return NextResponse.json(
        { error: "Enter a Massachusetts city, ZIP code or street address." },
        { status: 400 },
      );
    const query = body.query.trim();
    if (!query)
      return NextResponse.json({ error: "Enter a location." }, { status: 400 });
    if (!(await rateLimit("location", 30, 10)))
      return NextResponse.json(
        { error: "Please wait before searching more locations." },
        { status: 429 },
      );
    if (/^\d{5}$/.test(query)) {
      const z = zipcodes.lookup(query);
      if (!z || z.state !== "MA")
        return NextResponse.json(
          { error: "The pilot covers Massachusetts ZIP codes." },
          { status: 400 },
        );
      return NextResponse.json({
        lat: z.latitude,
        lng: z.longitude,
        label: `${z.city}, MA ${query}`,
        approximate: true,
      });
    }
    const city = query.replace(/,?\s+(massachusetts|ma)$/i, "").trim();
    const zs = zipcodes.lookupByName(city, "MA");
    if (zs.length) {
      return NextResponse.json({
        lat: zs.reduce((a, z) => a + z.latitude, 0) / zs.length,
        lng: zs.reduce((a, z) => a + z.longitude, 0) / zs.length,
        label: `${zs[0].city}, MA`,
        approximate: true,
      });
    }
    if (!/\d/.test(query))
      return NextResponse.json(
        {
          error:
            "City not found. Try its ZIP code or a full Massachusetts street address.",
        },
        { status: 404 },
      );
    const url = new URL(
      "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress",
    );
    url.search = new URLSearchParams({
      address: /\bMA\b|Massachusetts/i.test(query) ? query : `${query}, MA`,
      benchmark: "Public_AR_Current",
      format: "json",
    }).toString();
    const result = await fetch(url, {
      signal: AbortSignal.timeout(9000),
      cache: "no-store",
    });
    const data = await result.json();
    const match = data.result?.addressMatches?.find(
      (x: { addressComponents?: { state?: string } }) =>
        x.addressComponents?.state === "MA",
    );
    if (!match)
      return NextResponse.json(
        { error: "Address not found. Try a ZIP code or use your location." },
        { status: 404 },
      );
    return NextResponse.json({
      lat: match.coordinates.y,
      lng: match.coordinates.x,
      label: match.matchedAddress,
      approximate: false,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Location lookup is temporarily unavailable. Try again or use your location.",
      },
      { status: 503 },
    );
  }
}
