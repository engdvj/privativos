import { useEffect, useRef, useState } from "react";

const CURSOR_RING_OFFSET_X = 8;
const CURSOR_RING_OFFSET_Y = 9;

export function CursorGlowOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const finePointer = window.matchMedia("(pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const syncEnabled = () => {
      setEnabled(finePointer.matches && !reducedMotion.matches);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      if (overlayRef.current) {
        overlayRef.current.style.setProperty("--cursor-x", `${event.clientX}px`);
        overlayRef.current.style.setProperty("--cursor-y", `${event.clientY}px`);
      }
      setVisible(true);
    };

    const hideGlow = () => setVisible(false);

    syncEnabled();

    finePointer.addEventListener("change", syncEnabled);
    reducedMotion.addEventListener("change", syncEnabled);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", hideGlow);
    window.addEventListener("blur", hideGlow);

    return () => {
      finePointer.removeEventListener("change", syncEnabled);
      reducedMotion.removeEventListener("change", syncEnabled);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerMove);
      window.removeEventListener("pointerleave", hideGlow);
      window.removeEventListener("blur", hideGlow);
    };
  }, []);

  if (!enabled) {
    return null;
  }

  return (
    <div ref={overlayRef} aria-hidden className="pointer-events-none fixed inset-0 z-[20]">
      <span
        className="absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-400/50 bg-sky-400/8 shadow-[0_0_0_1px_rgba(14,165,233,0.12)] transition-opacity duration-100"
        style={{
          left: `calc(var(--cursor-x, 50%) + ${CURSOR_RING_OFFSET_X}px)`,
          top: `calc(var(--cursor-y, 50%) + ${CURSOR_RING_OFFSET_Y}px)`,
          opacity: visible ? 1 : 0,
        }}
      />
    </div>
  );
}
