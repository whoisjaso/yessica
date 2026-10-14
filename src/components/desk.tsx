"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { cloudStore, deviceStore, supabase, type Store } from "@/lib/store/store";
import { say, type Lang, type StringKey } from "@/lib/i18n/strings";
import type { Dealer, TitleSale } from "@/lib/title/types";
import { SignIn } from "@/components/sign-in";

type Desk = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
  ready: boolean;
  mode: Store["mode"];
  dealers: Dealer[];
  sales: TitleSale[];
  saveDealer: (dealer: Dealer) => Promise<void>;
  saveSale: (sale: TitleSale) => Promise<void>;
  /** Who is filing: her email when signed in, else the name she gave once. */
  me: string;
  setMe: (name: string) => void;
  signOut: (() => Promise<void>) | null;
};

const DeskContext = createContext<Desk | null>(null);

const LANG_KEY = "titledesk.lang";
const ME_KEY = "titledesk.me";

function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writePref(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // a private window keeps it for this visit only
  }
}

export function DeskProvider({ children }: { children: ReactNode }) {
  const db = supabase();
  const [lang, setLangState] = useState<Lang>("en");
  const [store, setStore] = useState<Store | null>(db ? null : deviceStore);
  const [email, setEmail] = useState<string>("");
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [sales, setSales] = useState<TitleSale[]>([]);
  const [ready, setReady] = useState(false);
  const [me, setMeState] = useState("");

  useEffect(() => {
    const saved = readPref(LANG_KEY);
    if (saved === "es" || saved === "en") setLangState(saved);
    else if (navigator.language?.toLowerCase().startsWith("es")) setLangState("es");
    setMeState(readPref(ME_KEY) ?? "");
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Cloud: wait for a session, then use her rows.
  useEffect(() => {
    if (!db) return;
    const apply = (session: { user: { email?: string } } | null) => {
      if (session) {
        setEmail(session.user.email ?? "");
        setStore(cloudStore(db));
        setNeedsSignIn(false);
      } else {
        setStore(null);
        setNeedsSignIn(true);
        setReady(true);
      }
    };
    db.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = db.auth.onAuthStateChange((_event, session) => apply(session));
    return () => data.subscription.unsubscribe();
  }, [db]);

  useEffect(() => {
    if (!store) return;
    let live = true;
    Promise.all([store.listDealers(), store.listSales()])
      .then(([d, s]) => {
        if (!live) return;
        setDealers(d);
        setSales(s);
      })
      .finally(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, [store]);

  const saveDealer = useCallback(
    async (dealer: Dealer) => {
      setDealers((all) => [dealer, ...all.filter((d) => d.id !== dealer.id)]);
      await store?.saveDealer(dealer);
    },
    [store],
  );

  const saveSale = useCallback(
    async (sale: TitleSale) => {
      setSales((all) => [sale, ...all.filter((s) => s.id !== sale.id)]);
      await store?.saveSale(sale);
    },
    [store],
  );

  const value = useMemo<Desk>(
    () => ({
      lang,
      setLang: (next) => {
        setLangState(next);
        writePref(LANG_KEY, next);
      },
      t: (key, vars) => say(lang, key, vars),
      ready,
      mode: store?.mode ?? (db ? "cloud" : "device"),
      dealers,
      sales,
      saveDealer,
      saveSale,
      me: email || me,
      setMe: (name) => {
        setMeState(name);
        writePref(ME_KEY, name);
      },
      signOut: db && email ? async () => void (await db.auth.signOut()) : null,
    }),
    [lang, ready, store, db, dealers, sales, saveDealer, saveSale, email, me],
  );

  return (
    <DeskContext.Provider value={value}>
      {needsSignIn && db ? <SignIn db={db} /> : children}
    </DeskContext.Provider>
  );
}

export function useDesk(): Desk {
  const desk = useContext(DeskContext);
  if (!desk) throw new Error("useDesk outside DeskProvider");
  return desk;
}
