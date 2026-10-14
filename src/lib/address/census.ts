import { placeName, stateCode, streetAddress } from "@/lib/address/normalize";

/**
 * Completing a mailing address from the street line, against the Census.
 *
 * The desk types "1605 Scenic Meadow" and stops, because that is what a person
 * says when you ask where they live. Every box under it stayed empty, and the
 * 130-U wants a city, a ZIP and a county.
 *
 * The suggestion field that already existed reads `document_agreements`: the
 * addresses this dealership has already put on paperwork. That is recall, and
 * it is genuinely useful for a repeat customer, but a first-time buyer at a new
 * address is exactly the case it cannot help with, which is most of them.
 *
 * So this asks the US Census Bureau's geocoder, which is free, needs no key, no
 * account and no contract, and is the same address file the government uses. It
 * returns the one thing no commercial autocomplete gives away cheaply and the
 * title application actually needs: the COUNTY.
 *
 * ## Why a cascade, and why the state is checked
 *
 * The geocoder has two doors and each is wrong in its own way.
 *
 * The structured door (street, city, state as separate fields) is precise and
 * refuses to answer without a city, which is the field we are trying to fill.
 *
 * The one-line door answers from a street alone, which is what we have. But it
 * searches the whole country, so a street name that exists in several states
 * comes back from whichever it liked best: "4802 Telephone Rd" resolves to
 * Cincinnatus, NEW YORK. Filling that into a Texas title application would be
 * worse than filling nothing.
 *
 * Hence: the structured door when a city is typed, the one-line door when it is
 * not, and in both cases a match whose state disagrees with the one the desk
 * selected is thrown away. A wrong answer on this form costs a rejected filing.
 * Silence costs four keystrokes.
 *
 * ## What it will not do
 *
 * It is not a prefix autocomplete. The geocoder matches a street NAME, not the
 * first few letters of one: "8774 Almeda" finds nothing, "8774 Almeda Genoa"
 * finds the lot. So this fires when the line looks like a whole street rather
 * than on every keystroke, and finding nothing is a normal, silent outcome.
 */

/** Free, keyless, and the file the government geocodes against. */
const CENSUS = "https://geocoding.geo.census.gov/geocoder/geographies";
const BENCHMARK = "Public_AR_Current";
const VINTAGE = "Current_Current";

export type CompletedAddress = {
  street: string;
  city: string;
  state: string;
  zip: string;
  /** Bare, the way the county box and the Texas list spell it: "Harris". */
  county: string;
};

/**
 * Whether this line is worth asking about.
 *
 * A house number and at least two more words, because the geocoder matches
 * whole street names and anything shorter is a prefix it will refuse. Asking
 * anyway would spend a request per keystroke to be told no.
 */
export function looksLikeAStreet(street: string): boolean {
  const trimmed = street.trim();
  if (trimmed.length < 6) return false;
  const words = trimmed.split(/\s+/);
  if (words.length < 3) return false;
  // A number somewhere near the front. "1605 Scenic Meadow", not "Scenic Meadow".
  return /\d/.test(words[0]) || /\d/.test(words[1] ?? "");
}

export type CensusRequest = { url: string; params: Record<string, string> };

/** The first request for what the desk has typed so far. */
export function censusRequest(street: string, city: string, state: string, zip = ""): CensusRequest {
  return censusRequests(street, city, state, zip)[0];
}

/**
 * Every request worth making for what the desk has typed, best first.
 *
 * Measured against the live service, no single door answers every street:
 *
 * - A typed city or ZIP goes through the precise door, which needs one.
 * - The street alone finds a street whose name is unique in the country,
 *   suffix or not: "1605 Scenic Meadow" is Pearland.
 * - The street with the state finds a common name the bare street lost to
 *   another state: "4802 Telephone Rd" alone is New York, and with ", TX"
 *   it is Houston. The same suffix breaks a partial name ("1605 Scenic
 *   Meadow, TX" finds nothing), which is why it is second, not first.
 *
 * The action stops at the first one that gives a usable answer.
 */
export function censusRequests(street: string, city: string, state: string, zip = ""): CensusRequest[] {
  const shared = { benchmark: BENCHMARK, vintage: VINTAGE, format: "json" };
  const line = street.trim();
  const typedCity = city.trim();
  const typedState = state.trim();
  const typedZip = zip.trim();
  const requests: CensusRequest[] = [];
  if (typedCity || /^\d{5}/.test(typedZip)) {
    // Precise, and only available once a city or ZIP exists to send.
    const params: Record<string, string> = { street: line, state: typedState, ...shared };
    if (typedCity) params.city = typedCity;
    if (/^\d{5}/.test(typedZip)) params.zip = typedZip.slice(0, 5);
    requests.push({ url: `${CENSUS}/address`, params });
  }
  requests.push({ url: `${CENSUS}/onelineaddress`, params: { address: line, ...shared } });
  if (typedState) {
    requests.push({ url: `${CENSUS}/onelineaddress`, params: { address: `${line}, ${typedState}`, ...shared } });
  }
  return requests;
}

type CensusMatch = {
  matchedAddress?: unknown;
  addressComponents?: Record<string, unknown>;
  geographies?: Record<string, unknown>;
};

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

/**
 * The county, without the word "County".
 *
 * The Census says "Brazoria County". The 130-U's box, the county datalist and
 * every stored answer in this codebase say "Brazoria". Storing the long form
 * would make the same county fail to match itself.
 */
function bareCounty(name: string): string {
  return placeName(name.replace(/\s+(County|Parish|Borough|Census Area)$/i, "").trim());
}

/**
 * One usable answer, or null.
 *
 * Matches in a state other than the desk's are set aside first, so a street
 * that exists in Texas and in New York still answers for the Texas deal.
 *
 * Null on: no match, more than one different address left (an ambiguous
 * street is not something to guess at on a title application), a missing
 * city or ZIP, or no match in the desk's state. Every one of those is a case
 * where filling the boxes would be inventing an address rather than
 * completing one.
 */
export function readCensusMatch(
  payload: unknown,
  expectedState: string,
): CompletedAddress | null {
  const matches = (payload as { result?: { addressMatches?: unknown } })?.result
    ?.addressMatches;
  if (!Array.isArray(matches) || matches.length === 0) return null;

  // The guard that keeps a Texas deal in Texas.
  const wanted = expectedState.trim().toUpperCase();
  const inState = (matches as CensusMatch[]).filter(
    (each) => !wanted || text(each?.addressComponents?.state).toUpperCase() === wanted,
  );
  // The same address listed twice is one answer; two addresses are a guess.
  const distinct = new Set(inState.map((each) => text(each?.matchedAddress).toUpperCase()));
  if (inState.length === 0 || distinct.size !== 1) return null;

  const match = inState[0];
  const parts = match.addressComponents ?? {};
  const city = text(parts.city);
  const state = text(parts.state).toUpperCase();
  const zip = text(parts.zip);
  if (!city || !state || !zip) return null;

  // The street as matched, which carries the suffix the desk left off:
  // "1605 SCENIC MEADOW CT, PEARLAND, TX, 77581" -> "1605 Scenic Meadow Ct".
  const line = text(match.matchedAddress).split(",")[0] ?? "";
  if (!line) return null;

  const counties = (match.geographies ?? {})["Counties"];
  const county = Array.isArray(counties) && counties.length > 0
    ? bareCounty(text((counties[0] as Record<string, unknown>)?.NAME))
    : "";

  return {
    street: streetAddress(line),
    city: placeName(city),
    state: stateCode(state),
    zip: zip.slice(0, 10),
    county,
  };
}
