"use client";

import Link from "next/link";
import { useDesk } from "@/components/desk";
import { Guide, useGuide } from "@/components/guide";
import { Heading, SaleTile } from "@/components/bits";
import { titleClock, texasToday } from "@/lib/title/clock";

export default function TitleWork() {
  const { t, sales, dealers, ready } = useDesk();
  const guide = useGuide();
  const today = texasToday();
  const open = sales
    .filter((s) => !s.filedNumber)
    .map((s) => ({ s, left: titleClock(s, today).daysLeft }))
    .sort((a, b) => a.left - b.left)
    .map((x) => x.s);
  const filed = sales
    .filter((s) => s.filedNumber)
    .sort((a, b) => b.filedAt.localeCompare(a.filedAt))
    .slice(0, 12);
  const dealerOf = (id: string) => dealers.find((d) => d.id === id);

  return (
    <div>
      <Heading title={t("navWork")} line={ready ? (open.length ? t("toFile", { n: open.length }) : t("allFiled")) : " "} />

      {/* The one way in: a new sale, walked step by step. */}
      <Link
        href="/new"
        onClick={() => guide.setOn(true)}
        className="start-glow no-print mt-8 flex items-center justify-between gap-4 rounded-[24px] bg-ink px-6 py-6 text-paper shadow-[var(--shadow)] transition-transform active:scale-[0.99] sm:px-8 sm:py-7"
        data-testid="new-sale"
        data-guide="start-here"
      >
        <span>
          <span className="display block text-[34px] leading-none sm:text-[40px]">{t("startHere")}</span>
          <span className="mt-2 block text-[15px] text-[#cfc6b8]">{t("startHereLine")}</span>
        </span>
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-copper text-[26px] text-white" aria-hidden>
          →
        </span>
      </Link>

      <ul className="mt-8 flex flex-col gap-3">
        {open.map((sale, i) => (
          <li key={sale.id} data-guide={i === 0 ? "first-sale" : undefined} className="rounded-[18px]">
            <SaleTile sale={sale} dealer={dealerOf(sale.dealerId)} />
          </li>
        ))}
      </ul>

      {filed.length > 0 && (
        <section className="mt-12">
          <p className="eyebrow">{t("filedRecently")}</p>
          <ul className="mt-3 flex flex-col gap-3 opacity-80">
            {filed.map((sale) => (
              <li key={sale.id}>
                <SaleTile sale={sale} dealer={dealerOf(sale.dealerId)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {ready && (open.length ? <Guide target="first-sale" say={t("gOpenSale")} /> : <Guide target="start-here" say={t("gNewSale")} />)}
    </div>
  );
}
