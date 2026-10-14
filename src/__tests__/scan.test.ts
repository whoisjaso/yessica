import { describe, expect, it } from "vitest";
import { enhance, findPage, otsu, outputSize, rectToQuad, warp, type Quad, type Rgba } from "@/lib/scan/geometry";

/** A dark desk with a white, slightly tilted sheet on it. */
function photo(): { img: Rgba; quad: Quad } {
  const width = 200;
  const height = 260;
  const quad: Quad = [
    { x: 40, y: 30 },
    { x: 165, y: 45 },
    { x: 155, y: 230 },
    { x: 30, y: 215 },
  ];
  const data = new Uint8ClampedArray(width * height * 4);
  const inside = (x: number, y: number) => {
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const a = quad[i];
      const b = quad[(i + 1) % 4];
      const c = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
      if (c !== 0) {
        if (sign && Math.sign(c) !== sign) return false;
        sign = Math.sign(c);
      }
    }
    return true;
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const v = inside(x + 0.5, y + 0.5) ? 235 : 60;
      data[o] = data[o + 1] = data[o + 2] = v;
      data[o + 3] = 255;
    }
  return { img: { data, width, height }, quad };
}

describe("the scanner", () => {
  it("splits paper from desk", () => {
    const { img } = photo();
    const t = otsu(new Float32Array(Array.from({ length: img.width * img.height }, (_, i) => img.data[i * 4])));
    expect(t).toBeGreaterThanOrEqual(60);
    expect(t).toBeLessThan(235);
  });
  it("finds the sheet's four corners", () => {
    const { img, quad } = photo();
    const found = findPage(img)!;
    expect(found).not.toBeNull();
    found.forEach((p, i) => {
      expect(Math.abs(p.x - quad[i].x)).toBeLessThan(4);
      expect(Math.abs(p.y - quad[i].y)).toBeLessThan(4);
    });
  });
  it("finds nothing on a blank desk", () => {
    const data = new Uint8ClampedArray(100 * 100 * 4).fill(80);
    expect(findPage({ data, width: 100, height: 100 })).toBeNull();
  });
  it("maps the rectangle's corners onto the quad", () => {
    const q: Quad = [{ x: 10, y: 5 }, { x: 90, y: 12 }, { x: 95, y: 120 }, { x: 4, y: 110 }];
    const [a, b, c, d, e, f, g, h] = rectToQuad(50, 70, q);
    const map = (x: number, y: number) => {
      const den = g * x + h * y + 1;
      return { x: (a * x + b * y + c) / den, y: (d * x + e * y + f) / den };
    };
    expect(map(0, 0).x).toBeCloseTo(10);
    expect(map(50, 70).y).toBeCloseTo(120);
    expect(map(0, 70).x).toBeCloseTo(4);
  });
  it("flattens the sheet to all paper, then cleans it to white", () => {
    const { img, quad } = photo();
    const size = outputSize(quad, 120);
    expect(size.height).toBeGreaterThan(size.width);
    const flat = warp(img, quad, size.width, size.height);
    const center = ((size.height >> 1) * size.width + (size.width >> 1)) * 4;
    expect(flat.data[center]).toBeGreaterThan(200);
    const clean = enhance(flat, "document");
    expect(clean.data[center]).toBe(255);
  });
});
