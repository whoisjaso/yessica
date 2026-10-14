import { emptySale, type Dealer, type TitleSale } from "@/lib/title/types";

/** Invented data only. No real dealer, buyer or GDN. */
export const DEALER: Dealer = {
  id: "d1",
  gdn: "P00001",
  name: "Example Motors LLC",
  dba: "",
  street: "100 Sample St",
  city: "Houston",
  state: "TX",
  zip: "77001",
  county: "Harris",
  agentName: "Pat Example",
  createdAt: "2026-10-01T00:00:00Z",
  lastUsedAt: "2026-10-01T00:00:00Z",
};

export function readySale(over: Partial<TitleSale> = {}): TitleSale {
  const base = emptySale("s1", DEALER.id, "2026-10-01");
  return {
    ...base,
    vin: "1HGCM82633A004352",
    year: "2003",
    make: "Honda",
    model: "Accord",
    bodyStyle: "Sedan",
    color: "SILVER",
    emptyWeight: "3197",
    emptyFrom: "found",
    price: 6500,
    odometer: 154321,
    buyer: {
      ...base.buyer,
      first: "Alex",
      middle: "Q",
      last: "Sample",
      street: "1 Test Ln",
      city: "Pasadena",
      zip: "77505",
      county: "Harris",
      idNumber: "00000000",
    },
    ...over,
  };
}
