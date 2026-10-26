import { NextRequest, NextResponse } from "next/server";
import zipcodes from "zipcodes";
import { rateLimit, sameOrigin } from "./security";
import { isRegionState } from "./region";
import { parseLocationQuery } from "./location-search";
export async function POST(request: NextRequest) {
  if (!(await sameOrigin()))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const body = await request.json();
    if (typeof body.query !== "string" || body.query.length > 200)
      return NextResponse.json(
        {
          error:
            "Enter a Northeast city and state, ZIP code or street address.",
        },
        { status: 400 },
      );
    const query = body.query.trim();
    if (!query)
      return NextResponse.json({ error: "Enter a location." }, { status: 400 });
    if (!(await rateLimit("location", 60, 10)))
      return NextResponse.json(
        { error: "Please wait before searching more locations." },
        { status: 429 },
      );
    if (/^\d{5}$/.test(query)) {
      const z = zipcodes.lookup(query);
      if (!z || !isRegionState(z.state))
        return NextResponse.json(
          {
            error:
              "This directory covers CT, MA, ME, NH, NJ, NY, PA, RI and VT ZIP codes.",
          },
          { status: 400 },
        );
      return NextResponse.json({
        lat: z.latitude,
        lng: z.longitude,
        state: z.state,
        label: `${z.city}, ${z.state} ${query}`,
        approximate: true,
      });
    }
    const parsed = parseLocationQuery(
      query,
      typeof body.state === "string" ? body.state : "",
    );
    if (parsed.ambiguous && !/\d/.test(query))
      return NextResponse.json(
        {
          error:
            "Several places have that name. Add a state, such as Portland, ME, or enter a ZIP code.",
        },
        { status: 400 },
      );
    if (parsed.matches.length) {
      const zs = parsed.matches;
      return NextResponse.json({
        lat: zs.reduce((a, z) => a + z.latitude, 0) / zs.length,
        lng: zs.reduce((a, z) => a + z.longitude, 0) / zs.length,
        state: zs[0].state,
        label: `${zs[0].city}, ${zs[0].state}`,
        approximate: true,
      });
    }
    if (!/\d/.test(query))
      return NextResponse.json(
        { error: "City not found. Try a city and state or ZIP code." },
        { status: 404 },
      );
    if (!parsed.state)
      return NextResponse.json(
        {
          error:
            "Include a state in the street address or select a state filter.",
        },
        { status: 400 },
      );
    const url = new URL(
      "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress",
    );
    url.search = new URLSearchParams({
      address: parsed.city + ", " + parsed.state,
      benchmark: "Public_AR_Current",
      format: "json",
    }).toString();
    const response = await fetch(url, {
      signal: AbortSignal.timeout(9000),
      cache: "no-store",
    });
    if (!response.ok) throw Error("Geocoder unavailable");
    const data = await response.json();
    const match = data.result?.addressMatches?.find(
      (x: { addressComponents?: { state?: string } }) =>
        x.addressComponents?.state === parsed.state,
    );
    if (!match)
      return NextResponse.json(
        { error: "Address not found. Try a ZIP code or use your location." },
        { status: 404 },
      );
    return NextResponse.json({
      lat: match.coordinates.y,
      lng: match.coordinates.x,
      state: parsed.state,
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
