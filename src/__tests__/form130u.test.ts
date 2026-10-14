import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { fill130U } from "@/lib/form130u/fill-pdf";
import { agreementFromSale } from "@/lib/form130u/from-sale";
import { DEALER, readySale } from "./fixtures";

async function filled(sale = readySale()) {
  const template = await readFile("public/forms/130-U.pdf");
  const bytes = await fill130U(agreementFromSale(sale, DEALER), template);
  return (await PDFDocument.load(bytes)).getForm();
}

describe("the filled 130-U", () => {
  it("prints the dealer's own GDN, not anyone else's", async () => {
    const form = await filled();
    expect(form.getTextField("21 Dealer GDN if applicable").getText()).toBe("P00001");
  });
  it("puts the dealer and its agent on the seller line", async () => {
    const form = await filled();
    expect(form.getTextField("Seller  Name").getText()).toBe("Example Motors LLC (Pat Example)");
  });
  it("fills the VIN and box 11 rounded up", async () => {
    const form = await filled();
    expect(form.getTextField("1 Vehicle Identification Number").getText()).toBe("1HGCM82633A004352");
    expect(form.getTextField("11 Empty Weight").getText()).toBe("3200");
  });
  it("ticks Not Actual for a mileage that is not real", async () => {
    const form = await filled(readySale({ odometerBrand: "not_actual" }));
    expect(form.getCheckBox("Not Actual").isChecked()).toBe(true);
  });
});
