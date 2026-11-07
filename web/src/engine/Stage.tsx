// <Stage>: a full-window pixel canvas.
// The scene is drawn into a small framebuffer (e.g. 480x270) and the browser scales the
// canvas up by a WHOLE number (2x, 3x, 4x ... ) with nearest-neighbour sampling, so
// every art pixel stays a crisp square at every screen size from 1280x720 to 4K.
import { useEffect, useRef } from "react";
import { Frame } from "./pixel";

export interface PointerInfo { x: number; y: number; type: "move" | "down" | "up" | "leave" | "click"; dx: number; dy: number; buttons: number }
export interface Scene {
  resize?(w: number, h: number, scale: number): void;
  draw(f: Frame, t: number, dt: number): void;
  pointer?(p: PointerInfo): void;
  wheel?(dy: number, x: number, y: number): void;
}
export interface View { scale: number; w: number; h: number }

export function pickScale(W: number, H: number) {
  // aim for roughly 480x270 art pixels; never below 2x so pixels read as pixels
  return Math.max(2, Math.floor(Math.min(W / 480, H / 270)));
}

export function Stage({ scene, onView, cursor }: { scene: Scene; onView?: (v: View) => void; cursor?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const viewRef = useRef<View>({ scale: 2, w: 0, h: 0 });

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    let frame = new Frame(1, 1);
    const resize = () => {
      const W = window.innerWidth, H = window.innerHeight;
      const s = pickScale(W, H);
      const w = Math.ceil(W / s), h = Math.ceil(H / s);
      cv.width = w; cv.height = h;
      cv.style.width = `${w * s}px`; cv.style.height = `${h * s}px`;
      frame = new Frame(w, h);
      viewRef.current = { scale: s, w, h };
      sceneRef.current.resize?.(w, h, s);
      onView?.(viewRef.current);
    };
    resize();
    window.addEventListener("resize", resize);
    let raf = 0, last = performance.now();
    const t0 = last;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      sceneRef.current.draw(frame, (now - t0) / 1000, dt);
      ctx.putImageData(frame.img, 0, 0);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    let lastX = 0, lastY = 0, downX = 0, downY = 0;
    const pos = (e: PointerEvent | MouseEvent) => {
      const r = cv.getBoundingClientRect(), s = viewRef.current.scale;
      return { x: Math.floor((e.clientX - r.left) / s), y: Math.floor((e.clientY - r.top) / s) };
    };
    const send = (e: PointerEvent, type: PointerInfo["type"]) => {
      const p = pos(e);
      sceneRef.current.pointer?.({ ...p, type, dx: p.x - lastX, dy: p.y - lastY, buttons: e.buttons });
      lastX = p.x; lastY = p.y;
    };
    const mv = (e: PointerEvent) => send(e, "move");
    const dn = (e: PointerEvent) => { const p = pos(e); downX = p.x; downY = p.y; lastX = p.x; lastY = p.y; cv.setPointerCapture(e.pointerId); send(e, "down"); };
    const up = (e: PointerEvent) => {
      const p = pos(e);
      send(e, "up");
      if (Math.abs(p.x - downX) + Math.abs(p.y - downY) < 3) sceneRef.current.pointer?.({ ...p, type: "click", dx: 0, dy: 0, buttons: 0 });
    };
    const lv = (e: PointerEvent) => send(e, "leave");
    const wh = (e: WheelEvent) => { e.preventDefault(); const p = pos(e); sceneRef.current.wheel?.(e.deltaY, p.x, p.y); };
    cv.addEventListener("pointermove", mv);
    cv.addEventListener("pointerdown", dn);
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointerleave", lv);
    cv.addEventListener("wheel", wh, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      cv.removeEventListener("pointermove", mv);
      cv.removeEventListener("pointerdown", dn);
      cv.removeEventListener("pointerup", up);
      cv.removeEventListener("pointerleave", lv);
      cv.removeEventListener("wheel", wh);
    };
  }, [onView]);

  return <canvas ref={ref} className="stage" style={{ cursor: cursor || "default" }} aria-hidden="true" />;
}
