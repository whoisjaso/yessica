/**
 * The two records Title Desk keeps: the dealers she files for, and the
 * sales on her list. Everything else (the 130-U, the webDEALER copy list,
 * what to bring, the clock) is worked out from these, never stored twice.
 */

export type Dealer = {
  id: string;
  /** The GDN, TxDMV's "P number": P12345. */
  gdn: string;
  /** The legal name the licence is under. Prints on the 130-U seller line. */
  name: string;
  /** Doing-business-as, when the lot goes by another name. */
  dba: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  /**
   * The person at the dealership who sells and signs, printed after the
   * dealership on the 130-U seller line: "Dealer LLC (First Last)".
   * webDEALER review returns a 130-U without it. Asked once per dealer.
   */
  agentName: string;
  createdAt: string;
  /** Last time a sale was started for this dealer: orders "My dealers". */
  lastUsedAt: string;
};

export type OdometerBrand = "actual" | "exceeds" | "not_actual";
export type TitleKindValue = "clean" | "rebuilt" | "bonded" | "salvage";
export type LienHolder = "none" | "dealer" | "lender";
export type IdType = "license" | "idCard" | "passport" | "military";

export type Buyer = {
  /** A company buying, not a person: the name prints as one line. */
  isBusiness: boolean;
  first: string;
  middle: string;
  last: string;
  suffix: string;
  entityName: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  idType: IdType;
  idNumber: string;
  /** Two letters: the state that issued the licence or ID. */
  idState: string;
  email: string;
  phone: string;
};

export type TitleSale = {
  id: string;
  dealerId: string;
  createdAt: string;
  /** ISO date of sale. The 30-day clock counts from here. */
  saleDate: string;

  vin: string;
  year: string;
  make: string;
  model: string;
  bodyStyle: string;
  /** One of webDEALER's sixteen major colors. */
  color: string;
  /** Pounds as typed or found; box 11 rounds it up. */
  emptyWeight: string;
  emptyFrom: "found" | "typed" | "";
  /** Off the door sticker, only when box 12 is needed. */
  gvwr: string;
  /** vPIC's weight class, kept as the hint beside the GVWR question. */
  gvwrBand: string;

  buyer: Buyer;

  price: number | null;
  odometer: number | null;
  odometerBrand: OdometerBrand;

  titleKind: TitleKindValue;
  /** Two letters when the title is from another state; empty for Texas. */
  titleState: string;

  lien: { holder: LienHolder; name: string };
  plate: string;

  /** The webDEALER receipt or transaction number. Set means filed. */
  filedNumber: string;
  filedAt: string;
  filedBy: string;
};

export function emptyBuyer(): Buyer {
  return {
    isBusiness: false,
    first: "",
    middle: "",
    last: "",
    suffix: "",
    entityName: "",
    street: "",
    city: "",
    state: "TX",
    zip: "",
    county: "",
    idType: "license",
    idNumber: "",
    idState: "TX",
    email: "",
    phone: "",
  };
}

export function emptySale(id: string, dealerId: string, today: string): TitleSale {
  return {
    id,
    dealerId,
    createdAt: new Date().toISOString(),
    saleDate: today,
    vin: "",
    year: "",
    make: "",
    model: "",
    bodyStyle: "",
    color: "",
    emptyWeight: "",
    emptyFrom: "",
    gvwr: "",
    gvwrBand: "",
    buyer: emptyBuyer(),
    price: null,
    odometer: null,
    odometerBrand: "actual",
    titleKind: "clean",
    titleState: "",
    lien: { holder: "none", name: "" },
    plate: "",
    filedNumber: "",
    filedAt: "",
    filedBy: "",
  };
}

export function buyerName(buyer: Buyer): string {
  if (buyer.isBusiness && buyer.entityName.trim()) return buyer.entityName.trim();
  return [buyer.first, buyer.middle, buyer.last, buyer.suffix].map((p) => p.trim()).filter(Boolean).join(" ");
}

export function carName(sale: Pick<TitleSale, "year" | "make" | "model">): string {
  return [sale.year, sale.make, sale.model].map((p) => `${p ?? ""}`.trim()).filter(Boolean).join(" ");
}
