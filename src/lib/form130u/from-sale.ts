/**
 * A sale on her list, as the 130-U reads it. Every box comes from the sale
 * or the dealer; boxes 11 and 12 come from the one weight rule.
 */

import type { AgreementData } from "@/lib/form130u/field-mapping";
import { saleWeights } from "@/lib/title/facts";
import type { Dealer, TitleSale } from "@/lib/title/types";
import { signerFor } from "@/lib/title/agent";

const BRAND: Record<TitleSale["odometerBrand"], AgreementData["odometer_brand"]> = {
  actual: "A",
  not_actual: "N",
  exceeds: "X",
};

export function agreementFromSale(sale: TitleSale, dealer: Dealer): AgreementData {
  const b = sale.buyer;
  const weights = saleWeights(sale);
  const lien = sale.lien.holder;
  return {
    dealer: {
      name: dealer.name,
      street: dealer.street,
      city: dealer.city,
      state: dealer.state || "TX",
      zip: dealer.zip,
      gdn: dealer.gdn,
      agentName: signerFor(dealer),
    },
    vin: sale.vin.trim().toUpperCase(),
    year: sale.year,
    make: sale.make,
    model: sale.model,
    body_style: sale.bodyStyle,
    major_color: sale.color,
    odometer: sale.odometer === null ? "" : String(Math.round(sale.odometer)),
    odometer_brand: BRAND[sale.odometerBrand],
    empty_weight: weights.emptyWeight === null ? undefined : String(weights.emptyWeight),
    carrying_capacity: weights.needsCapacity && weights.capacity !== null ? String(weights.capacity) : undefined,
    tx_plate_no: sale.plate || undefined,

    buyer_first_name: b.isBusiness ? "" : b.first,
    buyer_middle_name: b.isBusiness ? undefined : b.middle || undefined,
    buyer_last_name: b.isBusiness ? "" : b.last,
    buyer_suffix: b.isBusiness ? undefined : b.suffix || undefined,
    buyer_entity_name: b.isBusiness ? b.entityName : undefined,
    buyer_address: b.street,
    buyer_city: b.city,
    buyer_state: b.state,
    buyer_zip: b.zip,
    buyer_county: b.county,
    buyer_phone: b.phone || undefined,
    buyer_email: b.email || undefined,
    buyer_dl_number: b.idNumber || undefined,
    buyer_dl_state: b.idState || undefined,
    buyer_id_kind: b.idType,

    sale_price: sale.price ?? 0,
    sale_date: sale.saleDate,
    applying_for: "title_and_registration",
    applicant_type: b.isBusiness ? "business" : "individual",

    has_lien: lien !== "none",
    lien_date: lien !== "none" ? sale.saleDate : undefined,
    // The dealer's own lien prints the dealer's address; a lender's address
    // is left for webDEALER, where the lender record lives.
    lienholder_name: lien === "lender" ? sale.lien.name : lien === "dealer" ? dealer.name : undefined,
  };
}
