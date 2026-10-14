import { decodeVin, isValidVin } from "@/lib/vehicles/nhtsa";
import { lookupCurbWeight } from "@/lib/vehicles/curb-weight-lookup";
import { bandText, gvwrBandFromDecode } from "@/lib/vehicles/gvwr";

/**
 * What the VIN says: year, make, model, body, the empty weight when NHTSA
 * knows it, and the weight class as a hint for the door sticker. Fails
 * soft: an unknown VIN returns what it can and she types the rest.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ vin: string }> }) {
  const { vin: raw } = await ctx.params;
  const vin = raw.replace(/\s+/g, "").toUpperCase();
  if (!isValidVin(vin)) return Response.json({ ok: false, reason: "badVin" }, { status: 400 });
  try {
    const decoded = await decodeVin(vin);
    const weight = await lookupCurbWeight(vin, decoded).catch(() => null);
    const band = gvwrBandFromDecode(decoded.gvwr, null);
    return Response.json(
      {
        ok: !!decoded.make,
        year: decoded.year ? String(decoded.year) : "",
        make: decoded.make,
        model: decoded.model,
        bodyStyle: decoded.bodyStyle ?? "",
        emptyWeight: weight ? String(weight.pounds) : "",
        gvwrBand: band ? bandText(band) : "",
      },
      { headers: { "cache-control": "public, max-age=86400" } },
    );
  } catch {
    return Response.json({ ok: false, reason: "lookupFailed" }, { status: 502 });
  }
}
