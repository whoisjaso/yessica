"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDesk } from "@/components/desk";
import { DealerSearch, titleCase } from "@/components/dealer-search";
import { newId } from "@/lib/store/store";
import { texasToday } from "@/lib/title/clock";
import { intakeSteps, type StepId } from "@/lib/title/intake";
import { carName, emptySale, type Dealer, type IdType, type TitleSale } from "@/lib/title/types";
import { PLATE_COLORS } from "@/lib/vehicles/plate-class";
import { TEXAS_COUNTIES, canonicalCounty } from "@/lib/vehicles/texas-counties";
import { gvwrRefusal } from "@/lib/vehicles/weight-boxes";
import { saleWeights } from "@/lib/title/facts";

export default function NewSalePage() {
  return (
    <Suspense>
      <Intake />
    </Suspense>
  );
}

function Intake() {
  const { t, dealers, sales, saveDealer, saveSale, ready } = useDesk();
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("sale");
  const jumpTo = params.get("step") as StepId | null;

  const [sale, setSale] = useState<TitleSale | null>(null);
  const [decoded, setDecoded] = useState(false);
  const [at, setAt] = useState<StepId>("dealer");

  // Start: an existing sale to change, or a fresh one (with a dealer picked already).
  useEffect(() => {
    if (!ready || sale) return;
    const existing = editId ? sales.find((s) => s.id === editId) : null;
    if (existing) {
      setSale(existing);
      setDecoded(!!(existing.year && existing.make && existing.model && existing.bodyStyle));
      setAt(jumpTo ?? "vin");
      return;
    }
    const fresh = emptySale(newId(), params.get("dealer") ?? "", texasToday());
    setSale(fresh);
    setAt(fresh.dealerId && dealers.some((d) => d.id === fresh.dealerId) ? "vin" : "dealer");
  }, [ready, sale, editId, jumpTo, sales, dealers, params]);

  const steps = useMemo(() => (sale ? intakeSteps(sale, decoded) : []), [sale, decoded]);
  if (!sale) return null;

  const index = Math.max(0, steps.indexOf(at));
  const dealer = dealers.find((d) => d.id === sale.dealerId) ?? null;
  const editing = !!editId;

  const patch = (next: Partial<TitleSale>) => setSale((cur) => (cur ? { ...cur, ...next } : cur));
  const patchBuyer = (next: Partial<TitleSale["buyer"]>) =>
    setSale((cur) => (cur ? { ...cur, buyer: { ...cur.buyer, ...next } } : cur));

  async function advance(override?: Partial<TitleSale>) {
    const current = { ...sale!, ...override };
    setSale(current);
    if (current.dealerId) await saveSale(current);
    const list = intakeSteps(current, decoded);
    const nextStep = editing ? null : list[list.indexOf(at) + 1];
    if (nextStep) {
      setAt(nextStep);
      window.scrollTo({ top: 0 });
    } else {
      router.replace(`/sale/${current.id}`);
    }
  }

  function back() {
    if (index === 0 || editing) router.back();
    else setAt(steps[index - 1]);
  }

  async function pickDealer(d: Dealer) {
    await saveDealer({ ...d, lastUsedAt: new Date().toISOString() });
    await advance({ dealerId: d.id });
  }

  return (
    <div>
      <div className="no-print flex items-center justify-between">
        <button type="button" onClick={back} className="ghost" data-testid="back">
          ← {t("back")}
        </button>
        {dealer && at !== "dealer" && (
          <span className="truncate pl-4 text-[13px] text-faint" data-own-content>
            {titleCase((dealer.dba || dealer.name).split(",")[0])}
          </span>
        )}
      </div>
      <div className="mt-5 h-[3px] overflow-hidden rounded-full bg-well" aria-hidden>
        <div className="h-full bg-copper transition-all duration-300" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
      </div>

      <div className="mt-10" data-step={at}>
        {at === "dealer" && (
          <Question title={t("qDealer")}>
            <DealerSearch onPick={pickDealer} autoFocus />
          </Question>
        )}

        {at === "vin" && <VinStep sale={sale} onDecoded={(facts) => { patch(facts); setDecoded(!!facts.make); }} onNext={() => advance()} />}

        {at === "car" && (
          <Blanks
            title={t("qCar")}
            onNext={() => advance()}
            ok={!!(sale.year && sale.make && sale.model)}
            fields={[
              { label: t("year"), value: sale.year, set: (v) => patch({ year: v.replace(/\D/g, "").slice(0, 4) }), mono: true, inputMode: "numeric" },
              { label: t("make"), value: sale.make, set: (v) => patch({ make: v }) },
              { label: t("model"), value: sale.model, set: (v) => patch({ model: v }) },
              { label: t("body"), value: sale.bodyStyle, set: (v) => patch({ bodyStyle: v }), list: ["Sedan", "Coupe", "SUV", "Truck", "Van", "Wagon", "Hatchback", "Convertible", "Motorcycle", "Trailer"] },
            ]}
          />
        )}

        {at === "color" && (
          <Question title={t("qColor")}>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {PLATE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={sale.color === c}
                  onClick={() => advance({ color: c })}
                  className="tile flex items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium"
                >
                  <span className="h-4 w-4 shrink-0 rounded-full border border-black/10" style={{ background: SWATCH[c] }} aria-hidden />
                  {c.charAt(0) + c.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </Question>
        )}

        {at === "buyerKind" && (
          <Question title={t("qBuyerKind")}>
            <Tiles
              options={[
                { value: "person", label: t("person"), pressed: !sale.buyer.isBusiness },
                { value: "business", label: t("business"), pressed: sale.buyer.isBusiness },
              ]}
              onPick={(v) => advance({ buyer: { ...sale.buyer, isBusiness: v === "business" } })}
            />
          </Question>
        )}

        {at === "buyerName" &&
          (sale.buyer.isBusiness ? (
            <Blanks
              title={t("qBuyerName")}
              onNext={() => advance()}
              ok={!!sale.buyer.entityName.trim()}
              fields={[{ label: t("businessName"), value: sale.buyer.entityName, set: (v) => patchBuyer({ entityName: v }) }]}
            />
          ) : (
            <Blanks
              title={t("qBuyerName")}
              onNext={() => advance()}
              ok={!!(sale.buyer.first.trim() && sale.buyer.last.trim())}
              fields={[
                { label: t("first"), value: sale.buyer.first, set: (v) => patchBuyer({ first: v }), autoComplete: "off" },
                { label: t("middle"), value: sale.buyer.middle, set: (v) => patchBuyer({ middle: v }), optional: true },
                { label: t("last"), value: sale.buyer.last, set: (v) => patchBuyer({ last: v }) },
              ]}
            />
          ))}

        {at === "address" && <AddressStep sale={sale} patchBuyer={patchBuyer} onNext={() => advance()} />}

        {at === "id" && (
          <Question title={t("qId")}>
            {!sale.buyer.isBusiness && (
              <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {(["license", "idCard", "passport", "military"] as IdType[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={sale.buyer.idType === k}
                    onClick={() => patchBuyer({ idType: k })}
                    className="tile px-4 py-3 text-[15px] font-medium"
                  >
                    {t(k)}
                  </button>
                ))}
              </div>
            )}
            <Blanks
              onNext={() => advance()}
              ok={!!sale.buyer.idNumber.trim()}
              fields={[
                {
                  label: sale.buyer.isBusiness ? t("taxId") : t("idNumber"),
                  value: sale.buyer.idNumber,
                  set: (v) => patchBuyer({ idNumber: v.toUpperCase() }),
                  mono: true,
                },
                ...(!sale.buyer.isBusiness && sale.buyer.idType !== "military"
                  ? [{ label: t("state"), value: sale.buyer.idState, set: (v: string) => patchBuyer({ idState: v.toUpperCase().slice(0, 3) }), mono: true }]
                  : []),
              ]}
            />
          </Question>
        )}

        {at === "contact" && (
          <Blanks
            title={t("qContact")}
            onNext={() => advance()}
            ok
            skippable
            fields={[
              { label: t("phone"), value: sale.buyer.phone, set: (v) => patchBuyer({ phone: v }), inputMode: "tel", mono: true, optional: true },
              { label: t("email"), value: sale.buyer.email, set: (v) => patchBuyer({ email: v.trim() }), inputMode: "email", optional: true },
            ]}
          />
        )}

        {at === "price" && (
          <Blanks
            title={t("qPrice")}
            onNext={() => advance()}
            ok={!!sale.price && !!sale.saleDate}
            fields={[
              {
                label: t("price"),
                value: sale.price ? String(sale.price) : "",
                set: (v) => patch({ price: Number(v.replace(/[^\d.]/g, "")) || null }),
                mono: true,
                inputMode: "decimal",
                prefix: "$",
              },
              { label: t("saleDate"), value: sale.saleDate, set: (v) => patch({ saleDate: v }), type: "date", mono: true },
            ]}
          />
        )}

        {at === "odometer" && (
          <Blanks
            title={t("qOdometer")}
            onNext={() => advance()}
            ok={sale.odometer !== null}
            fields={[
              {
                label: t("miles"),
                value: sale.odometer === null ? "" : String(sale.odometer),
                set: (v) => {
                  const digits = v.replace(/\D/g, "");
                  patch({ odometer: digits ? Number(digits) : null });
                },
                mono: true,
                inputMode: "numeric",
              },
            ]}
          />
        )}

        {at === "brand" && (
          <Question title={t("qBrand")}>
            <Tiles
              options={[
                { value: "actual", label: t("realNumber"), pressed: sale.odometerBrand === "actual" },
                { value: "exceeds", label: t("rolledOver"), hint: t("rolledOverHint"), pressed: sale.odometerBrand === "exceeds" },
                { value: "not_actual", label: t("notReal"), hint: t("notRealHint"), pressed: sale.odometerBrand === "not_actual" },
              ]}
              onPick={(v) => advance({ odometerBrand: v as TitleSale["odometerBrand"] })}
            />
          </Question>
        )}

        {at === "title" && (
          <Question title={t("qTitle")}>
            <Tiles
              options={[
                { value: "clean", label: t("clean"), pressed: sale.titleKind === "clean" },
                { value: "rebuilt", label: t("rebuilt"), pressed: sale.titleKind === "rebuilt" },
                { value: "bonded", label: t("bonded"), pressed: sale.titleKind === "bonded" },
                { value: "salvage", label: t("salvage"), hint: t("salvageHint"), pressed: sale.titleKind === "salvage" },
              ]}
              onPick={(v) => advance({ titleKind: v as TitleSale["titleKind"] })}
            />
          </Question>
        )}

        {at === "titleFrom" && <TitleFromStep sale={sale} onNext={(state) => advance({ titleState: state })} />}

        {at === "lien" && (
          <Question title={t("qLien")}>
            <Tiles
              options={[
                { value: "none", label: t("noLien"), pressed: sale.lien.holder === "none" },
                { value: "dealer", label: t("dealerCarries"), hint: t("dealerCarriesHint"), pressed: sale.lien.holder === "dealer" },
                { value: "lender", label: t("bankLender"), pressed: sale.lien.holder === "lender" },
              ]}
              onPick={(v) => advance({ lien: { holder: v as TitleSale["lien"]["holder"], name: v === "lender" ? sale.lien.name : "" } })}
            />
          </Question>
        )}

        {at === "lender" && (
          <Blanks
            title={t("qLender")}
            onNext={() => advance()}
            ok={!!sale.lien.name.trim()}
            fields={[{ label: t("qLender"), value: sale.lien.name, set: (v) => patch({ lien: { holder: "lender", name: v } }) }]}
          />
        )}

        {at === "emptyWeight" && (
          <Blanks
            title={t("qEmptyWeight")}
            onNext={() => advance({ emptyFrom: "typed" })}
            ok={/^\d{3,6}$/.test(sale.emptyWeight.replace(/,/g, ""))}
            fields={[
              { label: t("pounds"), value: sale.emptyWeight, set: (v) => patch({ emptyWeight: v.replace(/[^\d]/g, "") }), mono: true, inputMode: "numeric" },
            ]}
          />
        )}

        {at === "gvwr" && (
          <Blanks
            title={t("qGvwr")}
            line={sale.gvwrBand ? t("gvwrBand", { band: sale.gvwrBand }) : undefined}
            onNext={() => advance()}
            ok={gvwrRefusal(sale.gvwr, saleWeights(sale).emptyWeight) === null}
            fields={[{ label: t("pounds"), value: sale.gvwr, set: (v) => patch({ gvwr: v.replace(/[^\d]/g, "") }), mono: true, inputMode: "numeric" }]}
          />
        )}
      </div>
    </div>
  );
}

const SWATCH: Record<string, string> = {
  BEIGE: "#d8c8a8", BLACK: "#16130f", BLUE: "#24508a", BROWN: "#6b4a2f", GOLD: "#b8923a", GRAY: "#8a8a86",
  GREEN: "#2f6b45", MAROON: "#6b1f28", ORANGE: "#d0702a", PINK: "#e2a0b4", PURPLE: "#5d3a7a", RED: "#b3261e",
  SILVER: "#c4c6c8", TAN: "#c9a77c", WHITE: "#fbfaf7", YELLOW: "#e6c435",
};

function Question({ title, line, children }: { title?: string; line?: string; children: ReactNode }) {
  return (
    <section>
      {title && <h1 className="display text-[40px] sm:text-[52px]">{title}</h1>}
      {line && <p className="mt-2 text-[15px] text-muted">{line}</p>}
      <div className={title ? "mt-8" : ""}>{children}</div>
    </section>
  );
}

function Tiles({
  options,
  onPick,
}: {
  options: { value: string; label: string; hint?: string; pressed?: boolean }[];
  onPick: (value: string) => void;
}) {
  return (
    <div className="grid gap-3">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={!!o.pressed}
          onClick={() => onPick(o.value)}
          className="tile flex flex-col px-6 py-5 text-left"
          data-testid={`tile-${o.value}`}
        >
          <span className="text-[19px] font-medium">{o.label}</span>
          {o.hint && <span className="mt-1 text-[14px] text-muted">{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}

type Blank = {
  label: string;
  value: string;
  set: (v: string) => void;
  mono?: boolean;
  optional?: boolean;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  list?: readonly string[];
  prefix?: string;
};

/**
 * Blanks on one page. Enter moves to the next blank; on the last blank
 * Enter is Next.
 */
function Blanks({
  title,
  line,
  fields,
  ok,
  onNext,
  skippable,
}: {
  title?: string;
  line?: string;
  fields: Blank[];
  ok: boolean;
  onNext: () => void;
  skippable?: boolean;
}) {
  const { t } = useDesk();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const allEmpty = fields.every((f) => !f.value.trim());
  return (
    <Question title={title} line={line}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onNext();
        }}
      >
        <div className="grid gap-3">
          {fields.map((f, i) => (
            <label key={f.label} className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-muted">{f.label}</span>
              <span className="relative block">
                {f.prefix && <span className="figure pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[18px] text-faint">{f.prefix}</span>}
                <input
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  className={`field ${f.mono ? "figure" : ""} ${f.prefix ? "pl-9" : ""} text-[19px]`}
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  type={f.type ?? "text"}
                  inputMode={f.inputMode}
                  autoComplete={f.autoComplete ?? "off"}
                  autoFocus={i === 0}
                  list={f.list ? `list-${i}` : undefined}
                  enterKeyHint={i === fields.length - 1 ? "next" : "next"}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && i < fields.length - 1) {
                      e.preventDefault();
                      refs.current[i + 1]?.focus();
                    }
                  }}
                />
                {f.list && (
                  <datalist id={`list-${i}`}>
                    {f.list.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                )}
              </span>
            </label>
          ))}
        </div>
        <button className="primary mt-6 w-full" disabled={!ok} data-testid="next">
          {skippable && allEmpty ? t("skip") : t("next")}
        </button>
      </form>
    </Question>
  );
}

function VinStep({
  sale,
  onDecoded,
  onNext,
}: {
  sale: TitleSale;
  onDecoded: (facts: Partial<TitleSale>) => void;
  onNext: () => void;
}) {
  const { t } = useDesk();
  const [vin, setVin] = useState(sale.vin);
  const [looking, setLooking] = useState(false);
  const valid = /^[A-HJ-NPR-Z0-9]{17}$/.test(vin);
  const last = useRef("");

  useEffect(() => {
    if (!valid || last.current === vin) return;
    last.current = vin;
    setLooking(true);
    fetch(`/api/vin/${vin}`)
      .then((r) => r.json())
      .then((j) => {
        if (j && j.make) {
          onDecoded({
            vin,
            year: j.year || "",
            make: j.make || "",
            model: j.model || "",
            bodyStyle: j.bodyStyle || "",
            gvwrBand: j.gvwrBand || "",
            ...(j.emptyWeight ? { emptyWeight: j.emptyWeight, emptyFrom: "found" as const } : {}),
          });
        } else onDecoded({ vin });
      })
      .catch(() => onDecoded({ vin }))
      .finally(() => setLooking(false));
  }, [vin, valid, onDecoded]);

  return (
    <Question title={t("qVin")}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !looking) onNext();
        }}
      >
        <input
          className="field figure text-[22px] tracking-[0.08em]"
          value={vin}
          onChange={(e) => setVin(e.target.value.toUpperCase().replace(/\s+/g, "").slice(0, 17))}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="characters"
          data-testid="vin"
        />
        <p className="mt-3 min-h-[24px] text-[15px]" data-own-content>
          {looking ? (
            <span className="text-faint">{t("vinLooking")}</span>
          ) : valid && sale.vin === vin && sale.make ? (
            <span className="text-ink">
              {carName(sale)}
              {sale.emptyFrom === "found" && <span className="figure text-faint"> · {t("foundWeight", { n: sale.emptyWeight })}</span>}
            </span>
          ) : vin.length > 0 && !valid ? (
            <span className="text-faint">{t("vinBad")}</span>
          ) : null}
        </p>
        <button className="primary mt-4 w-full" disabled={!valid || looking} data-testid="next">
          {t("next")}
        </button>
      </form>
    </Question>
  );
}

