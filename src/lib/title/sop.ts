/**
 * How To File: her SOP, built from the webDEALER page order so it cannot
 * drift from the copy list. A test fails when a webDEALER page has no step
 * or a step names a page that does not exist.
 */

import { HANDOFF_PAGES, type HandoffPage } from "@/lib/title/webdealer";

export type SopStep = { page: HandoffPage | "before" | "after"; title: { en: string; es: string }; say: { en: string; es: string } };

const PAGE_SAYS: Record<HandoffPage, { en: string; es: string }> = {
  plateVehicle: { en: "In ePLATE, assign a plate. Paste VIN, color, class and weights.", es: "En ePLATE, asigne placa. Pegue VIN, color, clase y pesos." },
  plateOwner: { en: "Paste the buyer's name and address. Write the plate number in Title Desk.", es: "Pegue nombre y dirección. Anote la placa en Title Desk." },
  start: { en: "Start a new title application with the VIN.", es: "Empiece una solicitud de título con el VIN." },
  sellerDisclosure: { en: "Paste ID, price and odometer. Save this page first.", es: "Pegue ID, precio y odómetro. Guarde esta página primero." },
  vehicle: { en: "Check year, make and model. Paste color and weights.", es: "Revise año, marca y modelo. Pegue color y pesos." },
  lienholder: { en: "Pick the lienholder, or No Lien.", es: "Elija el gravamen, o Sin Gravamen." },
  owner: { en: "Paste owner type, name, address and county.", es: "Pegue tipo, nombre, dirección y condado." },
  plates: { en: "Enter the plate from ePLATE.", es: "Ponga la placa de ePLATE." },
  salesTax: { en: "Sales tax category and date.", es: "Categoría y fecha del impuesto." },
  documents: { en: "Upload in the Bring order: 130-U first.", es: "Suba en el orden de Llevar: 130-U primero." },
  inspection: { en: "Check the emissions line. Then submit.", es: "Revise la línea de emisiones. Luego envíe." },
};

export function sopSteps(): SopStep[] {
  return [
    {
      page: "before",
      title: { en: "Open The Sale", es: "Abra La Venta" },
      say: { en: "In Title Desk, open the sale. Print the 130-U and get it signed.", es: "En Title Desk, abra la venta. Imprima la 130-U y fírmela." },
    },
    {
      page: "before",
      title: { en: "Log In As The Dealer", es: "Entre Como El Dealer" },
      say: { en: "Log in to webDEALER. Pick this dealer's account.", es: "Entre a webDEALER. Elija la cuenta de este dealer." },
    },
    ...HANDOFF_PAGES.map(({ page, title, es }) => ({ page, title: { en: title, es }, say: PAGE_SAYS[page] })),
    {
      page: "after",
      title: { en: "Mark It Filed", es: "Márquelo Registrado" },
      say: { en: "Copy the receipt number into Filed. The clock stops.", es: "Copie el número de recibo en Registrado. El reloj se para." },
    },
  ];
}
