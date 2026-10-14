/**
 * What webDEALER's plate screens ask about the vehicle, said once.
 *
 * ePLATE's License Plate Assignment page makes the desk pick a Vehicle Class
 * from six, a Major Color from sixteen, and fill an empty weight and a
 * carrying capacity. A Passenger-Truck will not go through without the
 * capacity. The corridor used to ask for the capacity only of trucks and vans,
 * and let the desk answer Not Applicable, which files a blank; for anything
 * webDEALER classes as a Passenger-Truck or a Truck that blank is a filing it
 * refuses.
 *
 * TxDMV's own Vehicle Weight Verification Guidelines, read from the TxDMV
 * site: "If the vehicle is a passenger-truck (SUV, Crossover, passenger van
 * etc.) that intends to carry a load or a truck or work panel van, a carrying
 * capacity would be applicable." And how to find it: "Carrying Capacity =
 * Gross Vehicle Weight Rating (GVWR) - Computed Empty Weight", the GVWR being
 * on the door jamb. A car is not designed to carry a load, so a car asks none.
 *
 * Pure, so the question list, the copy list and the tests all agree on which
 * vehicles need what, and none of them keeps its own regular expression.
 */

/** The six answers webDEALER's Vehicle Class box offers, spelled as it spells them. */
export const PLATE_CLASSES = ["Passenger", "Passenger-Truck", "Truck <= 1", "Truck > 1", "BUS", "NEV"] as const;
export type PlateClass = (typeof PLATE_CLASSES)[number];

/** One ton, the line between "Truck <= 1" and "Truck > 1". */
export const TON_LBS = 2000;

export type BodyFamily = "car" | "passengerTruck" | "van" | "truck" | "trailer" | "bus" | "nev";

/**
 * Which family a body style belongs to, from the text the VIN decode or the
 * desk typed. Unknown is unknown: nothing is guessed from silence.
 *
 * A van is its own family because the text cannot say whether it is a
 * passenger van (a Passenger-Truck) or a work panel van (a Truck); both need
 * the capacity, so the difference is left to the person at the screen.
 */
export function bodyFamily(bodyStyle: string | null | undefined): BodyFamily | null {
  const text = (bodyStyle ?? "").toLowerCase();
  if (!text.trim()) return null;
  if (/low.?speed|neighbou?rhood|\bnev\b|\blsv\b/.test(text)) return "nev";
  if (/\bbus\b|motorcoach/.test(text)) return "bus";
  // A trailer is drawn, not driven, and its fee is set by gross weight
  // (Transp. Code §502.254), so it files a carrying capacity like a truck.
  if (/trailer/.test(text)) return "trailer";
  if (/pickup|truck|\bcab\b|chassis|wrecker|\btow\b/.test(text)) return "truck";
  if (/\bvan\b|minivan/.test(text)) return "van";
  if (/suv|sport utility|crossover|multi.?purpose|\bmpv\b/.test(text)) return "passengerTruck";
  if (/sedan|saloon|coupe|convertible|cabriolet|wagon|estate|hatchback|roadster/.test(text)) return "car";
  return null;
}

/** Whether webDEALER wants a carrying capacity for this body style. */
export function needsCarryingCapacity(bodyStyle: string | null | undefined): boolean {
  const family = bodyFamily(bodyStyle);
  return family === "passengerTruck" || family === "van" || family === "truck" || family === "trailer";
}

/** "3,480", "3480 lbs" and " 3480 " are 3480. Anything else, and zero, is nothing. */
export function parsePounds(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).replace(/lbs?\.?/i, "").replace(/,/g, "").trim();
  if (!/^\d+$/.test(text)) return null;
  const pounds = Number(text);
  return Number.isSafeInteger(pounds) && pounds > 0 ? pounds : null;
}

export type ClassSuggestion = {
  value: PlateClass | null;
  /** Which reason this is, for the screen to say in the reader's language. */
  why: "car" | "passengerTruck" | "van" | "truckNeedsCapacity" | "truckLight" | "truckHeavy" | "trailer" | "bus" | "nev" | "unknown";
  /** One sentence, for the person choosing, in the voice of the rest of the handoff. */
  reason: string;
};

/**
 * The Vehicle Class to pick, and why. A suggestion: the person at the screen
 * chooses, and the reason is shown so a wrong guess can be seen to be wrong.
 */
