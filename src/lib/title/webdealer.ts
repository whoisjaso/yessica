/**
 * The webDEALER copy list, in webDEALER's own page order.
 *
 * Since 1 July 2025 every licensed Texas dealer files title and
 * registration electronically through TxDMV webDEALER (HB 718). She files
 * under each dealer's account with her own webDEALER user. Title Desk never
 * logs in, never stores a webDEALER password, and never automates the site:
 * writing into webDEALER directly needs TxDMV's approved-vendor "Web Service
 * Access" arrangement. So this gathers everything webDEALER asks for, page
 * by page, one tap from the clipboard. Nothing is invented: a value the
 * sale does not hold shows as missing.
 *
 * Page order from TxDMV's webDEALER Dealer User Guide (sections 4.1.3 to
 * 6.5): the plate is assigned in ePLATE first, then the title application
 * walks Seller Disclosure, Vehicle, Lienholder, Owner, Plates and Sticker,
 * Sales Tax and the document upload. Ported from Triple J's handoff, with
 * the dealer and the sale as plain inputs.
 */

import { suggestPlateClass } from "@/lib/vehicles/plate-class";
import { weightsReady } from "@/lib/vehicles/weight-boxes";
import { saleEmissions, saleWeights } from "@/lib/title/facts";
import { usDate } from "@/lib/title/clock";
import { buyerName, carName, type Dealer, type TitleSale } from "@/lib/title/types";

export type HandoffPage =
  | "plateVehicle"
  | "plateOwner"
  | "start"
  | "sellerDisclosure"
  | "vehicle"
  | "lienholder"
  | "owner"
  | "plates"
  | "salesTax"
  | "documents"
  | "inspection";

/** webDEALER's pages, in the order the application walks them. Titles are webDEALER's. */
export const HANDOFF_PAGES: { page: HandoffPage; title: string; es: string }[] = [
  { page: "plateVehicle", title: "License Plate Assignment: Confirm Vehicle", es: "Asignar Placa: Confirmar Vehículo" },
  { page: "plateOwner", title: "License Plate Assignment: Owner Information", es: "Asignar Placa: Dueño" },
  { page: "start", title: "Start A New Title Application", es: "Empezar Solicitud De Título" },
  { page: "sellerDisclosure", title: "Seller Disclosure", es: "Declaración Del Vendedor" },
  { page: "vehicle", title: "Vehicle Information", es: "Información Del Vehículo" },
  { page: "lienholder", title: "Lienholder Information", es: "Gravamen" },
  { page: "owner", title: "Owner Information", es: "Información Del Dueño" },
  { page: "plates", title: "Plate And Sticker Information", es: "Placa Y Calcomanía" },
  { page: "salesTax", title: "Sales And Use Tax", es: "Impuesto De Venta" },
  { page: "documents", title: "Evidence Of Ownership And Documents", es: "Documentos" },
  { page: "inspection", title: "Inspection", es: "Inspección" },
];

export type HandoffField = {
  page: HandoffPage;
  key: string;
  /** webDEALER's own box label; English, because the paste target is. */
  label: string;
  value: string | null;
  optional?: boolean;
  /** One line for a value to confirm rather than copy. */
  hint?: string;
  /** Box 11 or 12 while the weight gate is shut. */
  holds?: boolean;
};

const ODOMETER_BRAND = {
  actual: "Actual Mileage",
  exceeds: "Exceeds Mechanical Limits",
  not_actual: "Not Actual Mileage",
} as const;

const ID_TYPE = {
  license: "Driver License",
  idCard: "ID Card",
  passport: "Passport",
  military: "Military ID",
} as const;

const clean = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t ? t : null;
};

function price(value: number | null): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

/** The two ZIP boxes. The four-digit extension is never invented. */
export function splitZip(value: string | null | undefined): { zip: string | null; plus4: string | null } {
  const match = clean(value)?.match(/^(\d{5})(?:[-\s]?(\d{4}))?$/);
  return { zip: match?.[1] ?? null, plus4: match?.[2] ?? null };
}

