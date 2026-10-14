"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { sfx } from "@/lib/sound";

/**
 * The walking tutorial.
 *
 * With the guide on, every screen names the one thing to tap next: a copper
 * ring circles it, glowing and turning, the rest of the screen dims, and one
 * short line says what to do. Tap it and the ring moves to the next thing.
 * Nothing is blocked: the ring only points. She can turn it off any time.
 *
 * Each screen decides its own next target (a `data-guide` name) from what
 * is already done, so the ring is never pointing at a step she finished.
 */

type GuideState = {
  on: boolean;
  setOn: (on: boolean) => void;
  /** Per-sale steps the data cannot show (she printed it, she opened webDEALER). */
  marks: (saleId: string) => Record<string, boolean>;
  mark: (saleId: string, key: string) => void;
};

const GuideContext = createContext<GuideState | null>(null);
const ON_KEY = "titledesk.guide";
const MARKS_KEY = "titledesk.guide.marks";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private window: remembered for this visit only
  }
}

export function GuideProvider({ children }: { children: ReactNode }) {
  // On until she turns it off: the first visit is always walked.
  const [on, setOnState] = useState(true);
  const [allMarks, setAllMarks] = useState<Record<string, Record<string, boolean>>>({});

  useEffect(() => {
    setOnState(read(ON_KEY, true));
    setAllMarks(read(MARKS_KEY, {}));
  }, []);

  const setOn = useCallback((next: boolean) => {
    setOnState(next);
    write(ON_KEY, next);
  }, []);

  const mark = useCallback((saleId: string, key: string) => {
    setAllMarks((cur) => {
      const next = { ...cur, [saleId]: { ...cur[saleId], [key]: true } };
      write(MARKS_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<GuideState>(
    () => ({ on, setOn, marks: (id) => allMarks[id] ?? {}, mark }),
    [on, setOn, allMarks, mark],
  );
  return <GuideContext.Provider value={value}>{children}</GuideContext.Provider>;
}

export function useGuide(): GuideState {
  const g = useContext(GuideContext);
  if (!g) throw new Error("useGuide outside GuideProvider");
  return g;
}

type Rect = { top: number; left: number; width: number; height: number };

/**
 * Point at `target` (a data-guide name) with `say`. Renders nothing when
 * the guide is off or the target is not on screen yet.
 */
export function Guide({ target, say, step }: { target: string | null; say: string; step?: string }) {
  const { on } = useGuide();
  const [rect, setRect] = useState<Rect | null>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const scrolledFor = useRef<string | null>(null);
  // The ring glides to a new target, but sticks to its target while the page scrolls.
  const [gliding, setGliding] = useState(false);
  useEffect(() => {
    setGliding(true);
    const t = setTimeout(() => setGliding(false), 420);
    return () => clearTimeout(t);
  }, [target]);

  // A soft chime each time the ring moves on to the next thing.
  const chimedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!on || !target || !rect || chimedFor.current === target) return;
    const first = chimedFor.current === null;
    chimedFor.current = target;
    if (!first) sfx.step();
  }, [on, target, rect]);

  useEffect(() => {
    if (!on || !target) {
      setRect(null);
      return;
    }
    let frame = 0;
    let last = "";
    const tick = () => {
      const el = document.querySelector<HTMLElement>(`[data-guide="${target}"]`);
      if (el && el.offsetParent !== null) {
        const r = el.getBoundingClientRect();
        const key = `${r.top|0},${r.left|0},${r.width|0},${r.height|0},${window.innerWidth},${window.innerHeight}`;
        if (key !== last) {
          last = key;
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
          setVp({ w: window.innerWidth, h: window.innerHeight });
        }
        // Bring it into view once per new target, gently.
        if (scrolledFor.current !== target) {
          scrolledFor.current = target;
          const off = r.top < 90 || r.bottom > window.innerHeight - 150;
          if (off) {
            // The page carries the target; the ring rides with it rather than chasing it.
            setGliding(false);
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
      } else if (last !== "none") {
        last = "none";
        setRect(null);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [on, target]);

  if (!on || !target || !rect || typeof document === "undefined") return null;

  const pad = 8;
  const box = {
    top: rect.top - pad,
    left: Math.max(4, rect.left - pad),
    width: Math.min(vp.w - 8, rect.width + pad * 2),
    height: rect.height + pad * 2,
  };
  const radius = Math.min(26, box.height / 2);
  // The line goes above the target, where it never covers the next button;
  // below only when there is no room above.
  const below = box.top < 150;
  const bubbleWidth = Math.min(340, vp.w - 32);
  const center = box.left + box.width / 2;
  const bubbleLeft = Math.max(16, Math.min(vp.w - bubbleWidth - 16, center - bubbleWidth / 2));
  const arrowLeft = Math.max(18, Math.min(bubbleWidth - 18, center - bubbleLeft));

  return createPortal(
    <div className={`guide-layer no-print ${gliding ? "is-gliding" : ""}`} aria-live="polite" data-testid="guide">
      {/* The dim around it, so the eye goes straight to the one thing. */}
      <div
        className="guide-spot"
        style={{ top: box.top, left: box.left, width: box.width, height: box.height, borderRadius: radius }}
      />
      {/* The ring: a copper arc that turns, and a glow that breathes. */}
      <div className="guide-ring" style={{ top: box.top, left: box.left, width: box.width, height: box.height, borderRadius: radius }}>
        <span className="guide-ring-spin" style={{ borderRadius: radius }} />
        <span className="guide-ring-pulse" style={{ borderRadius: radius }} />
      </div>
      <div
        className={`guide-bubble ${below ? "is-below" : "is-above"}`}
        style={{
          left: bubbleLeft,
          width: bubbleWidth,
          ...(below ? { top: box.top + box.height + 14 } : { bottom: vp.h - box.top + 14 }),
        }}
        data-testid="guide-bubble"
      >
        <span className="guide-arrow" style={{ left: arrowLeft }} aria-hidden />
        {step && <span className="guide-step">{step}</span>}
        <span className="guide-say">{say}</span>
      </div>
    </div>,
    document.body,
  );
}
