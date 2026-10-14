/**
 * The Texas dealer directory, refreshed from TxDMV.
 *
 * TxDMV publishes every active GDN licensee (the "P number") as a
 * spreadsheet, updated daily, on its public licensee list:
 *   https://texasdmv.my.salesforce-sites.com/dealers/motorvehicledealerliststaging
 * This script reads the download link off that page, fetches the
 * spreadsheet and writes data/tx-dealers.json, the file the dealer search
 * reads. Run it whenever you want today's list:  npm run dealers:sync
 *
 * Only the business record is kept: licence number, names, the licensed
 * address, county, status and expiry, licence type and franchise flag.
 * Phone numbers, emails and bond companies are left behind on purpose:
 * the app needs to know who the dealer is and where, nothing about how to
 * contact the people behind it.
 *
 * Usage: node scripts/sync-tx-dealers.mjs [path-to-downloaded.xls]
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import XLSX from "xlsx";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LIST_PAGE = "https://texasdmv.my.salesforce-sites.com/dealers/motorvehicledealerliststaging";
const ORIGIN = "https://texasdmv.my.salesforce-sites.com";

async function download() {
  const page = await fetch(LIST_PAGE, { signal: AbortSignal.timeout(60_000) });
  if (!page.ok) throw new Error(`TxDMV list page answered ${page.status}`);
  const html = await page.text();
  const href = /\/dealers\/servlet\/servlet\.FileDownload\?[^"']+/.exec(html)?.[0]?.replace(/&amp;/g, "&");
  if (!href) throw new Error("No download link on the TxDMV list page. Has the page changed?");
  const asOf = /current as of\s*([\d/]+)/i.exec(html.replace(/<[^>]+>/g, " "))?.[1] ?? null;
  const file = await fetch(ORIGIN + href, { signal: AbortSignal.timeout(300_000) });
  if (!file.ok) throw new Error(`TxDMV spreadsheet answered ${file.status}`);
  return { bytes: Buffer.from(await file.arrayBuffer()), asOf };
}

const clean = (v) => (v === undefined || v === null ? "" : String(v).replace(/[\t\r\n]+/g, " ").replace(/\s+/g, " ").trim());

function toIsoDate(us) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(clean(us));
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : "";
}

async function main() {
  const local = process.argv[2];
  const { bytes, asOf } = local ? { bytes: await readFile(local), asOf: null } : await download();
  const book = XLSX.read(bytes, { type: "buffer" });
  const sheet = book.Sheets[book.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  const key = (row, name) => Object.keys(row).find((k) => k.replace(/\s+/g, "").toLowerCase() === name.toLowerCase());

  const dealers = [];
  const seen = new Set();
  for (const row of rows) {
    const get = (name) => clean(row[key(row, name) ?? name]);
    const gdn = get("LicenseNumber").toUpperCase();
    const name = get("BusinessName");
    if (!gdn || !name || seen.has(gdn)) continue;
    seen.add(gdn);
    // Compact tuple; the order is the contract with src/lib/dealers/directory.ts.
    dealers.push([
      gdn,
      name,
      get("DBAName"),
      get("PhysicalAddress"),
      get("City"),
      get("Zip").slice(0, 10),
      get("County"),
      get("LicenseStatus"),
      toIsoDate(get("LicenseExpDate")),
      get("LicenseType"),
      /franchise/i.test(get("DealerType")) ? 1 : 0,
    ]);
  }
  dealers.sort((a, b) => a[1].localeCompare(b[1]));
  const today = new Date().toISOString().slice(0, 10);
  const out = {
    source: LIST_PAGE,
    asOf: asOf ? toIsoDate(asOf) || today : today,
    fields: ["gdn", "name", "dba", "street", "city", "zip", "county", "status", "expires", "licenseType", "franchise"],
    dealers,
  };
  await writeFile(join(ROOT, "data", "tx-dealers.json"), JSON.stringify(out));
  console.log(`Wrote ${dealers.length} Texas dealers (as of ${out.asOf}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