function AddressStep({
  sale,
  patchBuyer,
  onNext,
}: {
  sale: TitleSale;
  patchBuyer: (p: Partial<TitleSale["buyer"]>) => void;
  onNext: () => void;
}) {
  const { t } = useDesk();
  const b = sale.buyer;
  const asked = useRef("");

  async function complete() {
    const street = b.street.trim();
    const key = [street, b.city.trim(), b.zip.trim()].join("|").toLowerCase();
    // Once per thing typed; a county already there is not overwritten by a guess.
    if (!street || asked.current === key || (b.county && b.city && b.zip)) return;
    asked.current = key;
    const q = new URLSearchParams({ street, city: b.city, state: b.state || "TX", zip: b.zip });
    const res = await fetch(`/api/address?${q}`).catch(() => null);
    const found = res && res.ok ? ((await res.json()).address as { street: string; city: string; state: string; zip: string; county: string } | null) : null;
    if (found) patchBuyer({ street: found.street, city: found.city, state: found.state, zip: found.zip, county: found.county });
  }

  const txCounty = (b.state || "TX").toUpperCase() !== "TX" || !!canonicalCounty(b.county);
  const ok = !!(b.street.trim() && b.city.trim() && b.state.trim() && /^\d{5}/.test(b.zip) && b.county.trim() && txCounty);

  return (
    <Question title={t("qAddress")}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onNext();
        }}
        className="grid gap-3"
      >
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-muted">{t("street")}</span>
          <input className="field text-[19px]" value={b.street} onChange={(e) => patchBuyer({ street: e.target.value })} onBlur={complete} autoFocus autoComplete="off" />
        </label>
        <div className="grid grid-cols-[1fr_88px] gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-muted">{t("city")}</span>
            <input className="field text-[19px]" value={b.city} onChange={(e) => patchBuyer({ city: e.target.value })} onBlur={complete} autoComplete="off" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-muted">{t("state")}</span>
            <input className="field figure text-[19px]" value={b.state} onChange={(e) => patchBuyer({ state: e.target.value.toUpperCase().slice(0, 2) })} />
          </label>
        </div>
        <div className="grid grid-cols-[120px_1fr] gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-muted">{t("zip")}</span>
            <input className="field figure text-[19px]" value={b.zip} inputMode="numeric" onChange={(e) => patchBuyer({ zip: e.target.value.replace(/[^\d-]/g, "").slice(0, 10) })} onBlur={complete} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-muted">{t("county")}</span>
            <input className="field text-[19px]" value={b.county} list="tx-counties" onChange={(e) => patchBuyer({ county: e.target.value })} onBlur={() => { const c = canonicalCounty(b.county); if (c) patchBuyer({ county: c }); }} />
            <datalist id="tx-counties">
              {TEXAS_COUNTIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
        </div>
        <button className="primary mt-3 w-full" disabled={!ok} data-testid="next">
          {t("next")}
        </button>
      </form>
    </Question>
  );
}

function TitleFromStep({ sale, onNext }: { sale: TitleSale; onNext: (state: string) => void }) {
  const { t } = useDesk();
  const [other, setOther] = useState(!!sale.titleState);
  const [state, setState] = useState(sale.titleState);
  const valid = /^[A-Z]{2}$/.test(state) && state !== "TX";
  return (
    <Question title={t("qTitleFrom")}>
      <Tiles
        options={[
          { value: "TX", label: t("texas"), pressed: !other && !sale.titleState },
          { value: "other", label: t("otherState"), pressed: other },
        ]}
        onPick={(v) => (v === "TX" ? onNext("") : setOther(true))}
      />
      {other && (
        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onNext(state);
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-muted">{t("whichState")}</span>
            <input className="field figure text-[19px]" value={state} onChange={(e) => setState(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))} autoFocus placeholder="OK" />
          </label>
          <button className="primary mt-4 w-full" disabled={!valid}>
            {t("next")}
          </button>
        </form>
      )}
    </Question>
  );
}
