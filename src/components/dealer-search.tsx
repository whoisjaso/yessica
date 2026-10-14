"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDesk } from "@/components/desk";
import { Guide } from "@/components/guide";
import { fold, type DirectoryDealer } from "@/lib/dealers/search";
import { newId } from "@/lib/store/store";
import type { Dealer } from "@/lib/title/types";

/**
 * Her dealers first, then every licensed dealer in Texas.
 *
 * Empty, it shows the dealers she has used, most recent first: one tap to
 * reuse. Typing filters those and, underneath, searches TxDMV's list of
 * every GDN in the state, so the name, P number and address arrive
 * together and nothing is typed twice.
 */
export function DealerSearch({ onPick, autoFocus, guided }: { onPick: (dealer: Dealer) => void; autoFocus?: boolean; guided?: boolean }) {
  const { t, dealers, sales, saveDealer } = useDesk();
  const [q, setQ] = useState("");
  const [found, setFound] = useState<DirectoryDealer[]>([]);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);

  const mine = useMemo(() => {
    const sorted = [...dealers].sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
    const f = fold(q);
    if (!f) return sorted;
    return sorted.filter((d) => fold(`${d.name} ${d.dba} ${d.gdn} ${d.city}`).includes(f));
  }, [dealers, q]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setFound([]);
      return;
    }
    const id = ++seq.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/dealers?q=${encodeURIComponent(query)}`);
        const json = (await res.json()) as { dealers: DirectoryDealer[] };
        if (id === seq.current) setFound(json.dealers ?? []);
      } catch {
        if (id === seq.current) setFound([]);
      } finally {
        if (id === seq.current) setSearching(false);
      }
    }, 140);
    return () => clearTimeout(timer);
  }, [q]);

  const mineGdns = new Set(dealers.map((d) => d.gdn.toUpperCase()));
  const fresh = found.filter((d) => !mineGdns.has(d.gdn.toUpperCase()));
  const openCount = (id: string) => sales.filter((s) => s.dealerId === id && !s.filedNumber).length;

  async function adopt(entry: DirectoryDealer) {
    const now = new Date().toISOString();
    const dealer: Dealer = {
      id: newId(),
      gdn: entry.gdn,
      name: entry.name,
      dba: entry.dba,
      street: entry.street,
      city: titleCase(entry.city),
      state: "TX",
      zip: entry.zip,
      county: entry.county,
      agentName: "",
      createdAt: now,
      lastUsedAt: now,
    };
    await saveDealer(dealer);
    onPick(dealer);
  }

  return (
    <div>
      <div className="relative">
        <SearchGlyph />
        <input
          className="field pl-12 text-[18px]"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("findDealer")}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          data-testid="dealer-search"
          data-guide="dealer-input"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (mine[0]) onPick(mine[0]);
            else if (fresh[0]) void adopt(fresh[0]);
          }}
        />
      </div>

      {mine.length > 0 && (
        <section className="mt-7">
          <p className="eyebrow">{t("myDealers")}</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {mine.slice(0, q ? 4 : 12).map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => onPick(d)} className="tile flex w-full items-center justify-between gap-3 px-5 py-4 text-left" data-guide={d === mine[0] ? "dealer-mine-0" : undefined}>
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-medium" data-own-content>
                      {d.dba || d.name}
                    </span>
                    <span className="figure mt-0.5 block text-[13px] text-faint" data-own-content>
                      {d.gdn} · {d.city}
                    </span>
                  </span>
                  {openCount(d.id) > 0 && (
                    <span className="figure shrink-0 text-[15px] font-medium text-copper" data-own-content>
                      {openCount(d.id)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {q.trim().length >= 2 && (
        <section className="mt-7" aria-live="polite">
          <p className="eyebrow">{t("texasDealers")}</p>
          <ul className="mt-3 overflow-hidden rounded-[18px] border border-line bg-raised shadow-[var(--shadow)]">
            {fresh.map((d, i) => (
              <li key={d.gdn} className={i ? "border-t border-line" : ""}>
                <button
                  type="button"
                  onClick={() => void adopt(d)}
                  className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-well"
                  data-testid="directory-hit"
                  data-guide={i === 0 ? "dealer-hit-0" : undefined}
                >
                  <span className="min-w-0">
                    <span className="block text-[16px] font-medium leading-snug" data-own-content>
                      {d.dba ? titleCase(d.dba.split(",")[0]) : titleCase(d.name)}
                    </span>
                    {d.dba && (
                      <span className="block truncate text-[13px] text-muted" data-own-content>
                        {d.name}
                      </span>
                    )}
                    <span className="mt-1 block text-[13px] text-faint" data-own-content>
                      {titleCase(d.city)} · {d.county}
                      {/expired/i.test(d.status) ? <span className="text-late"> · {t("expired")}</span> : null}
                    </span>
                  </span>
                  <span className="figure shrink-0 pt-0.5 text-[15px] font-medium text-ink" data-own-content>
                    {d.gdn}
                  </span>
                </button>
              </li>
            ))}
            {!searching && fresh.length === 0 && <li className="px-5 py-4 text-[15px] text-muted">{t("noMatch")}</li>}
          </ul>
        </section>
      )}

      {guided && (
        <Guide
          target={mine.length ? "dealer-mine-0" : fresh.length ? "dealer-hit-0" : "dealer-input"}
          say={mine.length || fresh.length ? t("gDealerPick") : t("gDealerType")}
        />
      )}

      <p className="mt-6 text-center">
        <Link href="/dealers/new" className="text-[14px] text-muted underline underline-offset-4 hover:text-ink">
          {t("addByHand")}
        </Link>
      </p>
    </div>
  );
}

function SearchGlyph() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-faint" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8.75" cy="8.75" r="5.25" />
      <path d="m12.75 12.75 4 4" strokeLinecap="round" />
    </svg>
  );
}

/** TxDMV's list shouts some names; screens read better in title case. The 130-U prints the record as licensed. */
export function titleCase(text: string): string {
  if (!text) return text;
  if (text !== text.toUpperCase()) return text;
  return text
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Llc|Inc|Lp|Llp|Ltd|Dba|Usa|Tx)\b/g, (m) => m.toUpperCase());
}
