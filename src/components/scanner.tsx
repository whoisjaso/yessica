"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDesk } from "@/components/desk";
import { enhance, findPage, insetQuad, outputSize, scaleQuad, shrinkQuad, warp, type Look, type Point, type Quad, type Rgba } from "@/lib/scan/geometry";

/**
 * Scan a paper with the phone, the way the Notes app does: the camera
 * finds the page and outlines it, she taps the shutter, nudges a corner if
 * it missed, and the page comes out flat and clean. Several pages make one
 * document. Nothing leaves the phone here.
 */

const DETECT_SIDE = 320;
const MAX_SOURCE = 3000;

type Shot = { canvas: HTMLCanvasElement; url: string; quad: Quad };

function drawScaled(source: CanvasImageSource, sw: number, sh: number, longSide: number): HTMLCanvasElement {
  const k = Math.min(1, longSide / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * k));
  canvas.height = Math.max(1, Math.round(sh * k));
  canvas.getContext("2d", { willReadFrequently: true })!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function pixels(canvas: HTMLCanvasElement): Rgba {
  const img = canvas.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height);
  return { data: img.data, width: img.width, height: img.height };
}

function detect(canvas: HTMLCanvasElement): Quad | null {
  const small = drawScaled(canvas, canvas.width, canvas.height, DETECT_SIDE);
  const q = findPage(pixels(small));
  return q ? shrinkQuad(scaleQuad(q, canvas.width / small.width, canvas.height / small.height)) : null;
}

