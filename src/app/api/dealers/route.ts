import { directory } from "@/lib/dealers/directory";
import { searchDealers } from "@/lib/dealers/search";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const { index, asOf, count } = await directory();
  return Response.json(
    { asOf, count, dealers: searchDealers(index, q.slice(0, 80), 8) },
    { headers: { "cache-control": "public, max-age=3600" } },
  );
}
