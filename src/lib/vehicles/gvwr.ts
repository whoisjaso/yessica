/**
 * Box 12 of the 130-U, the carrying capacity, found rather than typed.
 *
 * The owner, 13 October 2026: "I would prefer if the carrying capacity
 * could be calculated automatically when we get to the 130u section, same
 * way as the empty weight is." TxDMV's Vehicle Weight Verification
 * Guidelines say how: "Carrying Capacity = Gross Vehicle Weight Rating
 * (GVWR) - Computed Empty Weight", the GVWR being on the door jamb. So the
 * capacity is a subtraction, and the only fact it needs that box 11 does
 * not already have is this vehicle's GVWR.
 *
 * Where an exact GVWR can come from, checked 13 October 2026:
 *
 *   vPIC DecodeVinValues   `GVWR` and `GVWR_to` are a weight CLASS, never a
 *                          figure. vPIC's own value list for variable 25
 *                          (GetVehicleVariableValuesList/25) is seventeen
 *                          bands, "Class 1: 6,000 lb or less" to "Class 8:
 *                          33,001 lb and above", the narrowest 1,000 lb wide
 *                          ("Class 2E: 6,001 - 7,000 lb"). `GVWR_to` is the
 *                          top of the range when a VIN pattern spans classes.
 *   NHTSA Canadian Vehicle the specs carry dimensions and curb weight (CW)
 *   Specifications         and no GVWR (fields MYR, OL, OW, OH, WB, CW, A-G,
 *                          TWF, TWR, WD).
 *   The vehicle's record   no GVWR column on the vehicle; a 130-U filed for
 *                          this VIN before records boxes 11 and 12, whose sum
 *                          is the GVWR by the same TxDMV formula, and, from
 *                          this change on, the GVWR itself.
 *   The door jamb          the Federal certification label (49 CFR 567.4)
 *                          states the GVWR for every vehicle and trailer.
 *
 * So an exact GVWR is found only from this vehicle's own earlier filing; a
 * class band is not a number, and the subtraction is never done from one
 * (a 1,000 lb band is a 1,000 lb wrong box 12). With only a band, the desk
 * reads the one figure off the jamb and the band is shown as the hint.
 *
 * Pure: the network lives in `curb-weight-lookup.ts`.
 */

export type GvwrBand = {
  /** As vPIC names it: "Class 2E", or "Class 2E-2F" across two classes. */
  label: string;
  /** Lowest GVWR in the band, in pounds; null for "or less". */
  fromLb: number | null;
  /** Highest GVWR in the band, in pounds; null for "and above". */
  toLb: number | null;
};

export type GvwrSource = "typed" | "record";

export type GvwrFound =
  | { kind: "exact"; pounds: number; source: GvwrSource; basis: string }
  | { kind: "band"; band: GvwrBand }
  | { kind: "none" };

const pounds = (text: string): number | null => {
  const value = Number(text.replace(/,/g, ""));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
};

/**
 * One vPIC GVWR value, read as a band.
 *
 *   "Class 2E: 6,001 - 7,000 lb (2,722 - 3,175 kg)"  6001 to 7000
 *   "Class 1: 6,000 lb or less (2,722 kg or less)"     up to 6000
 *   "Class 8: 33,001 lb and above (14,969 kg and above)" 33001 up
 *
 * Anything else (empty, "Not Applicable", a value vPIC adds later in a
 * shape not seen here) is null: an unread band is no band, never a guess.
 */
export function parseGvwrBand(raw: string | null | undefined): GvwrBand | null {
  const text = (raw ?? "").trim();
  const label = /^(Class\s+\d[A-Z]?)\s*:/i.exec(text)?.[1]?.replace(/\s+/g, " ");
  if (!label) return null;
  const range = /:\s*([\d,]+)\s*-\s*([\d,]+)\s*lb/i.exec(text);
  if (range) {
    const fromLb = pounds(range[1]);
    const toLb = pounds(range[2]);
    return fromLb && toLb && toLb >= fromLb ? { label, fromLb, toLb } : null;
  }
  const below = /:\s*([\d,]+)\s*lb\s+or\s+less/i.exec(text);
  if (below) {
    const toLb = pounds(below[1]);
    return toLb ? { label, fromLb: null, toLb } : null;
  }
  const above = /:\s*([\d,]+)\s*lb\s+and\s+above/i.exec(text);
  if (above) {
    const fromLb = pounds(above[1]);
    return fromLb ? { label, fromLb, toLb: null } : null;
  }
  return null;
}

/**
 * The band a VIN decode states: `GVWR`, widened to `GVWR_to` when the
 * pattern spans classes ("Class 2E" to "Class 2F" is 6,001 to 8,000 lb).
 */
export function gvwrBandFromDecode(
  gvwr: string | null | undefined,
  gvwrTo: string | null | undefined,
): GvwrBand | null {
  const low = parseGvwrBand(gvwr);
  const high = parseGvwrBand(gvwrTo);
  if (!low) return high;
  if (!high || high.label === low.label) return low;
  const fromLb = low.fromLb === null || high.fromLb === null ? null : Math.min(low.fromLb, high.fromLb);
  const toLb = low.toLb === null || high.toLb === null ? null : Math.max(low.toLb, high.toLb);
  const tail = high.label.replace(/^Class\s+/i, "");
  return { label: `${low.label}-${tail}`, fromLb, toLb };
}

/** "6,001-7,000", "≤ 6,000", "33,001+": the band, as the hint shows it. */
export function bandText(band: GvwrBand): string {
  const n = (value: number) => value.toLocaleString("en-US");
  if (band.fromLb !== null && band.toLb !== null) return `${n(band.fromLb)}-${n(band.toLb)}`;
  if (band.toLb !== null) return `≤ ${n(band.toLb)}`;
  if (band.fromLb !== null) return `${n(band.fromLb)}+`;
  return "";
}

/**
 * A GVWR read off an earlier 130-U for the same VIN: its own `gvwr` when it
 * recorded one, else boxes 11 and 12 added (TxDMV: capacity = GVWR - empty
 * weight, so the two boxes sum to the GVWR the desk subtracted from). A
 * filing missing either box gives nothing.
 */
export function gvwrFromFiled(formData: Record<string, unknown> | null | undefined): number | null {
  if (!formData) return null;
  const read = (raw: unknown): number | null => {
    const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.replace(/,/g, "").replace(/lbs?\.?/i, "").trim() : "";
    return /^\d+$/.test(text) ? pounds(text) : null;
  };
  const own = read(formData.gvwr);
  if (own) return own;
  const empty = read(formData.emptyWeight);
  const capacity = read(formData.carryingCapacity);
  return empty && capacity ? empty + capacity : null;
}

/**
 * The GVWR this vehicle files with, best source first: what the desk read
 * off the jamb on this sale, then this VIN's own earlier filing. A band is
 * reported as a band, for the hint, and is never turned into a figure.
 */
export function pickGvwr(input: {
  typed?: number | null;
  record?: { pounds: number; basis: string } | null;
  band?: GvwrBand | null;
}): GvwrFound {
  if (input.typed && input.typed > 0) {
    return { kind: "exact", pounds: Math.round(input.typed), source: "typed", basis: "Door jamb" };
  }
  if (input.record && input.record.pounds > 0) {
    return { kind: "exact", pounds: Math.round(input.record.pounds), source: "record", basis: input.record.basis };
  }
  if (input.band) return { kind: "band", band: input.band };
  return { kind: "none" };
}
