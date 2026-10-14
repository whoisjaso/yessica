"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useDesk } from "@/components/desk";
import { Days, StateWord } from "@/components/bits";
import { Scanner } from "@/components/scanner";
import { saveScan, scansFor, type ScanDoc } from "@/lib/scan/store";
import { pagesToPdf, scanFileName, shareFiles } from "@/lib/scan/pdf";
import { titleCase } from "@/components/dealer-search";
import { titleClock, texasToday, usDate } from "@/lib/title/clock";
import { bringList, saleState } from "@/lib/title/facts";
import { HANDOFF_PAGES, allText, buildHandoff, missingFields, pageText, type HandoffField } from "@/lib/title/webdealer";
import { buyerName, carName, type Dealer, type TitleSale } from "@/lib/title/types";
import type { StepId } from "@/lib/title/intake";
import type { StringKey } from "@/lib/i18n/strings";

function heldReason(sale: TitleSale): StringKey {
  const state = saleState(sale);
  return state.word === "waiting" ? state.reason : "waiting";
}

/** Where each missing box is answered. */
const FIX_STEP: Record<string, StepId> = {
  vin: "vin",
  yearMakeModel: "car",
  model: "car",
  majorColor: "color",
  vehicleClass: "car",
  emptyWeight: "emptyWeight",
  carryingCapacity: "gvwr",
  buyerName: "buyerName",
  buyerStreet: "address",
  buyerCity: "address",
  buyerState: "address",
  buyerZip: "address",
  buyerCounty: "address",
  buyerIdNumber: "id",
  salesPrice: "price",
  salesTaxDate: "price",
  odometerReading: "odometer",
  lienholder: "lender",
};

