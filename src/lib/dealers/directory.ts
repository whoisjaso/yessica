import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildIndex, type DirectoryRow, type SearchIndex } from "@/lib/dealers/search";

/**
 * The directory, loaded once per server instance. About three megabytes:
 * kept on the server so her phone never downloads it, only the eight
 * dealers that match what she typed.
 */
let loaded: Promise<{ index: SearchIndex; asOf: string; count: number }> | null = null;

export function directory() {
  loaded ??= readFile(join(process.cwd(), "data", "tx-dealers.json"), "utf8").then((text) => {
    const data = JSON.parse(text) as { asOf: string; dealers: DirectoryRow[] };
    return { index: buildIndex(data.dealers), asOf: data.asOf, count: data.dealers.length };
  });
  return loaded;
}
