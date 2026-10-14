"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDesk } from "@/components/desk";
import { Heading } from "@/components/bits";
import { newId } from "@/lib/store/store";
import { canonicalCounty } from "@/lib/vehicles/texas-counties";

/** A dealer not on TxDMV's list yet (a licence issued today): name, P number, address. */
export default function AddDealer() {
  const { t, saveDealer } = useDesk();
  const router = useRouter();
  const [f, setF] = useState({ name: "", gdn: "", street: "", city: "", zip: "", county: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const ok = f.name.trim() && /^p?\s*\d{3,7}[a-z]?$/i.test(f.gdn.trim()) && f.city.trim();

  async function lookup() {
    if (!f.street.trim() || f.city) return;
    const res = await fetch(`/api/address?street=${encodeURIComponent(f.street)}&state=TX`).catch(() => null);
    const found = res && res.ok ? ((await res.json()).address as { street: string; city: string; zip: string; county: string } | null) : null;
    if (found) setF((cur) => ({ ...cur, street: found.street, city: found.city, zip: found.zip, county: found.county }));
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok) return;
        const now = new Date().toISOString();
        const gdn = f.gdn.trim().toUpperCase().replace(/^P?\s*/, "P");
        const id = newId();
        await saveDealer({
          id,
          gdn,
          name: f.name.trim(),
          dba: "",
          street: f.street.trim(),
          city: f.city.trim(),
          state: "TX",
          zip: f.zip.trim(),
          county: canonicalCounty(f.county) ?? f.county.trim(),
          agentName: "",
          createdAt: now,
          lastUsedAt: now,
        });
        router.push(`/dealers/${id}`);
      }}
    >
      <Heading title={t("addByHand")} />
      <div className="mt-8 grid gap-3">
        <input className="field" placeholder={t("dealerName")} value={f.name} onChange={set("name")} autoFocus />
        <input className="field figure" placeholder={t("pNumber")} value={f.gdn} onChange={set("gdn")} />
        <input className="field" placeholder={t("street")} value={f.street} onChange={set("street")} onBlur={lookup} />
        <div className="grid grid-cols-2 gap-3">
          <input className="field" placeholder={t("city")} value={f.city} onChange={set("city")} />
          <input className="field figure" placeholder={t("zip")} value={f.zip} onChange={set("zip")} inputMode="numeric" />
        </div>
        <input className="field" placeholder={t("county")} value={f.county} onChange={set("county")} />
      </div>
      <button className="primary mt-6 w-full" disabled={!ok}>
        {t("done")}
      </button>
    </form>
  );
}