export default function SalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, sales, dealers, ready } = useDesk();
  const sale = sales.find((s) => s.id === id);
  if (!sale) return ready ? <p className="text-muted">—</p> : null;
  const dealer = dealers.find((d) => d.id === sale.dealerId) ?? null;
  const clock = titleClock(sale, texasToday());
  const fields = buildHandoff(sale, dealer);
  const missing = missingFields(fields).filter((f, i, all) => all.findIndex((g) => g.key === f.key) === i);
  const state = saleState(sale);
  const canFile = state.word === "ready" || state.word === "filed";

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="display text-[40px] sm:text-[54px]" data-own-content>
            {buyerName(sale.buyer) || "—"}
          </h1>
          <p className="mt-2 text-[16px] text-muted" data-own-content>
            {carName(sale)}
            {dealer && <span className="text-faint"> · {titleCase(dealer.dba ? dealer.dba.split(",")[0] : dealer.name)}</span>}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
            <Days sale={sale} size="lg" />
            {!sale.filedNumber && (
              <span className="figure text-[13px] text-faint" data-own-content>
                {t("dueOn", { date: usDate(clock.dueOn) })}
              </span>
            )}
          </div>
        </div>
        <div className="pt-3">
          <StateWord sale={sale} />
        </div>
      </div>

      {missing.length > 0 && !sale.filedNumber && (
        <div className="mt-8 rounded-[18px] border border-wait/30 bg-wait-wash px-5 py-4">
          <p className="text-[14px] font-medium text-wait">{t("fixFirst")}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {missing.map((f) => (
              <li key={f.key}>
                <Link
                  href={`/new?sale=${sale.id}&step=${FIX_STEP[f.key] ?? "vin"}`}
                  className="inline-block rounded-full border border-wait/40 bg-raised px-3 py-1.5 text-[13px] font-medium text-ink"
                >
                  {f.label.replace(/\s*\(.*\)$/, "")}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-4">
        <FormRow sale={sale} dealer={dealer} disabled={!canFile} />
        <WebDealerRow sale={sale} fields={fields} held={!canFile} />
        <BringRow sale={sale} />
        <FiledRow sale={sale} disabled={!canFile} />
      </div>

      <p className="no-print mt-10 text-center">
        <Link href={`/new?sale=${sale.id}&step=vin`} className="text-[14px] text-muted underline underline-offset-4 hover:text-ink">
          {t("edit")}
        </Link>
      </p>
    </div>
  );
}

function Row({ title, aside, children, testId }: { title: string; aside?: React.ReactNode; children: React.ReactNode; testId?: string }) {
  return (
    <section className="tile px-5 py-5 sm:px-6" data-testid={testId}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-faint">{title}</h2>
        {aside}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function FormRow({ sale, dealer, disabled }: { sale: TitleSale; dealer: Dealer | null; disabled: boolean }) {
  const { t } = useDesk();
  const [busy, setBusy] = useState(false);

  async function make(print: boolean) {
    if (!dealer) return;
    setBusy(true);
    // Opened before the await, so the browser counts it as her tap.
    const tab = window.open("", "_blank");
    try {
      const [{ fill130U }, { agreementFromSale }] = await Promise.all([import("@/lib/form130u/fill-pdf"), import("@/lib/form130u/from-sale")]);
      const template = await (await fetch("/forms/130-U.pdf")).arrayBuffer();
      const bytes = await fill130U(agreementFromSale(sale, dealer), template);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      if (tab) {
        tab.location.href = url;
        if (print) tab.addEventListener?.("load", () => tab.print(), { once: true });
      } else {
        window.location.href = url;
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Row title={t("rowForm")} testId="row-130u">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px] text-muted">Form 130-U</p>
        <div className="flex gap-2">
          <button type="button" className="ghost" disabled={disabled || busy} onClick={() => make(false)} data-testid="open-130u">
            {busy ? t("making") : t("open")}
          </button>
          <button type="button" className="ghost" disabled={disabled || busy} onClick={() => make(true)}>
            {t("print")}
          </button>
        </div>
      </div>
    </Row>
  );
}

function WebDealerRow({ sale, fields, held }: { sale: TitleSale; fields: HandoffField[]; held: boolean }) {
  const { t, lang, saveSale } = useDesk();
  const [openPage, setOpenPage] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [plate, setPlate] = useState(sale.plate);

  async function copy(text: string, mark: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(mark);
      setTimeout(() => setCopied((c) => (c === mark ? null : c)), 1400);
    } catch {
      // older browsers: nothing to do, the value is on screen
    }
  }

  const pages = HANDOFF_PAGES.filter((p) => fields.some((f) => f.page === p.page));

  return (
    <Row
      title={t("rowWeb")}
      testId="row-webdealer"
      aside={
        !held ? (
          <button type="button" className="text-[13px] font-medium text-copper" onClick={() => copy(allText(fields), "all")}>
            {copied === "all" ? t("copied") : t("copy")}
          </button>
        ) : (
          <span className="text-[12px] font-medium text-wait">{t(heldReason(sale))}</span>
        )
      }
    >
      <ol className="-mx-1">
        {pages.map((p, n) => {
          const rows = fields.filter((f) => f.page === p.page);
          const isOpen = openPage === p.page;
          return (
            <li key={p.page} className={n ? "border-t border-line" : ""}>
              <button
                type="button"
                onClick={() => setOpenPage(isOpen ? null : p.page)}
                className="flex w-full items-center justify-between gap-3 px-1 py-3 text-left"
                aria-expanded={isOpen}
              >
                <span className="flex items-baseline gap-3">
                  <span className="figure w-5 text-[13px] text-faint">{n + 1}</span>
                  <span className="text-[15px] font-medium">{lang === "es" ? p.es : p.title}</span>
                </span>
                <span className="text-faint" aria-hidden>
                  {isOpen ? "−" : "+"}
                </span>
              </button>
              {isOpen && (
                <div className="pb-4 pl-9 pr-1">
                  {p.page === "plates" && (
                    <input
                      className="field figure mb-3 text-[16px]"
                      placeholder={t("plate")}
                      value={plate}
                      onChange={(e) => setPlate(e.target.value.toUpperCase())}
                      onBlur={() => plate !== sale.plate && saveSale({ ...sale, plate: plate.trim() })}
                    />
                  )}
                  <ul className="flex flex-col gap-1.5">
                    {rows.map((f) => (
                      <li key={`${f.page}-${f.key}`}>
                        <button
                          type="button"
                          disabled={held || f.value === null}
                          onClick={() => f.value && copy(f.value, `${f.page}-${f.key}`)}
                          className="group flex w-full items-start justify-between gap-3 rounded-xl bg-well/60 px-3.5 py-2.5 text-left transition-colors hover:bg-well disabled:cursor-default"
                        >
                          <span className="min-w-0">
                            <span className="block text-[12px] text-faint">{f.label}</span>
                            <span className={`block break-words text-[15px] ${f.value === null ? "text-wait" : "text-ink"} ${/vin|weight|capacity|odometer|zip|price|date/i.test(f.key) ? "figure" : ""}`} data-own-content>
                              {f.value ?? (f.optional ? "—" : t("missing"))}
                            </span>
                            {f.hint && <span className="mt-0.5 block text-[12px] text-muted">{f.hint}</span>}
                          </span>
                          {f.value !== null && !held && (
                            <span className="shrink-0 pt-4 text-[12px] font-medium text-copper opacity-70 group-hover:opacity-100">
                              {copied === `${f.page}-${f.key}` ? t("copied") : t("copy")}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {!held && (
                    <button type="button" className="mt-3 text-[13px] font-medium text-muted underline underline-offset-4" onClick={() => copy(pageText(fields, p.page), p.page)}>
                      {copied === p.page ? t("copied") : t("copyPage")}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </Row>
  );
}

function BringRow({ sale }: { sale: TitleSale }) {
  const { t, lang } = useDesk();
  const items = bringList(sale);
  const [scans, setScans] = useState<ScanDoc[]>([]);
  const [scanning, setScanning] = useState<{ key: string; label: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    scansFor(sale.id).then((docs) => live && setScans(docs));
    return () => {
      live = false;
    };
  }, [sale.id]);

  const scanOf = (key: string) => scans.find((d) => d.docKey === key && d.pages.length > 0);
  const label = (i: number) => (lang === "es" ? items[i].es : items[i].en);

  async function fileFor(i: number): Promise<File | null> {
    const doc = scanOf(items[i].key);
    if (!doc) return null;
    const name = scanFileName(i + 1, items[i].en.split(",")[0], buyerName(sale.buyer));
    const bytes = await pagesToPdf(doc.pages, name.replace(/\.pdf$/, ""));
    return new File([bytes as BlobPart], name, { type: "application/pdf" });
  }

  async function share(indexes: number[], mark: string) {
    setBusy(mark);
    try {
      const files = (await Promise.all(indexes.map(fileFor))).filter((f): f is File => !!f);
      if (files.length) await shareFiles(files);
    } finally {
      setBusy(null);
    }
  }

  const scannedIdx = items.map((_, i) => i).filter((i) => scanOf(items[i].key));

  return (
    <Row
      title={t("rowBring")}
      testId="row-bring"
      aside={
        scannedIdx.length > 1 ? (
          <button type="button" className="text-[13px] font-medium text-copper" onClick={() => share(scannedIdx, "all")}>
            {busy === "all" ? t("making") : t("shareAll")}
          </button>
        ) : null
      }
    >
      <ol className="flex flex-col">
        {items.map((item, i) => {
          const doc = scanOf(item.key);
          return (
            <li key={item.key} className={`flex items-center gap-3 py-3 ${i ? "border-t border-line" : ""}`}>
              <span className="figure w-5 shrink-0 self-start pt-0.5 text-faint">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px]">{label(i)}</span>
                {doc && (
                  <span className="mt-0.5 flex items-center gap-1.5 text-[12px] font-medium text-ready">
                    <span aria-hidden>✓</span>
                    {doc.pages.length === 1 ? t("onePage") : t("pagesN", { n: doc.pages.length })}
                    <button type="button" className="ml-2 font-normal text-faint underline underline-offset-2" onClick={() => setScanning({ key: item.key, label: label(i) })}>
                      {t("rescan")}
                    </button>
                  </span>
                )}
              </span>
              {doc ? (
                <button type="button" className="ghost no-print shrink-0" onClick={() => share([i], item.key)}>
                  {busy === item.key ? t("making") : t("share")}
                </button>
              ) : (
                <button
                  type="button"
                  className="no-print inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[14px] font-medium text-paper"
                  onClick={() => setScanning({ key: item.key, label: label(i) })}
                  data-testid={`scan-${item.key}`}
                >
                  <ScanGlyph />
                  {t("scan")}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {scanning && (
        <Scanner
          title={scanning.label}
          onCancel={() => setScanning(null)}
          onDone={async (pages) => {
            const doc: ScanDoc = { id: `${sale.id}:${scanning.key}`, saleId: sale.id, docKey: scanning.key, pages, updatedAt: new Date().toISOString() };
            await saveScan(doc);
            setScans((all) => [...all.filter((d) => d.id !== doc.id), doc]);
            setScanning(null);
          }}
        />
      )}
    </Row>
  );
}

function ScanGlyph() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M3 7V4.5A1.5 1.5 0 0 1 4.5 3H7M13 3h2.5A1.5 1.5 0 0 1 17 4.5V7M17 13v2.5a1.5 1.5 0 0 1-1.5 1.5H13M7 17H4.5A1.5 1.5 0 0 1 3 15.5V13M3 10h14" strokeLinecap="round" />
    </svg>
  );
}

function FiledRow({ sale, disabled }: { sale: TitleSale; disabled: boolean }) {
  const { t, saveSale, me, setMe } = useDesk();
  const [num, setNum] = useState(sale.filedNumber);
  const [who, setWho] = useState(me);

  if (sale.filedNumber) {
    return (
      <Row title={t("rowFiled")} testId="row-filed">
        <p className="figure text-[20px] font-medium" data-own-content>
          {sale.filedNumber}
        </p>
        <p className="mt-1 text-[13px] text-faint" data-own-content>
          {t("filedOn", { date: usDate(sale.filedAt.slice(0, 10)), who: sale.filedBy || "—" })}
        </p>
      </Row>
    );
  }

  const needName = !me;
  return (
    <Row title={t("rowFiled")} testId="row-filed">
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (disabled || !num.trim() || (needName && !who.trim())) return;
          if (needName) setMe(who.trim());
          await saveSale({
            ...sale,
            filedNumber: num.trim(),
            filedAt: new Date().toISOString(),
            filedBy: (me || who).trim(),
          });
        }}
      >
        <input
          className="field figure text-[18px]"
          placeholder={t("receipt")}
          value={num}
          onChange={(e) => setNum(e.target.value)}
          disabled={disabled}
          data-testid="receipt"
        />
        {needName && (
          <input className="field text-[16px]" placeholder={t("yourName")} value={who} onChange={(e) => setWho(e.target.value)} disabled={disabled} />
        )}
        <button className="primary" disabled={disabled || !num.trim() || (needName && !who.trim())} data-testid="file-it">
          {t("fileIt")}
        </button>
      </form>
    </Row>
  );
}
