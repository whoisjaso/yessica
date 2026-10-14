/**
 * Box 11 of the 130-U, the empty weight, found rather than typed.
 *
 * The owner's instruction, 30 September 2026: nobody at the desk should have
 * to type the empty weight. Find it for this vehicle as accurately as
 * possible and put it in. An earlier note in `derive.ts` refused to do this,
 * on the grounds that a decoder's figure is a guess; the owner has decided
 * otherwise, and this module is how the guess is made as good as it can be.
 *
 * Two public NHTSA sources, in order:
 *
 *   1. The VIN decode (vPIC `DecodeVinValues`). When the manufacturer
 *      reported a curb weight for this exact VIN pattern, it is the answer.
 *      Most VINs carry none.
 *   2. NHTSA's Canadian Vehicle Specifications (Transport Canada's measured
 *      dimensions and curb weights), searched by year, make and model. One
 *      model returns every configuration, and they differ a lot: a 2018
 *      F-150 runs from 4,050 lb (regular cab, 2WD) to 5,697 lb (Raptor
 *      SuperCrew). So the configuration is chosen from what the VIN decode
 *      says about THIS vehicle: cab, bed, drive, trim, body, doors and
 *      transmission.
 *
 * Pure: the network lives in `curb-weight-lookup.ts`, so every choice made
 * here can be tested from a fixture.
 */

export type CurbWeightSource = "vin" | "specs";

export type CurbWeightResult = {
  pounds: number;
  source: CurbWeightSource;
  /** The configuration the figure came from, for the screen and the record. */
  basis: string;
  /** How many configurations tied for best match; 1 is an exact pick. */
  candidates: number;
};

/** What the VIN decode says about the vehicle, in vPIC's own field names. */
export type VinFacts = {
  make?: string | null;
  model?: string | null;
  year?: number | null;
  trim?: string | null;
  series?: string | null;
  bodyClass?: string | null;
  bodyCabType?: string | null;
  bedLengthIn?: number | null;
  driveType?: string | null;
  doors?: number | null;
  displacementL?: number | null;
  transmissionStyle?: string | null;
  fuelType?: string | null;
  curbWeightLb?: number | null;
  /** vPIC's GVWR class ("Class 2E: 6,001 - 7,000 lb ..."), a band, never a figure (`gvwr.ts`). */
  gvwr?: string | null;
  /** The top of the class range when the VIN pattern spans classes. */
  gvwrTo?: string | null;
};

export type SpecVariant = { model: string; curbWeightLb: number };

/** Read NHTSA's GetCanadianVehicleSpecifications JSON (units=US) into variants. */
export function parseCanadianSpecs(json: unknown): SpecVariant[] {
  const results = (json as { Results?: unknown })?.Results;
  if (!Array.isArray(results)) return [];
  const out: SpecVariant[] = [];
  for (const entry of results) {
    const specs = (entry as { Specs?: unknown })?.Specs;
    if (!Array.isArray(specs)) continue;
    const byName = new Map<string, string>();
    for (const spec of specs) {
      const name = (spec as { Name?: unknown }).Name;
      const value = (spec as { Value?: unknown }).Value;
      if (typeof name === "string" && typeof value === "string") byName.set(name, value);
    }
    const model = byName.get("Model")?.trim();
    const weight = Number(byName.get("CW"));
    if (model && Number.isFinite(weight) && weight > 500 && weight < 30000) {
      out.push({ model, curbWeightLb: weight });
    }
  }
  return out;
}

const norm = (value: string | null | undefined) =>
  (value ?? "").toUpperCase().replace(/[^A-Z0-9.]+/g, " ").trim();

/** The model family token, as the specs table spells it ("F-150" -> "F 150"). */
export function modelFamily(model: string | null | undefined): string {
  return norm(model);
}

function has(text: string, ...needles: string[]): boolean {
  return needles.some((needle) => new RegExp(`(^| )${needle.replace(/\./g, "\\.")}( |$)`).test(text));
}

/** Cab words, both vocabularies, grouped by what they mean. */
const CAB: Record<"crew" | "extended" | "regular", string[]> = {
  crew: ["SUPERCREW", "CREW", "CREWMAX", "CREW CAB"],
  extended: ["SUPERCAB", "EXT", "EXTENDED", "DOUBLE", "QUAD", "KING", "ACCESS", "CLUB"],
  regular: ["REG", "REGULAR"],
};

function cabOf(text: string): keyof typeof CAB | null {
  if (has(text, "SUPERCREW", "CREWMAX") || /(^| )CREW( |$)/.test(text)) return "crew";
  if (has(text, ...CAB.extended)) return "extended";
  if (has(text, ...CAB.regular)) return "regular";
  return null;
}

function fourWheel(text: string): boolean {
  return has(text, "4X4", "4WD", "AWD", "4MATIC", "XDRIVE", "QUATTRO", "ALL4", "SH AWD");
}

/** Bed length in feet printed in a variant ("6.5 FT BOX", "5.5-FT"), or short/long. */
function bedOf(text: string): { feet?: number; size?: "short" | "long" } {
  const feet = /(\d{1,2}(?:\.\d)?) ?FT/.exec(text);
  if (feet) return { feet: Number(feet[1]) };
  if (/(^| )S BOX( |$)|SHORT/.test(text)) return { size: "short" };
  if (/(^| )L BOX( |$)|LONG/.test(text)) return { size: "long" };
  return {};
}

