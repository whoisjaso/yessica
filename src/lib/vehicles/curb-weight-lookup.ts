import "server-only";

import { isValidVin } from "@/lib/vehicles/nhtsa";
import { parseCanadianSpecs, pickCurbWeight, type CurbWeightResult, type VinFacts } from "@/lib/vehicles/curb-weight";

/**
 * Box 11 found, not asked: ask NHTSA, pick with `pickCurbWeight`. Ported
 * from Triple J without the database write-back. Every call is bounded and
 * fails silent; nothing found means the intake asks for the weight.
 */

const VPIC = "https://vpic.nhtsa.dot.gov/api/vehicles";
const TIMEOUT_MS = 6000;

const num = (value: unknown): number | null => {
  const parsed = typeof value === "string" ? parseFloat(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};
const str = (value: unknown): string | null =>
  typeof value === "string" && value.trim() && value !== "Not Applicable" ? value.trim() : null;

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), next: { revalidate: 60 * 60 * 24 * 30 } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function vinFacts(vin: string): Promise<VinFacts | null> {
  if (!isValidVin(vin)) return null;
  const json = await getJson(`${VPIC}/DecodeVinValues/${encodeURIComponent(vin)}?format=json`);
  const r = (json as { Results?: Record<string, unknown>[] } | null)?.Results?.[0];
  if (!r) return null;
  return {
    make: str(r.Make),
    model: str(r.Model),
    year: num(r.ModelYear),
    trim: str(r.Trim),
    series: str(r.Series),
    bodyClass: str(r.BodyClass),
    bodyCabType: str(r.BodyCabType),
    bedLengthIn: num(r.BedLengthIN),
    driveType: str(r.DriveType),
    doors: num(r.Doors),
    displacementL: num(r.DisplacementL),
    transmissionStyle: str(r.TransmissionStyle),
    fuelType: str(r.FuelTypePrimary),
    curbWeightLb: num(r.CurbWeightLB),
    gvwr: str(r.GVWR),
    gvwrTo: str(r.GVWR_to),
  };
}

export async function lookupCurbWeight(
  vin: string | null | undefined,
  known: { year?: number | null; make?: string | null; model?: string | null; trim?: string | null; bodyStyle?: string | null } = {},
): Promise<CurbWeightResult | null> {
  const decoded = vin ? await vinFacts(vin) : null;
  const facts: VinFacts = {
    ...decoded,
    year: decoded?.year ?? known.year ?? null,
    make: decoded?.make ?? known.make ?? null,
    model: decoded?.model ?? known.model ?? null,
    trim: decoded?.trim ?? known.trim ?? null,
    bodyClass: decoded?.bodyClass ?? known.bodyStyle ?? null,
  };
  const direct = pickCurbWeight(facts, []);
  if (direct) return direct;
  if (!facts.year || !facts.make || !facts.model) return null;
  const specsUrl = (model: string) =>
    `${VPIC}/GetCanadianVehicleSpecifications/?Year=${facts.year}&Make=${encodeURIComponent(facts.make!)}&Model=${encodeURIComponent(model)}&units=US&format=json`;
  const picked = pickCurbWeight(facts, parseCanadianSpecs(await getJson(specsUrl(facts.model))));
  if (picked) return picked;
  const first = facts.model.split(/\s+/)[0];
  if (first && first !== facts.model) {
    return pickCurbWeight({ ...facts, model: first }, parseCanadianSpecs(await getJson(specsUrl(first))));
  }
  return null;
}
