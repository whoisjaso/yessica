/**
 * Boxes 11 and 12 of the 130-U, said once.
 *
 * The one place that decides what the empty weight and the carrying
 * capacity are on a sale, where each came from, and whether the 130-U may
 * file. The corridor (which question exists), the review (what it reads
 * back), the filing action (the gate), the preview, the webDEALER handoff
 * and the heavy-vehicle rules all read this, so none of them keeps its own
 * copy of the same two numbers.
 *
 * The rules, each from its source:
 *
 *   Box 11  "Weight (in pounds) of the vehicle without a load, rounded up
 *           to the next 100 pounds." (Form 130-U, Detailed Instructions,
 *           box 11.) Found from NHTSA (`vehicles/curb-weight.ts`) and kept on
 *           the vehicle; typed only when nothing was found. Every vehicle
 *           files one.
 *   Box 12  "Weight (in pounds) determined by the heaviest load the vehicle
 *           is legally allowed to carry according to the vehicle
 *           manufacturer." (Same instructions, box 12.) TxDMV's Vehicle
 *           Weight Verification Guidelines: "Carrying Capacity = Gross
 *           Vehicle Weight Rating (GVWR) - Computed Empty Weight". So it is
 *           worked out, never typed: the desk gives the GVWR at most, and
 *           the subtraction is ours. The computed empty weight is box 11 as
 *           filed, so the two boxes add up to the GVWR exactly.
 *           Who needs it: every vehicle webDEALER classes as a
 *           Passenger-Truck or a Truck, and every trailer, whose fee is set
 *           by gross weight (Transp. Code §§502.252-502.254; "gross vehicle weight"
 *           is the vehicle and its load, §541.401). A car, a motorcycle
 *           (a flat $30, §502.251) or a bus is never asked
 *           (`vehicles/plate-class.ts`).
 *
 * Unknown stays unknown. A GVWR at or below the empty weight is bad data,
 * not a capacity of zero: it is refused and the jamb figure is asked for.
 */

import { needsCarryingCapacity, parsePounds } from "@/lib/vehicles/plate-class";

/** Box 11, as the instructions want it: up to the next 100 pounds. */
export function boxElevenPounds(pounds: number): number {
  return Math.ceil(Math.round(pounds) / 100) * 100;
}

export type WeightInput = {
  bodyStyle: string | null | undefined;
  /** `vehicles.weight_lbs`: found by the NHTSA lookup, or typed on the car. */
  vehicleWeight: number | null | undefined;
  /** The 130-U's saved answers on this sale (`readPaperwork(…, "form130U")`). */
  answers: Record<string, string | undefined> | null | undefined;
};

/** What the desk still has to give: the two numbers nobody could find. */
export type WeightBlank = "emptyWeight" | "gvwr";

export type WeightBoxes = {
  /** Whether box 12 applies to this vehicle at all. */
  needsCapacity: boolean;
  /** The weight as found or typed, unrounded (the Buyers Guide's curb test reads this). */
  emptyActual: number | null;
  /** Box 11 as filed: rounded up to the next 100. */
  emptyWeight: number | null;
  emptyFrom: "typed" | "found" | null;
  /** The vehicle's GVWR, when one is known exactly. */
  gvwr: number | null;
  gvwrFrom: "typed" | "record" | null;
  /** Box 12 as filed. Null when the vehicle does not need one, or it cannot be worked out. */
  capacity: number | null;
  /** "derived": GVWR minus box 11. "legacy": typed on a sale from before this rule. */
  capacityFrom: "derived" | "legacy" | null;
  /** Boxes 11 and 12 added: the gross weight the fee and the heavy rules read. */
  grossWeight: number | null;
  /** The blanks the desk must fill before the 130-U can file. Empty: it may file. */
  missing: WeightBlank[];
  /** Set when the GVWR on hand is not above the empty weight. */
  problem: "gvwrNotAboveEmpty" | null;
};

