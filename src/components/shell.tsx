"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useDesk } from "@/components/desk";
import { useGuide } from "@/components/guide";

const NAV = [
  { href: "/", key: "navWork" },
  { href: "/dealers", key: "navDealers" },
  { href: "/how-to-file", key: "navHow" },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useDesk();
  const guide = useGuide();
  const path = usePathname();
  const flow = path.startsWith("/new");
  const active = (href: string) => (href === "/" ? path === "/" || path.startsWith("/sale") : path.startsWith(href));

  return (
    <div className="min-h-dvh">
      <header className="no-print mx-auto flex max-w-3xl items-center justify-between px-5 pt-6 sm:px-8 sm:pt-10">
        <Link href="/" className="flex items-baseline gap-2" aria-label={t("appName")}>
          <span className="display text-[26px] text-ink">Title Desk</span>
          <span className="h-1.5 w-1.5 translate-y-[-3px] rounded-full bg-copper" aria-hidden />
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => guide.setOn(!guide.on)}
            aria-pressed={guide.on}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              guide.on ? "border-copper/40 bg-copper-wash text-copper" : "border-line text-muted"
            }`}
            data-testid="guide-toggle"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${guide.on ? "bg-copper" : "bg-faint"}`} aria-hidden />
            {t(guide.on ? "guideOn" : "guideOff")}
          </button>
          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "es" : "en")}
            className="rounded-full border border-line px-3 py-1.5 text-[12px] font-medium text-muted"
          >
            {t("langSwitch")}
          </button>
        </div>
      </header>

      {!flow && (
        <nav className="no-print mx-auto mt-6 max-w-3xl px-5 sm:px-8" aria-label="Main">
          <ul className="flex gap-1 rounded-full border border-line bg-raised p-1 shadow-[var(--shadow)]">
            {NAV.map((item) => (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active(item.href) ? "page" : undefined}
                  data-guide={item.href === "/" ? "nav-work" : undefined}
                  className={`block rounded-full px-2 py-2.5 text-center text-[14px] font-medium transition-colors ${
                    active(item.href) ? "bg-ink text-paper" : "text-muted hover:text-ink"
                  }`}
                >
                  {t(item.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <main className="mx-auto max-w-3xl px-5 pb-28 pt-8 sm:px-8 sm:pt-12">{children}</main>
    </div>
  );
}