export function Scanner({ title, onDone, onCancel }: { title: string; onDone: (pages: Blob[]) => void; onCancel: () => void }) {
  const { t } = useDesk();
  const video = useRef<HTMLVideoElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState<"starting" | "on" | "off">("starting");
  const [live, setLive] = useState<{ quad: Quad; w: number; h: number } | null>(null);
  const [shot, setShot] = useState<Shot | null>(null);
  const [pages, setPages] = useState<{ blob: Blob; url: string }[]>([]);
  const [look, setLook] = useState<Look>("document");
  const [busy, setBusy] = useState(false);

  // The rear camera, as sharp as it will give.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera");
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 3840 }, height: { ideal: 2160 } },
        });
        if (stopped) return stream.getTracks().forEach((tr) => tr.stop());
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play().catch(() => {});
        }
        setCamera("on");
      } catch {
        setCamera("off");
      }
    })();
    return () => {
      stopped = true;
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  // While aiming: find the page a few times a second and outline it.
  useEffect(() => {
    if (camera !== "on" || shot) return;
    const timer = setInterval(() => {
      const v = video.current;
      if (!v || !v.videoWidth) return;
      const small = drawScaled(v, v.videoWidth, v.videoHeight, DETECT_SIDE);
      const q = findPage(pixels(small));
      setLive(q ? { quad: scaleQuad(q, v.videoWidth / small.width, v.videoHeight / small.height), w: v.videoWidth, h: v.videoHeight } : null);
    }, 280);
    return () => clearInterval(timer);
  }, [camera, shot]);

  // Lock the page behind the scanner from scrolling.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const take = useCallback((source: CanvasImageSource, w: number, h: number) => {
    const canvas = drawScaled(source, w, h, MAX_SOURCE);
    const quad = detect(canvas) ?? insetQuad(canvas.width, canvas.height);
    setShot({ canvas, url: canvas.toDataURL("image/jpeg", 0.85), quad });
  }, []);

  function shutter() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    take(v, v.videoWidth, v.videoHeight);
  }

  function fromFile(file: File) {
    const img = new Image();
    img.onload = () => {
      take(img, img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  }

  async function keep() {
    if (!shot) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 30)); // let "Making…" paint
    const size = outputSize(shot.quad, 1700);
    const flat = enhance(warp(pixels(shot.canvas), shot.quad, size.width, size.height), look);
    const out = document.createElement("canvas");
    out.width = flat.width;
    out.height = flat.height;
    out.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(flat.data), flat.width, flat.height), 0, 0);
    const blob = await new Promise<Blob>((resolve) => out.toBlob((b) => resolve(b!), "image/jpeg", 0.72));
    setPages((all) => [...all, { blob, url: URL.createObjectURL(blob) }]);
    setShot(null);
    setBusy(false);
  }

  const body = (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0d0c0a] text-[#f7f3ec]" role="dialog" aria-label={title} data-testid="scanner">
      <div className="flex items-center justify-between px-5 pb-3 pt-[max(16px,env(safe-area-inset-top))]">
        <button type="button" onClick={onCancel} className="text-[15px] text-[#cfc6b8]">
          {t("cancel")}
        </button>
        <p className="truncate px-3 text-[15px] font-medium">{title}</p>
        <button
          type="button"
          onClick={() => onDone(pages.map((p) => p.blob))}
          disabled={!pages.length || !!shot}
          className="text-[15px] font-semibold text-[#e0a77d] disabled:opacity-30"
          data-testid="scan-done"
        >
          {t("done")}
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        {/* The camera stays mounted under the adjust view, so it is warm for the next page. */}
        <video ref={video} playsInline muted className={`absolute inset-0 h-full w-full object-contain ${shot || camera !== "on" ? "invisible" : ""}`} />
        {!shot && camera === "on" && live && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${live.w} ${live.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
            <polygon
              points={live.quad.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="rgba(224,167,125,0.18)"
              stroke="#e0a77d"
              strokeWidth={Math.max(live.w, live.h) / 220}
              strokeLinejoin="round"
            />
          </svg>
        )}
        {!shot && camera === "off" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <p className="text-[15px] text-[#cfc6b8]">{t("cameraOff")}</p>
          </div>
        )}
        {shot && <Adjust shot={shot} onMove={(quad) => setShot({ ...shot, quad })} />}
      </div>

      {shot ? (
        <div className="px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-4">
          <div className="mb-4 flex justify-center gap-2">
            {(["document", "gray", "color"] as Look[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLook(l)}
                className={`rounded-full px-4 py-1.5 text-[13px] font-medium ${look === l ? "bg-[#f7f3ec] text-[#15130f]" : "bg-white/10 text-[#cfc6b8]"}`}
              >
                {t(l === "document" ? "lookDocument" : l === "gray" ? "lookGray" : "lookColor")}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => setShot(null)} className="rounded-full border border-white/20 px-6 py-3.5 text-[15px] font-medium">
              {t("retake")}
            </button>
            <button type="button" onClick={keep} disabled={busy} className="flex-1 rounded-full bg-[#f7f3ec] px-6 py-3.5 text-[15px] font-semibold text-[#15130f]" data-testid="scan-keep">
              {busy ? t("making") : t("keepScan")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-4">
          <div className="flex w-20 items-center">
            {pages.length > 0 && (
              <span className="relative block h-14 w-11 overflow-hidden rounded-md border border-white/30 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pages[pages.length - 1].url} alt="" className="h-full w-full object-cover" />
                <span className="figure absolute bottom-0 right-0 rounded-tl-md bg-[#8a4f2b] px-1.5 text-[11px] font-semibold text-white">{pages.length}</span>
              </span>
            )}
          </div>
          {camera === "on" ? (
            <button type="button" onClick={shutter} aria-label={t("scan")} className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-[3px] border-[#f7f3ec]" data-testid="shutter">
              <span className="block h-[60px] w-[60px] rounded-full bg-[#f7f3ec] transition-transform active:scale-90" />
            </button>
          ) : (
            <button type="button" onClick={() => fileInput.current?.click()} className="rounded-full bg-[#f7f3ec] px-7 py-4 text-[16px] font-semibold text-[#15130f]" data-testid="take-photo">
              {t("takePhoto")}
            </button>
          )}
          <div className="flex w-20 justify-end">
            {camera === "on" && (
              <button type="button" onClick={() => fileInput.current?.click()} className="text-[13px] text-[#cfc6b8] underline underline-offset-4">
                {t("photos")}
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            data-testid="scan-file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) fromFile(file);
              e.target.value = "";
            }}
          />
        </div>
      )}
    </div>
  );

  return createPortal(body, document.body);
}

/** The photo with four corners she can drag. */
function Adjust({ shot, onMove }: { shot: Shot; onMove: (quad: Quad) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef<number | null>(null);
  const { width: w, height: h } = shot.canvas;
  const r = Math.max(w, h) / 34;

  function toImage(e: React.PointerEvent): Point | null {
    const el = svg.current;
    const m = el?.getScreenCTM();
    if (!el || !m) return null;
    const p = el.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const q = p.matrixTransform(m.inverse());
    return { x: Math.max(0, Math.min(w, q.x)), y: Math.max(0, Math.min(h, q.y)) };
  }

  return (
    <div className="absolute inset-0 px-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={shot.url} alt="" className="absolute inset-0 h-full w-full object-contain" />
      <svg
        ref={svg}
        className="absolute inset-0 h-full w-full touch-none"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerMove={(e) => {
          if (dragging.current === null) return;
          const p = toImage(e);
          if (!p) return;
          const next = [...shot.quad] as Quad;
          next[dragging.current] = p;
          onMove(next);
        }}
        onPointerUp={() => (dragging.current = null)}
        onPointerCancel={() => (dragging.current = null)}
      >
        <polygon points={shot.quad.map((p) => `${p.x},${p.y}`).join(" ")} fill="rgba(224,167,125,0.16)" stroke="#e0a77d" strokeWidth={r / 6} strokeLinejoin="round" />
        {shot.quad.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={r * 1.8}
              fill="transparent"
              className="cursor-grab"
              onPointerDown={(e) => {
                dragging.current = i;
                (e.currentTarget.ownerSVGElement as SVGSVGElement).setPointerCapture(e.pointerId);
              }}
            />
            <circle cx={p.x} cy={p.y} r={r * 0.62} fill="#f7f3ec" stroke="#8a4f2b" strokeWidth={r / 5} pointerEvents="none" />
          </g>
        ))}
      </svg>
    </div>
  );
}
