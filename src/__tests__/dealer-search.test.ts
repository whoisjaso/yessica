import { describe, expect, it } from "vitest";
import { buildIndex, gdnKey, searchDealers, type DirectoryRow } from "@/lib/dealers/search";

const rows: DirectoryRow[] = [
  ["P00001", "EXAMPLE MOTORS LLC", "", "1 A St", "HOUSTON", "77001", "Harris", "Active", "2027-10-31", "Motor Vehicle", 0],
  ["P00002", "SAMPLE AUTO GROUP INC", "SAMPLE HONDA", "2 B St", "DALLAS", "75201", "Dallas", "Active", "2027-10-31", "Motor Vehicle", 1],
  ["P00123", "MOTORS OF EXAMPLE", "", "3 C St", "AUSTIN", "78701", "Travis", "Expired", "2025-01-31", "Motor Vehicle", 0],
  ["P01234X", "TRAILER PLACE", "", "4 D St", "WACO", "76701", "McLennan", "Active", "2027-10-31", "Utility Trailer/Semi-Trailer", 0],
];
const index = buildIndex(rows);

describe("finding a Texas dealer", () => {
  it("reads a P number however it is typed", () => {
    expect(gdnKey("p 1")).toBeNull();
    expect(gdnKey("P-00123")).toBe("P00123");
    expect(gdnKey("00123")).toBe("P00123");
    expect(gdnKey("p01234x")).toBe("P01234X");
  });
  it("finds by P number first", () => {
    expect(searchDealers(index, "P00123")[0].gdn).toBe("P00123");
  });
  it("finds by DBA", () => {
    expect(searchDealers(index, "sample honda")[0].gdn).toBe("P00002");
  });
  it("puts a name that starts with the words first", () => {
    expect(searchDealers(index, "example motors").map((d) => d.gdn)[0]).toBe("P00001");
  });
  it("matches every word, across name and city", () => {
    expect(searchDealers(index, "motors austin").map((d) => d.gdn)).toEqual(["P00123"]);
  });
  it("needs two letters", () => {
    expect(searchDealers(index, "e")).toEqual([]);
  });
});