/**
 * How well one configuration matches this vehicle. Higher is better; a
 * contradiction (4x4 against 2WD, crew against regular) costs more than a
 * match earns, so the wrong configuration never wins on trim words alone.
 */
export function scoreVariant(variant: string, facts: VinFacts): number {
  const text = norm(variant);
  let score = 0;

  const drive = norm(facts.driveType);
  if (drive) {
    const vehicleFour = /4X4|4WD|AWD|ALL WHEEL|FOUR WHEEL/.test(drive);
    const variantFour = fourWheel(text);
    const variantTwo = has(text, "2WD", "FWD", "RWD", "4X2");
    if (vehicleFour && variantFour) score += 3;
    else if (vehicleFour && variantTwo) score -= 4;
    else if (!vehicleFour && variantTwo) score += 3;
    else if (!vehicleFour && variantFour) score -= 4;
  }

  const cab = norm(facts.bodyCabType);
  if (cab) {
    const vehicleCab = /CREW/.test(cab) ? "crew" : /EXT|SUPER|DOUBLE|QUAD|KING|ACCESS|CLUB/.test(cab) ? "extended" : /REG|STANDARD/.test(cab) ? "regular" : null;
    const variantCab = cabOf(text);
    if (vehicleCab && variantCab) score += vehicleCab === variantCab ? 4 : -5;
  }

  if (facts.bedLengthIn && facts.bedLengthIn > 0) {
    const bed = bedOf(text);
    const vehicleFeet = facts.bedLengthIn / 12;
    if (bed.feet) score += Math.abs(bed.feet - vehicleFeet) <= 0.6 ? 3 : -3;
    else if (bed.size) score += (bed.size === "short") === vehicleFeet < 7 ? 2 : -2;
  }

  // Trim and series words that name a configuration ("SPORT", "RAPTOR", "LX").
  const trimWords = new Set(
    `${norm(facts.trim)} ${norm(facts.series)}`
      .split(" ")
      .filter((word) => word.length >= 2 && !/^\d+$/.test(word)),
  );
  for (const word of trimWords) {
    if (has(text, word) || text.split(" ").some((token) => token.split("/").includes(word))) score += 2;
  }
  // A performance or special variant the vehicle is not must not win.
  for (const special of ["RAPTOR", "HYBRID", "SRT", "TRX", "AMG", "TYPE R", "SHELBY", "ZR2", "TRD PRO", "ELECTRIC", "EV", "PHEV", "PLUG IN"]) {
    if (has(text, special) && !trimWords.has(special) && !norm(facts.fuelType).includes("ELECTRIC")) score -= 3;
  }

  const body = norm(facts.bodyClass);
  for (const kind of ["SEDAN", "COUPE", "HATCHBACK", "WAGON", "CONVERTIBLE", "SUV", "VAN", "MINIVAN"]) {
    if (body.includes(kind) && has(text, kind)) score += 1;
  }
  if (facts.doors && has(text, `${facts.doors}DR`)) score += 1;

  const transmission = norm(facts.transmissionStyle);
  if (transmission) {
    if (/MANUAL/.test(transmission)) score += has(text, "MANUAL", "MT") ? 2 : has(text, "AUTOMATIC", "CVT", "AT") ? -2 : 0;
    else if (/CVT|CONTINUOUSLY/.test(transmission)) score += has(text, "CVT") ? 2 : has(text, "MANUAL") ? -2 : 0;
    else if (/AUTO/.test(transmission)) score += has(text, "MANUAL") ? -2 : 0;
  }

  if (facts.displacementL && facts.displacementL > 0) {
    const litres = facts.displacementL.toFixed(1);
    if (has(text, litres, `${litres}L`, `${litres}T`)) score += 2;
  }

  return score;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * The weight to file, or null when nothing credible was found.
 *
 * The manufacturer's VIN-level figure wins outright. Otherwise the best
 * scoring configuration of this model; when several tie, the median of the
 * tied ones, never the heaviest or the lightest by accident of order.
 */
export function pickCurbWeight(facts: VinFacts, variants: SpecVariant[]): CurbWeightResult | null {
  if (facts.curbWeightLb && facts.curbWeightLb > 500) {
    return {
      pounds: Math.round(facts.curbWeightLb),
      source: "vin",
      basis: [facts.year, facts.make, facts.model, facts.trim].filter(Boolean).join(" "),
      candidates: 1,
    };
  }

  // Only configurations of this model family: a search for "Accord" must not
  // weigh an Accord Crosstour, and "F-150" must not weigh an F-250.
  const family = modelFamily(facts.model);
  const own = family
    ? variants.filter((variant) => {
        const text = norm(variant.model);
        return text === family || text.startsWith(`${family} `);
      })
    : variants;
  const pool = own.length > 0 ? own : [];
  if (pool.length === 0) return null;

  const scored = pool.map((variant) => ({ variant, score: scoreVariant(variant.model, facts) }));
  const best = Math.max(...scored.map((entry) => entry.score));
  const top = scored.filter((entry) => entry.score === best);
  const pounds = Math.round(median(top.map((entry) => entry.variant.curbWeightLb)));
  const nearest = top.reduce((a, b) =>
    Math.abs(a.variant.curbWeightLb - pounds) <= Math.abs(b.variant.curbWeightLb - pounds) ? a : b,
  );
  return {
    pounds,
    source: "specs",
    basis: `${facts.year ?? ""} ${nearest.variant.model}`.trim(),
    candidates: top.length,
  };
}
