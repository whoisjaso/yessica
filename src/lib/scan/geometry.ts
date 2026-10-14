/**
 * The scanner's arithmetic, kept pure so it is tested without a camera.
 *
 *   findPage    where the sheet of paper is in a photo: the largest bright
 *               region (paper on a darker desk), reduced to four corners.
 *   warp        that quadrilateral flattened into an upright rectangle (a
 *               projective transform, so a page shot at an angle comes out
 *               square, the way the Notes app does it).
 *   enhance     the flat page cleaned up: shadows and the yellow of indoor
 *               light divided out, so ink is black and paper is white.
 *
 * Images are plain RGBA arrays (the shape of canvas ImageData).
 */

export type Point = { x: number; y: number };
/** Top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point];

export type Rgba = { data: Uint8ClampedArray; width: number; height: number };

export function toGray(img: Rgba): Float32Array {
  const out = new Float32Array(img.width * img.height);
  const d = img.data;
  for (let i = 0, p = 0; i < out.length; i++, p += 4) out[i] = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
  return out;
}

/** Otsu's threshold: the gray level that best splits paper from background. */
export function otsu(gray: Float32Array): number {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[Math.max(0, Math.min(255, gray[i] | 0))]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/** A default frame, slightly inside the photo, for when no page is found. */
export function insetQuad(width: number, height: number, inset = 0.06): Quad {
  const dx = width * inset;
  const dy = height * inset;
  return [
    { x: dx, y: dy },
    { x: width - dx, y: dy },
    { x: width - dx, y: height - dy },
    { x: dx, y: height - dy },
  ];
}

/**
 * The page's corners in a (small) image, or null when nothing page-like is
 * there. Takes the largest connected bright region and picks its extreme
 * points along the two diagonals.
 */
export function findPage(img: Rgba): Quad | null {
  const { width: w, height: h } = img;
  const gray = toGray(img);
  const t = otsu(gray);
  const bright = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++) bright[i] = gray[i] > t ? 1 : 0;

  // Largest 4-connected bright region.
  const label = new Int32Array(w * h).fill(-1);
  const stack = new Int32Array(w * h);
  let bestId = -1;
  let bestSize = 0;
  let id = 0;
  for (let start = 0; start < bright.length; start++) {
    if (!bright[start] || label[start] !== -1) continue;
    let top = 0;
    stack[top++] = start;
    label[start] = id;
    let size = 0;
    while (top) {
      const p = stack[--top];
      size++;
      const x = p % w;
      const y = (p / w) | 0;
      if (x > 0 && bright[p - 1] && label[p - 1] === -1) (label[p - 1] = id), (stack[top++] = p - 1);
      if (x < w - 1 && bright[p + 1] && label[p + 1] === -1) (label[p + 1] = id), (stack[top++] = p + 1);
      if (y > 0 && bright[p - w] && label[p - w] === -1) (label[p - w] = id), (stack[top++] = p - w);
      if (y < h - 1 && bright[p + w] && label[p + w] === -1) (label[p + w] = id), (stack[top++] = p + w);
    }
    if (size > bestSize) {
      bestSize = size;
      bestId = id;
    }
    id++;
  }
  const share = bestSize / (w * h);
  if (bestId < 0 || share < 0.12 || share > 0.97) return null;

  let tl = { x: 0, y: 0, s: Infinity };
  let br = { x: 0, y: 0, s: -Infinity };
  let tr = { x: 0, y: 0, s: -Infinity };
  let bl = { x: 0, y: 0, s: Infinity };
  for (let p = 0; p < label.length; p++) {
    if (label[p] !== bestId) continue;
    const x = p % w;
    const y = (p / w) | 0;
    const sum = x + y;
    const diff = x - y;
    if (sum < tl.s) tl = { x, y, s: sum };
    if (sum > br.s) br = { x, y, s: sum };
    if (diff > tr.s) tr = { x, y, s: diff };
    if (diff < bl.s) bl = { x, y, s: diff };
  }
  const quad: Quad = [
    { x: tl.x, y: tl.y },
    { x: tr.x + 1, y: tr.y },
    { x: br.x + 1, y: br.y + 1 },
    { x: bl.x, y: bl.y + 1 },
  ];
  // A sliver is not a page.
  return quadArea(quad) / (w * h) < 0.1 ? null : quad;
}

export function quadArea(q: Quad): number {
  let a = 0;
  for (let i = 0; i < 4; i++) {
    const p = q[i];
    const n = q[(i + 1) % 4];
    a += p.x * n.y - n.x * p.y;
  }
  return Math.abs(a) / 2;
}

