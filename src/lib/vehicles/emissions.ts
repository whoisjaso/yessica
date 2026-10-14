/**
 * Does this sale need a passing emissions test before Texas will register it?
 *
 * Texas ended safety inspections for non-commercial vehicles on 1 January
 * 2025 (House Bill 3297). What remains is the emissions test, and only where
 * the buyer registers the car: the counties below. The county tax office
 * returns a title application that needed a passing test and did not have
 * one, so the desk answers this before the packet is filed, not after.
 *
 * Sources, as of October 2026:
 *   TxDMV, "Out of State and Imported Vehicles" and the 9 September 2024
 *     release: the seventeen counties.
 *   TxDMV via TIADA, 18 February 2025, "TxDMV Provides Clarity for Emissions
 *     Requirements": a retail sale to a buyer in an emissions county needs a
 *     passing test unless the car is 1996 or newer, under 50,000 miles, and
 *     last titled or registered in a Texas county without emissions testing;
 *     a car last titled out of state always needs it.
 *   TCEQ, "Vehicle Emissions Inspections in Texas": gasoline vehicles two
 *     through twenty-four model years old; diesel, electric and motorcycles
 *     are not tested; Bexar County joins on 1 November 2026.
 *
 * The desk does not know a Texas-titled car's last county of registration,
 * so a car that could qualify for the low-mileage exemption is "confirm",
 * not a guess either way.
 */

import { canonicalCounty, TEXAS_COUNTIES } from "@/lib/vehicles/texas-counties";

const SEVENTEEN = [
  "Brazoria",
  "Collin",
  "Dallas",
  "Denton",
  "El Paso",
  "Ellis",
  "Fort Bend",
  "Galveston",
  "Harris",
  "Johnson",
  "Kaufman",
  "Montgomery",
  "Parker",
  "Rockwall",
  "Tarrant",
  "Travis",
  "Williamson",
] as const;

/** Counties that join later, from the day their testing begins. */
const JOINING: { county: string; from: string }[] = [{ county: "Bexar", from: "2026-11-01" }];

/**
 * "harris county", "HARRIS", " Harris Co. " all read as Harris; a Texas
 * county comes back in its proper spelling (DeWitt, McLennan, La Salle).
 */
export function normalizeCounty(raw: string | null | undefined): string | null {
  const known = canonicalCounty(raw);
  if (known) return known;
  const text = (raw ?? "")
    .trim()
    .replace(/\s+(county|co\.?)$/i, "")
    .replace(/\s+/g, " ");
  if (!text) return null;
  return text.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The emissions counties in effect on a date (YYYY-MM-DD). */
export function emissionsCounties(onDate: string): string[] {
  return [...SEVENTEEN, ...JOINING.filter((j) => onDate >= j.from).map((j) => j.county)];
}

/** Every Texas county that does not test on a date: no inspection there for a non-commercial car. */
export function noInspectionCounties(onDate: string): string[] {
  const testing = new Set(emissionsCounties(onDate));
  return TEXAS_COUNTIES.filter((county) => !testing.has(county));
}

export function isEmissionsCounty(county: string | null | undefined, onDate: string): boolean {
  const name = normalizeCounty(county);
  return Boolean(name && emissionsCounties(onDate).includes(name));
}

export type EmissionsStatus = "required" | "confirm" | "notRequired" | "unknown";

export type EmissionsVerdict = {
  status: EmissionsStatus;
  /** One plain sentence the desk can show as is. */
  reason: string;
};

export type EmissionsInput = {
  buyerCounty: string | null | undefined;
  /** Two letters; anything but TX registers the car somewhere else. */
  buyerState: string | null | undefined;
  /** The issuing state of the title, or null for a Texas title. */
  titleState: string | null;
  year: number | null | undefined;
  mileage: number | null | undefined;
  /** The sale date, YYYY-MM-DD. */
  onDate: string;
};

export function emissionsVerdict(input: EmissionsInput): EmissionsVerdict {
  const state = (input.buyerState ?? "").trim().toUpperCase();
  if (state && state !== "TX") {
    return { status: "notRequired", reason: `The buyer registers in ${state}, not Texas.` };
  }
  const county = normalizeCounty(input.buyerCounty);
  if (!county) {
    return { status: "unknown", reason: "Add the buyer's county: it decides whether an emissions test is needed." };
  }
  if (!canonicalCounty(county)) {
    return {
      status: "unknown",
      reason: `"${county}" is not a Texas county. Check the county on the buyer's address.`,
    };
  }
  if (!isEmissionsCounty(county, input.onDate)) {
    return { status: "notRequired", reason: `${county} County has no emissions testing. No inspection is needed.` };
  }
  const saleYear = Number(input.onDate.slice(0, 4));
  const year = Number(input.year) || null;
  if (year) {
    const age = saleYear - year;
    if (age < 2 || age > 24) {
      return {
        status: "notRequired",
        reason: `Texas tests gasoline cars two to twenty-four model years old; a ${year} is outside that.`,
      };
    }
  }
  const fuelNote = "Diesel and electric cars are not tested.";
  if (input.titleState) {
    return {
      status: "required",
      reason: `Last titled in ${input.titleState}, buyer in ${county} County: get a passing emissions test and upload the report last. ${fuelNote}`,
    };
  }
  const miles = Number(input.mileage);
  const couldBeExempt = (year ?? 0) >= 1996 && Number.isFinite(miles) && miles >= 0 && miles < 50000;
  if (couldBeExempt) {
    return {
      status: "confirm",
      reason: `Buyer in ${county} County. Needed unless the car was last registered in a Texas county without emissions testing: check the title. ${fuelNote}`,
    };
  }
  return {
    status: "required",
    reason: `Buyer in ${county} County: the test must pass before the sale is filed. It is on record with the state, so there is no paper to upload. ${fuelNote}`,
  };
}
