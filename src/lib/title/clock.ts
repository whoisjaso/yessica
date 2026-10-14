/**
 * The title clock: how many days are left to file.
 *
 * A Texas dealer applies for title and registration in the buyer's name
 * within 30 days of the sale, or 45 days when the dealer financed it
 * (Transp. Code §501.0234; TxDMV, "Title When a Motor Vehicle Dealer Goes
 * Out of Business": "within 30 days of the sale (45 days if seller
 * financed)"). Since 1 July 2025 that application is made in webDEALER
 * (HB 718). The clock counts calendar days from the date of sale.
 *
 * Seller-financed here means the dealer itself holds the lien: the buyer
 * pays the dealer over time (Tax Code §152.001). A bank's lien does not
 * change the clock.
 *
 * Pure: today comes in as an argument.
 */

import type { TitleSale } from "@/lib/title/types";

export const STANDARD_DAYS = 30;
export const SELLER_FINANCED_DAYS = 45;

export type ClockStage = "filed" | "open" | "soon" | "urgent" | "overdue";

export type TitleClock = {
  /** ISO date the filing is due. */
  dueOn: string;
  /** Days of the window: 30 or 45. */
  windowDays: number;
  /** Calendar days from today to the due date; negative once it has passed. */
  daysLeft: number;
  stage: ClockStage;
};

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const day = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d) / 86_400_000;
  };
  return Math.round(day(toIso) - day(fromIso));
}

export function titleClock(
  sale: Pick<TitleSale, "saleDate" | "lien" | "filedNumber">,
  today: string,
): TitleClock {
  const windowDays = sale.lien.holder === "dealer" ? SELLER_FINANCED_DAYS : STANDARD_DAYS;
  const dueOn = addDays(sale.saleDate, windowDays);
  const daysLeft = daysBetween(today, dueOn);
  const stage: ClockStage = sale.filedNumber.trim()
    ? "filed"
    : daysLeft < 0
      ? "overdue"
      : daysLeft <= 3
        ? "urgent"
        : daysLeft <= 7
          ? "soon"
          : "open";
  return { dueOn, windowDays, daysLeft, stage };
}

/** Today in Texas (America/Chicago), as an ISO date. */
export function texasToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts;
}

export function usDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : iso;
}
