/** The chart's plumbing: what it watches (size, visibility, theme, tab focus) and the pointer on its canvas. */

export interface BoxWatch {
  onResize: () => void;
  onVisible: (visible: boolean) => void;
  /** The theme or network changed (colours are re-read), or the tab came back. */
  onRepaint: (themeChanged: boolean) => void;
}

/** Watches the chart's box; returns the cleanup. */
export function watchBox(box: HTMLElement, w: BoxWatch): () => void {
  const ro = new ResizeObserver(() => w.onResize());
  ro.observe(box);
  const io = new IntersectionObserver(([e]) => w.onVisible(Boolean(e?.isIntersecting)));
  io.observe(box);
  const theme = new MutationObserver(() => w.onRepaint(true));
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-network"] });
  const vis = () => w.onRepaint(false);
  document.addEventListener("visibilitychange", vis);
  return () => {
    ro.disconnect();
    io.disconnect();
    theme.disconnect();
    document.removeEventListener("visibilitychange", vis);
  };
}

export interface PointerHandlers {
  /** x, y in CSS pixels from the canvas's top-left. */
  move: (x: number, y: number) => void;
  down: (x: number) => void;
  up: () => void;
  leave: () => void;
  /** Returns whether the wheel was used (then the page does not scroll). */
  wheel: (deltaY: number) => boolean;
}

/** Pointer and wheel on the canvas (the pointer is captured while dragging); returns the cleanup. */
export function attachPointer(canvas: HTMLCanvasElement, h: PointerHandlers): () => void {
  const at = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const move = (e: PointerEvent) => {
    const p = at(e);
    h.move(p.x, p.y);
  };
  const down = (e: PointerEvent) => {
    h.down(at(e).x);
    canvas.setPointerCapture(e.pointerId);
  };
  const wheel = (e: WheelEvent) => {
    if (h.wheel(e.deltaY)) e.preventDefault();
  };
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointerup", h.up);
  canvas.addEventListener("pointerleave", h.leave);
  canvas.addEventListener("wheel", wheel, { passive: false });
  return () => {
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerdown", down);
    canvas.removeEventListener("pointerup", h.up);
    canvas.removeEventListener("pointerleave", h.leave);
    canvas.removeEventListener("wheel", wheel);
  };
}
