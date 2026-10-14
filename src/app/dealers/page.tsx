"use client";

import { useRouter } from "next/navigation";
import { useDesk } from "@/components/desk";
import { Heading } from "@/components/bits";
import { DealerSearch } from "@/components/dealer-search";

export default function Dealers() {
  const { t } = useDesk();
  const router = useRouter();
  return (
    <div>
      <Heading title={t("navDealers")} />
      <div className="mt-8">
        <DealerSearch onPick={(d) => router.push(`/dealers/${d.id}`)} guided />
      </div>
    </div>
  );
}