export function weightBoxes(input: WeightInput): WeightBoxes {
  const answers = input.answers ?? {};
  const needsCapacity = needsCarryingCapacity(input.bodyStyle);

  const typedEmpty = parsePounds(answers.emptyWeight);
  const foundEmpty = parsePounds(
    typeof input.vehicleWeight === "number" && Number.isFinite(input.vehicleWeight)
      ? Math.round(input.vehicleWeight)
      : null,
  );
  // A typed answer that is not a weight is not hidden behind the found one:
  // the box is missing, and the page asks it again.
  const typedInvalid = (answers.emptyWeight ?? "").trim() !== "" && typedEmpty === null;
  const emptyActual = typedInvalid ? null : typedEmpty ?? foundEmpty;
  const emptyWeight = emptyActual === null ? null : boxElevenPounds(emptyActual);
  // A found weight the sale pinned when its 130-U filed reads as found still.
  const emptyFrom =
    emptyActual === null ? null : typedEmpty !== null ? (answers._emptyFrom === "found" ? "found" : "typed") : foundEmpty !== null ? "found" : null;

  const gvwr = parsePounds(answers.gvwr);
  const gvwrFrom = gvwr === null ? null : answers._gvwrFrom === "record" ? "record" : "typed";
  const legacy = gvwr === null ? parsePounds(answers.carryingCapacity) : null;

  let capacity: number | null = null;
  let capacityFrom: WeightBoxes["capacityFrom"] = null;
  let problem: WeightBoxes["problem"] = null;
  if (needsCapacity) {
    if (gvwr !== null && emptyWeight !== null) {
      if (gvwr > emptyWeight) {
        capacity = gvwr - emptyWeight;
        capacityFrom = "derived";
      } else {
        problem = "gvwrNotAboveEmpty";
      }
    } else if (legacy !== null) {
      capacity = legacy;
      capacityFrom = "legacy";
    }
  }

  const missing: WeightBlank[] = [];
  if (emptyWeight === null) missing.push("emptyWeight");
  if (needsCapacity && capacity === null) missing.push("gvwr");

  const grossWeight =
    capacity !== null && emptyWeight !== null
      ? capacityFrom === "derived" && gvwr !== null
        ? gvwr
        : emptyWeight + capacity
      : null;

  return {
    needsCapacity,
    emptyActual,
    emptyWeight,
    emptyFrom,
    gvwr,
    gvwrFrom,
    capacity,
    capacityFrom,
    grossWeight,
    missing,
    problem,
  };
}

/**
 * The gate: whether the 130-U may be filed, signed or handed to webDEALER.
 * A derived figure counts as filled; a blank never does, and there is no
 * Not Applicable for a vehicle that needs the box.
 */
export function weightsReady(boxes: WeightBoxes): boolean {
  return boxes.missing.length === 0;
}

/**
 * Box 11 and box 12 as the 130-U files them, as strings, for the filed
 * answers. Box 12 is present only on a vehicle that needs it.
 */
export function weightAnswers(boxes: WeightBoxes): { emptyWeight?: string; carryingCapacity?: string } {
  return {
    ...(boxes.emptyWeight !== null ? { emptyWeight: String(boxes.emptyWeight) } : {}),
    ...(boxes.needsCapacity && boxes.capacity !== null ? { carryingCapacity: String(boxes.capacity) } : {}),
  };
}

/**
 * Whether a GVWR the desk is about to save can stand: a number of pounds,
 * above box 11 as it will file. Returns the reason it cannot, or null.
 */
export function gvwrRefusal(
  gvwrRaw: string | null | undefined,
  emptyWeight: number | null,
): "notPounds" | "gvwrNotAboveEmpty" | null {
  const gvwr = parsePounds(gvwrRaw);
  if (gvwr === null) return "notPounds";
  if (emptyWeight !== null && gvwr <= emptyWeight) return "gvwrNotAboveEmpty";
  return null;
}
