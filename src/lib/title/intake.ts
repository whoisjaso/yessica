/**
 * The New Sale intake: the shortest list of questions that fills a 130-U,
 * one question a page, in the order she has the paper in front of her.
 *
 * A step is shown only when its answer is not already known: the car page
 * appears only when the VIN decode came back empty, the empty weight only
 * when NHTSA did not have it, the door-sticker GVWR only for a body that
 * files box 12 (`needsCarryingCapacity`). Everything else derives.
 */

import { needsCarryingCapacity } from "@/lib/vehicles/plate-class";
import type { TitleSale } from "@/lib/title/types";

export type StepId =
  | "dealer"
  | "vin"
  | "car"
  | "color"
  | "buyerKind"
  | "buyerName"
  | "address"
  | "id"
  | "contact"
  | "price"
  | "odometer"
  | "brand"
  | "title"
  | "titleFrom"
  | "lien"
  | "lender"
  | "emptyWeight"
  | "gvwr";

export function intakeSteps(sale: TitleSale, decoded: boolean): StepId[] {
  const steps: StepId[] = ["dealer", "vin"];
  if (!decoded || !sale.year || !sale.make || !sale.model || !sale.bodyStyle) steps.push("car");
  steps.push("color", "buyerKind", "buyerName", "address", "id", "contact", "price", "odometer", "brand", "title", "titleFrom", "lien");
  if (sale.lien.holder === "lender") steps.push("lender");
  if (sale.emptyFrom !== "found") steps.push("emptyWeight");
  if (needsCarryingCapacity(sale.bodyStyle)) steps.push("gvwr");
  return steps;
}

/** Splits one typed name into the 130-U's four columns. */
export function splitName(full: string): { first: string; middle: string; last: string; suffix: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  const suffixes = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i;
  let suffix = "";
  if (parts.length > 2 && suffixes.test(parts[parts.length - 1])) suffix = parts.pop()!;
  if (parts.length === 0) return { first: "", middle: "", last: "", suffix };
  if (parts.length === 1) return { first: parts[0], middle: "", last: "", suffix };
  return { first: parts[0], middle: parts.slice(1, -1).join(" "), last: parts[parts.length - 1], suffix };
}