export function scaleQuad(q: Quad, sx: number, sy = sx): Quad {
  return q.map((p) => ({ x: p.x * sx, y: p.y * sy })) as Quad;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** The flat page's size: the quad's own proportions, long side `longSide`. */
export function outputSize(q: Quad, longSide = 1700): { width: number; height: number } {
  const w = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2;
  const h = (dist(q[0], q[3]) + dist(q[1], q[2])) / 2;
  if (w <= 0 || h <= 0) return { width: longSide, height: longSide };
  const k = longSide / Math.max(w, h);
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

/**
 * The 3x3 homography taking the rectangle (0,0)-(W,H) onto the quad, as
 * eight numbers (the ninth is 1). Solved directly from the four corner pairs.
 */
export function rectToQuad(width: number, height: number, q: Quad): number[] {
  const src: Point[] = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = q[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  return solve(A, b);
}

function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[pivot][c])) pivot = r;
    [M[c], M[pivot]] = [M[pivot], M[c]];
    const div = M[c][c] || 1e-12;
    for (let k = c; k <= n; k++) M[c][k] /= div;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      if (!f) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row) => row[n]);
}

/** The quad in `src` flattened to an upright `width` x `height` image (bilinear). */
export function warp(src: Rgba, q: Quad, width: number, height: number): Rgba {
  const [a, b, c, d, e, f, g, h] = rectToQuad(width, height, q);
  const out = new Uint8ClampedArray(width * height * 4);
  const sw = src.width;
  const sh = src.height;
  const s = src.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const den = g * x + h * y + 1;
      const u = (a * x + b * y + c) / den;
      const v = (d * x + e * y + f) / den;
      const o = (y * width + x) * 4;
      const x0 = Math.max(0, Math.min(sw - 2, Math.floor(u)));
      const y0 = Math.max(0, Math.min(sh - 2, Math.floor(v)));
      const fx = Math.max(0, Math.min(1, u - x0));
      const fy = Math.max(0, Math.min(1, v - y0));
      const p00 = (y0 * sw + x0) * 4;
      const p10 = p00 + 4;
      const p01 = p00 + sw * 4;
      const p11 = p01 + 4;
      for (let k = 0; k < 3; k++) {
        const top = s[p00 + k] + (s[p10 + k] - s[p00 + k]) * fx;
        const bot = s[p01 + k] + (s[p11 + k] - s[p01 + k]) * fx;
        out[o + k] = top + (bot - top) * fy;
      }
      out[o + 3] = 255;
    }
  }
  return { data: out, width, height };
}

export type Look = "document" | "gray" | "color";

/** A box blur of a small gray image, for the paper's own shading. */
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let acc = 0;
    let n = 0;
    for (let x = -r; x < w + r; x++) {
      if (x + r < w && x + r >= 0) (acc += src[y * w + x + r]), n++;
      if (x - r - 1 >= 0 && x - r - 1 < w) (acc -= src[y * w + x - r - 1]), n--;
      if (x >= 0 && x < w) tmp[y * w + x] = acc / Math.max(1, n);
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    let n = 0;
    for (let y = -r; y < h + r; y++) {
      if (y + r < h && y + r >= 0) (acc += tmp[(y + r) * w + x]), n++;
      if (y - r - 1 >= 0 && y - r - 1 < h) (acc -= tmp[(y - r - 1) * w + x]), n--;
      if (y >= 0 && y < h) out[y * w + x] = acc / Math.max(1, n);
    }
  }
  return out;
}

/**
 * "document": shading divided out, then levels, gray ink on white paper.
 * "gray": the same without the hard levels. "color": shading lifted only.
 */
export function enhance(img: Rgba, look: Look = "document"): Rgba {
  const { width: w, height: h } = img;
  const gray = toGray(img);
  // The paper's light, estimated on a small copy so it ignores the ink.
  const step = 8;
  const sw = Math.max(1, Math.ceil(w / step));
  const sh = Math.max(1, Math.ceil(h / step));
  const small = new Float32Array(sw * sh);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      // The brightest sample in the cell is paper, not ink.
      let m = 0;
      for (let yy = y * step; yy < Math.min(h, (y + 1) * step); yy += 2)
        for (let xx = x * step; xx < Math.min(w, (x + 1) * step); xx += 2) m = Math.max(m, gray[yy * w + xx]);
      small[y * sw + x] = m;
    }
  }
  const light = boxBlur(small, sw, sh, 3);
  const out = new Uint8ClampedArray(w * h * 4);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const ly = Math.min(sh - 1, (y / step) | 0);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const o = i * 4;
      const bg = Math.max(40, light[ly * sw + Math.min(sw - 1, (x / step) | 0)]);
      if (look === "color") {
        for (let k = 0; k < 3; k++) out[o + k] = Math.min(255, (d[o + k] / bg) * 245);
      } else {
        let v = (gray[i] / bg) * 255;
        if (look === "document") v = ((v - 90) * 255) / (225 - 90);
        out[o] = out[o + 1] = out[o + 2] = v;
      }
      out[o + 3] = 255;
    }
  }
  return { data: out, width: w, height: h };
}

/** Corners pulled slightly toward the middle, so no sliver of desk rides along. */
export function shrinkQuad(q: Quad, by = 0.012): Quad {
  const cx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4;
  const cy = (q[0].y + q[1].y + q[2].y + q[3].y) / 4;
  return q.map((p) => ({ x: p.x + (cx - p.x) * by * 2, y: p.y + (cy - p.y) * by * 2 })) as Quad;
}
