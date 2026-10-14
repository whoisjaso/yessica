"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useDesk } from "@/components/desk";
import { SaleTile } from "@/components/bits";
import { titleCase } from "@/components/dealer-search";
import { AGENT_NAME } from "@/lib/title/agent";
import { Guide } from "@/components/guide";

export default function DealerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, dealers, sales, saveDealer, ready } = useDesk();
  const dealer = dealers.find((d) => d.id === id);
  const [agent, setAgent] = useState("");
  const [saved, setSaved] = useState(false);
  const [other, setOther] = useState(false);

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
        <p className="text-[15px] font-medium">{t("whoSigns")}</p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            aria-pressed={!dealer.agentName}
            onClick={() => {
              setOther(false);
              setAgent("");
              if (dealer.agentName) void saveDealer({ ...dealer, agentName: "" });
            }}
            className="tile flex items-center justify-between px-5 py-4 text-left"
            data-guide="signer-me"
          >
            <span className="text-[17px] font-medium" data-own-content>
              {AGENT_NAME}
            </span>
            {!dealer.agentName && !other && <span className="text-[13px] font-semibold text-copper">✓</span>}
          </button>
          <button
            type="button"
            aria-pressed={!!dealer.agentName || other}
            onClick={() => setOther(true)}
            className="tile flex items-center justify-between px-5 py-4 text-left"
          >
            <span className="text-[17px] font-medium" data-own-content>
              {dealer.agentName || t("someoneElse")}
            </span>
            {!!dealer.agentName && <span className="text-[13px] font-semibold text-copper">✓</span>}
          </button>
        </div>
        {other && (
          <form
            className="mt-3 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await saveAgent();
              setOther(false);
            }}
          >
            <input className="field" value={agent} onChange={(e) => setAgent(e.target.value)} placeholder={t("fullName")} autoFocus autoComplete="off" />
            <button className="primary shrink-0" disabled={agent.trim().split(/\s+/).length < 2}>
              {t("done")}
            </button>
          </form>
        )}
        {saved && <p className="mt-2 text-[13px] text-ready">{t("saved")}</p>}
      </div>

      <Link href={`/new?dealer=${dealer.id}`} className="primary mt-8 inline-block" data-guide="sale-here">
        {t("saleForDealer")}
      </Link>

      {!other && <Guide target="sale-here" say={t("gSaleHere")} />}

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