export function buildHandoff(sale: TitleSale, dealer: Dealer | null): HandoffField[] {
  const b = sale.buyer;
  const weights = saleWeights(sale);
  const hold = weightsReady(weights) ? {} : { holds: true };
  const empty = weights.emptyWeight === null ? null : String(weights.emptyWeight);
  const capacity = weights.capacity === null ? null : String(weights.capacity);
  const plateClass = suggestPlateClass({ bodyStyle: sale.bodyStyle, capacityLbs: weights.capacity });
  const zip = splitZip(b.zip);
  const name = clean(buyerName(b));
  const ymm = clean(carName(sale));
  const vin = clean(sale.vin)?.toUpperCase() ?? null;
  const color = clean(sale.color)?.toUpperCase() ?? null;
  const lien =
    sale.lien.holder === "dealer"
      ? clean(dealer?.name) ?? null
      : sale.lien.holder === "lender"
        ? clean(sale.lien.name)
        : "No Lien";

  const weightRows = (page: HandoffPage): HandoffField[] => [
    { page, key: "emptyWeight", label: "Empty Weight (lbs)", value: empty, ...hold },
    ...(weights.needsCapacity ? [{ page, key: "carryingCapacity", label: "Carrying Capacity (lbs)", value: capacity, ...hold }] : []),
  ];

  const ownerRows = (page: HandoffPage): HandoffField[] => [
    { page, key: "buyerName", label: "Name 1", value: name },
    { page, key: "buyerStreet", label: "Address", value: clean(b.street) },
    { page, key: "buyerCity", label: "City", value: clean(b.city) },
    { page, key: "buyerState", label: "State", value: clean(b.state)?.toUpperCase() ?? null },
    { page, key: "buyerZip", label: "ZIP", value: zip.zip },
    { page, key: "buyerZipPlus4", label: "ZIP +4", value: zip.plus4, optional: true },
  ];

  return [
    { page: "plateVehicle", key: "vin", label: "VIN", value: vin },
    { page: "plateVehicle", key: "yearMakeModel", label: "Year, make and model (check)", value: ymm },
    { page: "plateVehicle", key: "model", label: "Model", value: clean(sale.model)?.toUpperCase() ?? null },
    { page: "plateVehicle", key: "bodyStyle", label: "Body Style (check)", value: clean(sale.bodyStyle), optional: true },
    { page: "plateVehicle", key: "majorColor", label: "Major Color", value: color },
    {
      page: "plateVehicle",
      key: "vehicleClass",
      label: "Vehicle Class",
      value: plateClass.value,
      ...(["car", "passengerTruck", "bus", "nev"].includes(plateClass.why) ? {} : { hint: plateClass.reason }),
    },
    ...weightRows("plateVehicle"),
    { page: "plateVehicle", key: "leased", label: "Is This A Leased Vehicle?", value: "No" },

    ...ownerRows("plateOwner"),
    { page: "plateOwner", key: "buyerEmail", label: "Email", value: clean(b.email), optional: true },
    { page: "plateOwner", key: "buyerPhone", label: "Phone", value: clean(b.phone), optional: true },

    { page: "start", key: "vin", label: "VIN", value: vin },

    { page: "sellerDisclosure", key: "buyerIdType", label: "ID Type", value: ID_TYPE[b.idType] },
    { page: "sellerDisclosure", key: "buyerIdNumber", label: "ID #", value: clean(b.idNumber) },
    { page: "sellerDisclosure", key: "salesPrice", label: "Sales Price (after Rebate)", value: price(sale.price) },
    {
      page: "sellerDisclosure",
      key: "odometerReading",
      label: "Odometer Reading",
      value: sale.odometer !== null && sale.odometer >= 0 ? String(Math.round(sale.odometer)) : null,
    },
    { page: "sellerDisclosure", key: "odometerBrand", label: "Odometer Brand", value: ODOMETER_BRAND[sale.odometerBrand] },

    { page: "vehicle", key: "yearMakeModel", label: "Year, make and model (check)", value: ymm },
    { page: "vehicle", key: "majorColor", label: "Major Color", value: color },
    ...weightRows("vehicle"),

    { page: "lienholder", key: "lienholder", label: "Type of Sale / Lienholder", value: lien },

    { page: "owner", key: "ownerType", label: "Owner Type", value: b.isBusiness ? "BUSINESS" : "INDIVIDUAL" },
    ...ownerRows("owner"),
    { page: "owner", key: "buyerCounty", label: "Resident County", value: clean(b.county) },

    { page: "plates", key: "plateNumber", label: "Plate Number (from ePLATE)", value: clean(sale.plate), optional: true },

    { page: "salesTax", key: "salesTaxCategory", label: "Sales Tax Category", value: "SALES/USE" },
    { page: "salesTax", key: "salesTaxDate", label: "Sales Tax Date", value: sale.saleDate ? usDate(sale.saleDate) : null },

    {
      page: "documents",
      key: "vinCertify",
      label: "VIN certification",
      value: "Self-certified on the 130-U. Read it off the car, not the paperwork.",
    },
    { page: "inspection", key: "emissions", label: "Emissions test", value: saleEmissions(sale).reason },
  ];
}

function line(field: HandoffField): string {
  return `${field.label}: ${field.value ?? (field.optional ? "(not supplied)" : "(missing)")}`;
}

/** One webDEALER page as a block of text, for Copy page. */
export function pageText(fields: HandoffField[], page: HandoffPage): string {
  return fields.filter((f) => f.page === page).map(line).join("\n");
}

/** The whole list, headed by page, in webDEALER's order. */
export function allText(fields: HandoffField[]): string {
  return HANDOFF_PAGES.map(({ page, title }, index) => {
    const rows = fields.filter((f) => f.page === page);
    return rows.length ? [`${index + 1}. ${title.toUpperCase()}`, ...rows.map(line)].join("\n") : null;
  })
    .filter(Boolean)
    .join("\n\n");
}

export function missingFields(fields: HandoffField[]): HandoffField[] {
  return fields.filter((f) => f.value === null && !f.optional);
}
