"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { setSoundOn, sfx, soundOn } from "@/lib/sound";
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
  const [sound, setSound] = useState(true);
  useEffect(() => setSound(soundOn()), []);

  // A light tick on every button and link, unless it plays its own sound.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.("button, a, [role=button], summary");
      if (!el || el.closest("[data-sfx]") || (el as HTMLButtonElement).disabled) return;
      sfx.tap();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
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
            onClick={() => {
              setSoundOn(!sound);
              setSound(!sound);
              if (!sound) setTimeout(() => sfx.step(), 30);
            }}
            aria-pressed={sound}
            aria-label={t(sound ? "soundOn" : "soundOff")}
            title={t(sound ? "soundOn" : "soundOff")}
            className={`flex h-[30px] w-[30px] items-center justify-center rounded-full border transition-colors ${sound ? "border-copper/40 bg-copper-wash text-copper" : "border-line text-faint"}`}
            data-sfx="own"
            data-testid="sound-toggle"
          >
            <SpeakerGlyph on={sound} />
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

function SpeakerGlyph({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 8v4h3l4 3.5v-11L6.5 8h-3Z" fill="currentColor" stroke="none" />
      {on ? (
        <>
          <path d="M13.5 7.5a3.5 3.5 0 0 1 0 5" />
          <path d="M15.5 5.5a6.4 6.4 0 0 1 0 9" />
        </>
      ) : (
        <path d="m13.5 8 4 4m0-4-4 4" />
      )}
    </svg>
  );
}
