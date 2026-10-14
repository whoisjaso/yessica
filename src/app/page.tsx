"use client";

import Link from "next/link";
import { useDesk } from "@/components/desk";
import { Heading, SaleTile } from "@/components/bits";
import { titleClock, texasToday } from "@/lib/title/clock";

export default function TitleWork() {
  const { t, sales, dealers, ready } = useDesk();
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
      <div className="flex items-end justify-between gap-4">
        <Heading title={t("navWork")} line={ready ? (open.length ? t("toFile", { n: open.length }) : t("allFiled")) : " "} />
        <Link href="/new" className="primary no-print shrink-0" data-testid="new-sale">
          {t("newSale")}
        </Link>
      </div>

      <ul className="mt-8 flex flex-col gap-3">
        {open.map((sale) => (
          <li key={sale.id}>
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
    </div>
  );
}
