"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useDesk } from "@/components/desk";
import { SaleTile } from "@/components/bits";
import { titleCase } from "@/components/dealer-search";

export default function DealerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, dealers, sales, saveDealer, ready } = useDesk();
  const dealer = dealers.find((d) => d.id === id);
  const [agent, setAgent] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (dealer) setAgent(dealer.agentName);
  }, [dealer]);

  if (!dealer) return ready ? <p className="text-muted">—</p> : null;
  const open = sales.filter((s) => s.dealerId === dealer.id && !s.filedNumber);

  async function saveAgent() {
    if (!dealer || agent.trim() === dealer.agentName) return;
    await saveDealer({ ...dealer, agentName: agent.trim().replace(/\s+/g, " ") });
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  }

  return (
    <div>
      <p className="figure text-[15px] font-medium text-copper" data-own-content>
        {dealer.gdn}
      </p>
      <h1 className="display mt-2 text-[40px] sm:text-[52px]" data-own-content>
        {titleCase(dealer.dba ? dealer.dba.split(",")[0] : dealer.name)}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted" data-own-content>
        {dealer.dba ? (
          <>
            {dealer.name}
            <br />
          </>
        ) : null}
        {titleCase(dealer.street)}, {dealer.city}, {dealer.state} {dealer.zip}
        <br />
        {dealer.county} County
      </p>

      <div className="mt-8">
        <label className="block text-[15px] font-medium" htmlFor="agent">
          {t("whoSigns")}
        </label>
        <p className="mt-1 text-[13px] text-faint">{t("whoSignsHint")}</p>
        <div className="mt-3 flex items-center gap-3">
          <input
            id="agent"
            className="field"
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            onBlur={saveAgent}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
            autoComplete="off"
          />
          {saved && <span className="text-[13px] text-ready">{t("saved")}</span>}
        </div>
      </div>

      <Link href={`/new?dealer=${dealer.id}`} className="primary mt-8 inline-block">
        {t("saleForDealer")}
      </Link>

      {open.length > 0 && (
        <section className="mt-10">
          <p className="eyebrow">{t("toFile", { n: open.length })}</p>
          <ul className="mt-3 flex flex-col gap-3">
            {open.map((s) => (
              <li key={s.id}>
                <SaleTile sale={s} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