export function suggestPlateClass(input: {
  bodyStyle: string | null | undefined;
  capacityLbs: number | null;
}): ClassSuggestion {
  const family = bodyFamily(input.bodyStyle);
  switch (family) {
    case "car":
      return { value: "Passenger", why: "car", reason: "A car." };
    case "passengerTruck":
      return { value: "Passenger-Truck", why: "passengerTruck", reason: "An SUV or crossover. Needs the carrying capacity." };
    case "van":
      return {
        value: "Passenger-Truck",
        why: "van",
        reason: "A work panel van is a Truck. Change it if so.",
      };
    case "truck":
      if (input.capacityLbs === null) {
        return { value: null, why: "truckNeedsCapacity", reason: "Needs the carrying capacity first." };
      }
      return input.capacityLbs <= TON_LBS
        ? { value: "Truck <= 1", why: "truckLight", reason: `Carries ${input.capacityLbs.toLocaleString("en-US")} lbs: one ton or less.` }
        : { value: "Truck > 1", why: "truckHeavy", reason: `Carries ${input.capacityLbs.toLocaleString("en-US")} lbs: over one ton.` };
    case "trailer":
      return { value: null, why: "trailer", reason: "A trailer: not one of these classes." };
    case "bus":
      return { value: "BUS", why: "bus", reason: "A bus." };
    case "nev":
      return { value: "NEV", why: "nev", reason: "A low-speed electric vehicle." };
    default:
      return { value: null, why: "unknown", reason: "Add the body style to the car." };
  }
}

/** The sixteen colors webDEALER's Major Color box offers. */
export const PLATE_COLORS = [
  "BEIGE",
  "BLACK",
  "BLUE",
  "BROWN",
  "GOLD",
  "GRAY",
  "GREEN",
  "MAROON",
  "ORANGE",
  "PINK",
  "PURPLE",
  "RED",
  "SILVER",
  "TAN",
  "WHITE",
  "YELLOW",
] as const;
export type PlateColor = (typeof PLATE_COLORS)[number];

/** What a manufacturer's paint name usually means, in the order a name is read. */
const COLOR_WORDS: ReadonlyArray<readonly [PlateColor, RegExp]> = [
  ["MAROON", /\b(maroon|burgundy|wine|cranberry|garnet|claret)\b/],
  ["SILVER", /\b(silver|platinum|aluminum|aluminium)\b/],
  ["GRAY", /\b(gr[ae]y|charcoal|graphite|gunmetal|slate|titanium|pewter)\b/],
  ["BLACK", /\b(black|onyx|ebony|obsidian|jet)\b/],
  ["WHITE", /\b(white|pearl|ivory|snow|frost|arctic|polar|alpine)\b/],
  ["BEIGE", /\b(beige|cream|champagne|sand|bisque)\b/],
  ["TAN", /\b(tan|khaki|camel|desert)\b/],
  ["BROWN", /\b(brown|bronze|chocolate|mocha|espresso|coffee|copper)\b/],
  ["GOLD", /\bgold\b/],
  ["BLUE", /\b(blue|navy|cobalt|azure|teal|aqua|indigo|sapphire)\b/],
  ["GREEN", /\b(green|olive|emerald|forest|lime|sage|jade)\b/],
  ["RED", /\b(red|crimson|scarlet|cherry|ruby)\b/],
  ["ORANGE", /\b(orange|amber)\b/],
  ["YELLOW", /\b(yellow|lemon|canary)\b/],
  ["PINK", /\b(pink|rose|magenta)\b/],
  ["PURPLE", /\b(purple|violet|plum|lavender)\b/],
];

/**
 * The webDEALER color for a paint name, or null when none of the sixteen fits.
 *
 * The first color word in the name wins ("Black Cherry" is black, "Pearl White
 * Tri-coat" is white). Null is not an error: the caller shows what was typed
 * and the desk picks the nearest one in the list.
 */
export function webDealerColor(raw: string | null | undefined): PlateColor | null {
  const text = (raw ?? "").toLowerCase();
  if (!text.trim()) return null;
  let best: { color: PlateColor; at: number } | null = null;
  for (const [color, pattern] of COLOR_WORDS) {
    const hit = pattern.exec(text);
    if (hit && (best === null || hit.index < best.at)) best = { color, at: hit.index };
  }
  return best?.color ?? null;
}
