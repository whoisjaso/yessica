/**
 * Where her dealers and sales live.
 *
 * Two homes, one shape. With Supabase configured she signs in by email and
 * everything follows her to any device, scoped by row-level security to
 * her own rows (supabase/migrations). Without it, everything stays in this
 * browser, so the app works the day it is deployed.
 *
 * Writes are one row at a time. Nothing here deletes.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { titleClock, texasToday } from "@/lib/title/clock";
import { buyerName, carName, type Dealer, type TitleSale } from "@/lib/title/types";

export interface Store {
  mode: "device" | "cloud";
  listDealers(): Promise<Dealer[]>;
  saveDealer(dealer: Dealer): Promise<void>;
  listSales(): Promise<TitleSale[]>;
  saveSale(sale: TitleSale): Promise<void>;
}

const DEALERS_KEY = "titledesk.dealers.v1";
const SALES_KEY = "titledesk.sales.v1";

function readLocal<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function upsertLocal<T extends { id: string }>(key: string, row: T) {
  const rows = readLocal<T>(key).filter((r) => r.id !== row.id);
  rows.push(row);
  window.localStorage.setItem(key, JSON.stringify(rows));
}

export const deviceStore: Store = {
  mode: "device",
  async listDealers() {
    return readLocal<Dealer>(DEALERS_KEY);
  },
  async saveDealer(dealer) {
    upsertLocal(DEALERS_KEY, dealer);
  },
  async listSales() {
    return readLocal<TitleSale>(SALES_KEY);
  },
  async saveSale(sale) {
    upsertLocal(SALES_KEY, sale);
  },
};

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key, { auth: { persistSession: true, detectSessionInUrl: true } });
  return client;
}

export function cloudStore(db: SupabaseClient): Store {
  return {
    mode: "cloud",
    async listDealers() {
      const { data, error } = await db.from("title_dealers").select("data").order("last_used_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => row.data as Dealer);
    },
    async saveDealer(dealer) {
      const { error } = await db.from("title_dealers").upsert({
        id: dealer.id,
        gdn: dealer.gdn,
        name: dealer.name,
        last_used_at: dealer.lastUsedAt,
        data: dealer,
      });
      if (error) throw error;
    },
    async listSales() {
      const { data, error } = await db.from("title_sales").select("data").order("due_on", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => row.data as TitleSale);
    },
    async saveSale(sale) {
      const clock = titleClock(sale, texasToday());
      const { error } = await db.from("title_sales").upsert({
        id: sale.id,
        dealer_id: sale.dealerId,
        sale_date: sale.saleDate,
        due_on: clock.dueOn,
        status: sale.filedNumber ? "filed" : "open",
        buyer_name: buyerName(sale.buyer),
        car: carName(sale),
        filed_number: sale.filedNumber || null,
        filed_by: sale.filedBy || null,
        filed_at: sale.filedAt || null,
        data: sale,
      });
      if (error) throw error;
    },
  };
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
