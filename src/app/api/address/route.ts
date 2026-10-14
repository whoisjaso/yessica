import { censusRequests, looksLikeAStreet, readCensusMatch } from "@/lib/address/census";

/**
 * The rest of an address from the street line, from the US Census
 * geocoder: free, keyless, and it returns the county the 130-U needs.
 * Fails silent: nothing found means she types the boxes.
 */
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const street = p.get("street") ?? "";
  const city = p.get("city") ?? "";
  const state = p.get("state") || "TX";
  const zip = p.get("zip") ?? "";
  if (!looksLikeAStreet(street)) return Response.json({ address: null });
  for (const { url, params } of censusRequests(street, city, state, zip)) {
    try {
      const res = await fetch(`${url}?${new URLSearchParams(params)}`, {
        signal: AbortSignal.timeout(4000),
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const found = readCensusMatch(await res.json(), state);
      if (found) return Response.json({ address: found });
    } catch {
      // next door
    }
  }
  return Response.json({ address: null });
}
