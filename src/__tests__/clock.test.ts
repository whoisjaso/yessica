import { describe, expect, it } from "vitest";
import { titleClock } from "@/lib/title/clock";
import { readySale } from "./fixtures";

describe("the title clock", () => {
  it("counts 30 calendar days from the sale (Transp. Code §501.0234)", () => {
    const c = titleClock(readySale({ saleDate: "2026-10-01" }), "2026-10-14");
    expect(c.dueOn).toBe("2026-10-31");
    expect(c.daysLeft).toBe(17);
    expect(c.stage).toBe("open");
  });
  it("gives 45 days when the dealer carries the note", () => {
    const c = titleClock(readySale({ saleDate: "2026-10-01", lien: { holder: "dealer", name: "" } }), "2026-10-14");
    expect(c.dueOn).toBe("2026-11-15");
  });
  it("a bank lien does not change the clock", () => {
    expect(titleClock(readySale({ lien: { holder: "lender", name: "A Bank" } }), "2026-10-01").windowDays).toBe(30);
  });
  it("goes overdue, and stops once filed", () => {
    expect(titleClock(readySale(), "2026-11-02").stage).toBe("overdue");
    expect(titleClock(readySale({ filedNumber: "R1" }), "2026-11-02").stage).toBe("filed");
  });
});
