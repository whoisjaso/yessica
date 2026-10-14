/**
 * Finding a Texas dealer as she types.
 *
 * The directory is TxDMV's own list of GDN licensees (scripts/
 * sync-tx-dealers.mjs). She types whatever she has: part of the name, the
 * lot's DBA, the P number, the city. Each word must match somewhere; the
 * best matches come first: the P number exactly, then a name that starts
 * with what she typed, then a word in the name that does, then the rest.
 *
 * Pure: the rows come in as an argument, so it is tested without the file.
 */

/** [gdn, name, dba, street, city, zip, county, status, expires, licenseType, franchise] */
export type DirectoryRow = [string, string, string, string, string, string, string, string, string, string, number];

export type DirectoryDealer = {
  gdn: string;
  name: string;
  dba: string;
  street: string;
  city: string;
  zip: string;
  county: string;
  status: string;
  expires: string;
  licenseType: string;
  franchise: boolean;
};

export function readRow(row: DirectoryRow): DirectoryDealer {
  return {
    gdn: row[0],
    name: row[1],
    dba: row[2],
    street: row[3],
    city: row[4],
    zip: row[5],
    county: row[6],
    status: row[7],
    expires: row[8],
    licenseType: row[9],
    franchise: row[10] === 1,
  };
}

/** "llc", "inc." and punctuation tell dealers apart from nothing. */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "p 12345", "P-12345" and "12345" all read as the P number P12345. */
export function gdnKey(text: string): string | null {
  const m = /^\s*p?[\s-]*(\d{3,7})([a-z])?\s*$/i.exec(text);
  return m ? `P${m[1]}${(m[2] ?? "").toUpperCase()}` : null;
}

export type SearchIndex = { rows: DirectoryRow[]; hay: string[]; names: string[] };

export function buildIndex(rows: DirectoryRow[]): SearchIndex {
  return {
    rows,
    hay: rows.map((r) => ` ${fold([r[1], r[2], r[4], r[6], r[0]].join(" "))}`),
    names: rows.map((r) => `${fold(r[1])} | ${fold(r[2])}`),
  };
}

export function searchDealers(index: SearchIndex, query: string, limit = 8): DirectoryDealer[] {
  const q = fold(query);
  if (q.length < 2) return [];

  const gdn = gdnKey(query);
  if (gdn) {
    const exact = index.rows.filter((r) => r[0].toUpperCase() === gdn || r[0].toUpperCase().startsWith(gdn));
    if (exact.length) {
      return exact
        .sort((a, b) => (a[0].toUpperCase() === gdn ? -1 : 0) - (b[0].toUpperCase() === gdn ? -1 : 0))
        .slice(0, limit)
        .map(readRow);
    }
  }

  const words = q.split(" ");
  const scored: { at: number; score: number }[] = [];
  for (let i = 0; i < index.rows.length; i++) {
    const hay = index.hay[i];
    let ok = true;
    for (const w of words) {
      if (!hay.includes(w)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const names = index.names[i];
    let score = 0;
    if (names.startsWith(q) || names.includes(`| ${q}`)) score += 100;
    if (` ${names}`.includes(` ${q}`)) score += 40;
    for (const w of words) if (` ${names}`.includes(` ${w}`)) score += 10;
    if (/^active$/i.test(index.rows[i][7])) score += 5;
    if (/^motor vehicle$/i.test(index.rows[i][9])) score += 3;
    scored.push({ at: i, score });
  }
  scored.sort((a, b) => b.score - a.score || index.rows[a.at][1].localeCompare(index.rows[b.at][1]));
  return scored.slice(0, limit).map((s) => readRow(index.rows[s.at]));
}
