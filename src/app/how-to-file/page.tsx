"use client";

import { useDesk } from "@/components/desk";
import { Heading } from "@/components/bits";
import { sopSteps } from "@/lib/title/sop";

export default function HowToFile() {
  const { t, lang } = useDesk();
  const steps = sopSteps();
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <Heading title={t("howTitle")} line={t("howLead")} />
        <button type="button" className="ghost no-print shrink-0" onClick={() => window.print()}>
          {t("print")}
        </button>
      </div>
      <ol className="mt-10 flex flex-col">
        {steps.map((step, i) => (
          <li key={`${step.page}-${i}`} className="relative flex gap-5 pb-8 last:pb-0">
            {i < steps.length - 1 && <span className="absolute left-[19px] top-11 h-[calc(100%-2.75rem)] w-px bg-line" aria-hidden />}
            <span className="figure flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line-strong bg-raised text-[14px] font-medium">
              {i + 1}
            </span>
            <span className="pt-1.5">
              <span className="block text-[17px] font-medium">{step.title[lang]}</span>
              <span className="mt-1 block text-[15px] leading-relaxed text-muted">{step.say[lang]}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
