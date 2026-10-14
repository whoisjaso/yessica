import { describe, expect, it } from "vitest";
import { HANDOFF_PAGES, buildHandoff, missingFields, splitZip } from "@/lib/title/webdealer";
import { sopSteps } from "@/lib/title/sop";
import { DEALER, readySale } from "./fixtures";

describe("the webDEALER copy list", () => {
  it("follows webDEALER's page order", () => {
    const fields = buildHandoff(readySale(), DEALER);
    const order = HANDOFF_PAGES.map((p) => p.page);
    const seen = fields.map((f) => order.indexOf(f.page));
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });
  it("is complete for a ready sale", () => {
    expect(missingFields(buildHandoff(readySale(), DEALER))).toEqual([]);
  });
  it("rounds box 11 up to the next 100 lb", () => {
    const f = buildHandoff(readySale(), DEALER).find((x) => x.key === "emptyWeight");
    expect(f?.value).toBe("3200");
  });
  it("holds the weights while box 12 is blank", () => {
    const rows = buildHandoff(readySale({ bodyStyle: "SUV" }), DEALER).filter((x) => x.key === "carryingCapacity");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.holds && r.value === null)).toBe(true);
  });
  it("derives box 12 from the GVWR, never typed", () => {
    const f = buildHandoff(readySale({ bodyStyle: "SUV", gvwr: "5000" }), DEALER).find((x) => x.key === "carryingCapacity");
    expect(f?.value).toBe("1800");
  });
  it("names the dealer as lienholder when it carries the note", () => {
    const f = buildHandoff(readySale({ lien: { holder: "dealer", name: "" } }), DEALER).find((x) => x.key === "lienholder");
    expect(f?.value).toBe(DEALER.name);
  });
  it("never invents a ZIP+4", () => {
    expect(splitZip("77505")).toEqual({ zip: "77505", plus4: null });
    expect(splitZip("77505-1234")).toEqual({ zip: "77505", plus4: "1234" });
  });
});

describe("How To File", () => {
  it("has a step for every webDEALER page and no page that is not one", () => {
    const pages = new Set(HANDOFF_PAGES.map((p) => p.page));
    const steps = sopSteps().filter((s) => s.page !== "before" && s.page !== "after");
    expect(steps.map((s) => s.page)).toEqual([...pages]);
    for (const s of sopSteps()) expect(s.say.en && s.say.es && s.title.en && s.title.es).toBeTruthy();
  });
});
