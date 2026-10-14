import { describe, expect, it } from "vitest";
import { bringList, saleState } from "@/lib/title/facts";
import { readySale } from "./fixtures";

describe("ready, waiting, filed", () => {
  it("a complete car sale is ready", () => {
    expect(saleState(readySale())).toEqual({ word: "ready" });
  });
  it("an SUV without its door-sticker GVWR waits on weights", () => {
    expect(saleState(readySale({ bodyStyle: "SUV" }))).toEqual({ word: "waiting", reason: "weightsFirst" });
    expect(saleState(readySale({ bodyStyle: "SUV", gvwr: "5000" }))).toEqual({ word: "ready" });
  });
  it("a missing county waits on the buyer", () => {
    const s = readySale();
    expect(saleState({ ...s, buyer: { ...s.buyer, county: "" } })).toEqual({ word: "waiting", reason: "buyerDetails" });
  });
  it("a salvage title waits on the title", () => {
    expect(saleState(readySale({ titleKind: "salvage" }))).toEqual({ word: "waiting", reason: "titleFirst" });
  });
  it("a receipt number is filed", () => {
    expect(saleState(readySale({ filedNumber: "123" }))).toEqual({ word: "filed" });
  });
});

describe("what to bring", () => {
  it("starts with the 130-U and the title", () => {
    const keys = bringList(readySale()).map((i) => i.key);
    expect(keys.slice(0, 2)).toEqual(["form130u", "title"]);
  });
  it("asks for 2290 proof at 55,000 lb (26 U.S.C. §4481)", () => {
    const heavy = readySale({ bodyStyle: "Truck", emptyWeight: "20000", emptyFrom: "typed", gvwr: "80000" });
    expect(bringList(heavy).some((i) => i.key === "hvut")).toBe(true);
    expect(bringList(readySale()).some((i) => i.key === "hvut")).toBe(false);
  });
  it("an out-of-state title into an emissions county brings the report last", () => {
    const list = bringList(readySale({ titleState: "OK", year: "2018" }));
    expect(list[list.length - 1].key).toBe("emissions");
  });
});
