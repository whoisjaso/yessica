/**
 * What a sale on her list adds up to: its weights, whether it can be filed
 * yet, and what goes with it. One function owns each answer; the screens,
 * the 130-U and the webDEALER list all read these.
 */

import { weightBoxes, weightsReady, type WeightBoxes } from "@/lib/vehicles/weight-boxes";
import { emissionsVerdict, type EmissionsVerdict } from "@/lib/vehicles/emissions";
import type { TitleSale } from "@/lib/title/types";

/** Boxes 11 and 12, through the one rule the 130-U files by. */
export function saleWeights(sale: TitleSale): WeightBoxes {
  return weightBoxes({
    bodyStyle: sale.bodyStyle,
    vehicleWeight: null,
    answers: { emptyWeight: sale.emptyWeight, gvwr: sale.gvwr },
  });
}

/** 26 U.S.C. §4481; 43 TAC §217.31: proof of the heavy vehicle use tax from 55,000 lb. */
export const HVUT_FROM_LBS = 55000;

export type Waiting = "weightsFirst" | "buyerDetails" | "carDetails" | "titleFirst";

export type SaleState =
  | { word: "filed" }
  | { word: "ready" }
  | { word: "waiting"; reason: Waiting };

/** The blanks a filing cannot go without, by group. */
export function missingBuyer(sale: TitleSale): boolean {
  const b = sale.buyer;
  const named = b.isBusiness ? !!b.entityName.trim() : !!(b.first.trim() && b.last.trim());
  return !(named && b.street.trim() && b.city.trim() && b.state.trim() && b.zip.trim() && b.county.trim() && b.idNumber.trim());
}

export function missingCar(sale: TitleSale): boolean {
  return !(sale.vin.trim().length === 17 && sale.year && sale.make && sale.model && sale.color && sale.price && sale.odometer !== null);
}

/**
 * The one copper word on her tile. A salvage title cannot be registered
 * for the road until it is rebuilt (Transp. Code §501.091 ff.), so it
 * waits on the title, not on her.
 */
export function saleState(sale: TitleSale): SaleState {
  if (sale.filedNumber.trim()) return { word: "filed" };
  if (sale.titleKind === "salvage") return { word: "waiting", reason: "titleFirst" };
  if (missingCar(sale)) return { word: "waiting", reason: "carDetails" };
  if (missingBuyer(sale)) return { word: "waiting", reason: "buyerDetails" };
  if (!weightsReady(saleWeights(sale))) return { word: "waiting", reason: "weightsFirst" };
  return { word: "ready" };
}

export function saleEmissions(sale: TitleSale): EmissionsVerdict {
  return emissionsVerdict({
    buyerCounty: sale.buyer.county,
    buyerState: sale.buyer.state,
    titleState: sale.titleState || null,
    year: Number(sale.year) || null,
    mileage: sale.odometer,
    onDate: sale.saleDate,
  });
}

export type BringItem = { key: string; en: string; es: string };

/**
 * What goes up with the application, in the order webDEALER's county
 * reviewers expect (webDEALER Dealer User Guide, Appendix 5; release 26.3
 * keeps the upload order): the 130-U first, then the title, then the
 * rest, the emissions report always last.
 */
export function bringList(sale: TitleSale): BringItem[] {
  const outOfState = !!sale.titleState;
  const items: BringItem[] = [
    {
      key: "form130u",
      en: "130-U, signed by the dealer and the buyer",
      es: "130-U, firmado por el dealer y el comprador",
    },
    outOfState
      ? { key: "title", en: `Out-of-state title (${sale.titleState}), front and back, signed over`, es: `Título de otro estado (${sale.titleState}), frente y reverso, cedido` }
      : { key: "title", en: "Title, front and back, signed over to the buyer", es: "Título, frente y reverso, cedido al comprador" },
  ];
  if (sale.lien.holder !== "none") {
    items.push({
      key: "lien",
      en: `Lien goes on the title: ${sale.lien.holder === "dealer" ? "the dealer" : sale.lien.name || "the lender"}`,
      es: `El gravamen va en el título: ${sale.lien.holder === "dealer" ? "el dealer" : sale.lien.name || "el prestamista"}`,
    });
  }
  items.push({
    key: "release",
    en: "Release of lien, if the old title shows one",
    es: "Liberación de gravamen, si el título anterior tiene uno",
  });
  const weights = saleWeights(sale);
  if (weights.grossWeight !== null && weights.grossWeight >= HVUT_FROM_LBS) {
    items.push({
      key: "hvut",
      en: "Form 2290 proof (heavy truck tax)",
      es: "Comprobante Forma 2290 (impuesto de camión pesado)",
    });
  }
  if (outOfState && saleEmissions(sale).status !== "notRequired") {
    items.push({
      key: "emissions",
      en: "Emissions test report (last)",
      es: "Reporte de emisiones (al final)",
    });
  }
  return items;
}
