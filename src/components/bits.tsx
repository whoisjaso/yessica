"use client";

import Link from "next/link";
import { titleCase } from "@/components/dealer-search";
import { useDesk } from "@/components/desk";
import { titleClock, texasToday } from "@/lib/title/clock";
import { saleState } from "@/lib/title/facts";
import { buyerName, carName, type Dealer, type TitleSale } from "@/lib/title/types";

export function CalendarGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="3" y="4.5" width="14" height="12.5" rx="2.5" />
      <path d="M3 8.5h14M7 2.75v3.5M13 2.75v3.5" strokeLinecap="round" />
    </svg>
  );
}

export function Days({ sale, size = "md" }: { sale: TitleSale; size?: "md" | "lg" }) {
  const { t } = useDesk();
  const clock = titleClock(sale, texasToday());
  const tone =
    clock.stage === "filed"
      ? "text-faint"
      : clock.stage === "overdue" || clock.stage === "urgent"
        ? "text-late"
        : clock.stage === "soon"
          ? "text-wait"
          : "text-ink";
  const label =
    clock.stage === "filed"
      ? ""
      : clock.daysLeft < 0
        ? t("daysLate", { n: -clock.daysLeft })
        : clock.daysLeft === 0
          ? t("dueToday")
          : clock.daysLeft === 1
            ? t("oneDayLeft")
            : t("daysLeft", { n: clock.daysLeft });
  if (!label) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 ${tone}`} data-own-content>
      <CalendarGlyph className={size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
      <span className={`figure ${size === "lg" ? "text-[20px]" : "text-[15px]"} font-medium`}>{label}</span>
    </span>
  );
}

export function StateWord({ sale }: { sale: TitleSale }) {
  const { t } = useDesk();
  const state = saleState(sale);
  if (state.word === "filed") return <span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-faint">{t("filed")}</span>;
  if (state.word === "ready") return <span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-copper">{t("ready")}</span>;
  return (
    <span className="flex flex-col items-end leading-tight">
      <span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-wait">{t("waiting")}</span>
      <span className="mt-0.5 text-[12px] text-muted">{t(state.reason)}</span>
    </span>
  );
}

export function SaleTile({ sale, dealer }: { sale: TitleSale; dealer?: Dealer }) {
  const name = buyerName(sale.buyer) || "—";
  const car = carName(sale) || sale.vin || "—";
  return (
    <Link href={`/sale/${sale.id}`} className="tile flex items-center justify-between gap-4 px-5 py-4" data-testid="sale-tile">
      <span className="min-w-0">
        <span className="block truncate text-[17px] font-medium text-ink" data-own-content>
          {name}
        </span>
        <span className="mt-0.5 block truncate text-[14px] text-muted" data-own-content>
          {car}
          {dealer ? <span className="text-faint"> · {titleCase((dealer.dba || dealer.name).split(",")[0])}</span> : null}
        </span>
        <span className="mt-2 block">
          <Days sale={sale} />
        </span>
      </span>
      <StateWord sale={sale} />
    </Link>
  );
}

export function Heading({ title, line }: { title: string; line?: string }) {
  return (
    <div>
      <h1 className="display text-[44px] sm:text-[56px]">{title}</h1>
      {line ? <p className="mt-2 text-[16px] text-muted">{line}</p> : null}
    </div>
  );
}
