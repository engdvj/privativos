import { useEffect, useRef, useState } from "react";

type CursorVariant =
  | "default"
  | "pointer"
  | "text"
  | "move"
  | "resize"
  | "not-allowed"
  | "help"
  | "wait"
  | "crosshair";

type CursorPaint = {
  border: string;
  fill: string;
  halo: string;
};

const CURSOR_VARIANT_STYLE: Record<CursorVariant, CursorPaint> = {
  default: {
    border: "rgba(56, 189, 248, 0.9)",
    fill: "rgba(125, 211, 252, 0.9)",
    halo: "rgba(56, 189, 248, 0.35)",
  },
  pointer: {
    border: "rgba(34, 197, 94, 0.9)",
    fill: "rgba(134, 239, 172, 0.92)",
    halo: "rgba(34, 197, 94, 0.35)",
  },
  text: {
    border: "rgba(250, 204, 21, 0.9)",
    fill: "rgba(254, 240, 138, 0.92)",
    halo: "rgba(250, 204, 21, 0.35)",
  },
  move: {
    border: "rgba(168, 85, 247, 0.9)",
    fill: "rgba(216, 180, 254, 0.92)",
    halo: "rgba(168, 85, 247, 0.34)",
  },
  resize: {
    border: "rgba(251, 146, 60, 0.9)",
    fill: "rgba(254, 215, 170, 0.92)",
    halo: "rgba(251, 146, 60, 0.35)",
  },
  "not-allowed": {
    border: "rgba(248, 113, 113, 0.92)",
    fill: "rgba(254, 202, 202, 0.92)",
    halo: "rgba(248, 113, 113, 0.36)",
  },
  help: {
    border: "rgba(129, 140, 248, 0.9)",
    fill: "rgba(199, 210, 254, 0.92)",
    halo: "rgba(129, 140, 248, 0.35)",
  },
  wait: {
    border: "rgba(244, 114, 182, 0.9)",
    fill: "rgba(251, 207, 232, 0.92)",
    halo: "rgba(244, 114, 182, 0.35)",
  },
  crosshair: {
    border: "rgba(45, 212, 191, 0.9)",
    fill: "rgba(153, 246, 228, 0.92)",
    halo: "rgba(45, 212, 191, 0.34)",
  },
};

function detectCursorVariant(cursorValueRaw: string): CursorVariant {
  const cursorValue = cursorValueRaw.toLowerCase();

  if (!cursorValue || cursorValue.includes("none") || cursorValue.includes("auto")) {
    return "default";
  }
  if (cursorValue.includes("not-allowed") || cursorValue.includes("no-drop")) {
    return "not-allowed";
  }
  if (cursorValue.includes("text")) {
    return "text";
  }
  if (cursorValue.includes("help")) {
    return "help";
  }
  if (cursorValue.includes("wait") || cursorValue.includes("progress")) {
    return "wait";
  }
  if (cursorValue.includes("crosshair")) {
    return "crosshair";
  }
  if (
    cursorValue.includes("resize") ||
    cursorValue.includes("col-resize") ||
    cursorValue.includes("row-resize") ||
    cursorValue.includes("ew-resize") ||
    cursorValue.includes("ns-resize") ||
    cursorValue.includes("nesw-resize") ||
    cursorValue.includes("nwse-resize")
  ) {
    return "resize";
  }
  if (cursorValue.includes("move") || cursorValue.includes("grab") || cursorValue.includes("grabbing")) {
    return "move";
  }
  if (cursorValue.includes("pointer")) {
    return "pointer";
  }
  return "default";
}

function getElementClassName(element: Element): string {
  if (typeof (element as HTMLElement).className === "string") {
    return (element as HTMLElement).className;
  }
  const svgClass = (element as SVGElement).className;
  if (typeof svgClass === "object" && "baseVal" in svgClass) {
    return svgClass.baseVal ?? "";
  }
  return "";
}

function detectVariantFromClassName(className: string): CursorVariant | null {
  if (!className.trim()) return null;

  const tokens = className.trim().split(/\s+/);

  for (const tokenRaw of tokens) {
    const token = tokenRaw.replace(/^!/, "").split(":").pop() ?? "";
    if (!token.startsWith("cursor-")) continue;
    const variant = detectCursorVariant(token.replace("cursor-", ""));
    if (variant !== "default") return variant;
  }

  return null;
}

function isTextEditable(element: Element): boolean {
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) {
    const textLikeTypes = new Set([
      "text",
      "search",
      "email",
      "url",
      "tel",
      "password",
      "number",
      "date",
      "datetime-local",
      "month",
      "time",
      "week",
    ]);
    return textLikeTypes.has(element.type);
  }
  if (element instanceof HTMLElement && element.isContentEditable) return true;
  return false;
}

function isDisabledElement(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.matches(":disabled")) return true;
  return element.getAttribute("aria-disabled") === "true";
}

function isPointerElement(element: Element): boolean {
  if (element instanceof HTMLButtonElement) return true;
  if (element instanceof HTMLAnchorElement && Boolean(element.href)) return true;
  if (element instanceof HTMLLabelElement) return true;
  if (element instanceof HTMLElement && element.tagName === "SUMMARY") return true;
  if (!(element instanceof HTMLElement)) return false;

  const role = element.getAttribute("role");
  if (role && ["button", "link", "menuitem", "tab", "option", "switch", "checkbox", "radio"].includes(role)) {
    return true;
  }

  if (element.hasAttribute("onclick")) return true;
  return false;
}

function resolveCursorVariant(target: Element | null): CursorVariant {
  const bodyCursor = detectCursorVariant(document.body.style.cursor);
  if (bodyCursor !== "default") return bodyCursor;

  let current = target;
  while (current) {
    if (isDisabledElement(current)) {
      return "not-allowed";
    }
    if (isTextEditable(current)) {
      return "text";
    }

    if (current instanceof HTMLElement && current.draggable) {
      return "move";
    }

    const classVariant = detectVariantFromClassName(getElementClassName(current));
    if (classVariant) {
      return classVariant;
    }

    if (current instanceof HTMLElement) {
      const inlineVariant = detectCursorVariant(current.style.cursor);
      if (inlineVariant !== "default") {
        return inlineVariant;
      }
    }

    if (isPointerElement(current)) {
      return "pointer";
    }

    current = current.parentElement;
  }

  if (target) {
    const computedVariant = detectCursorVariant(window.getComputedStyle(target).cursor);
    if (computedVariant !== "default") {
      return computedVariant;
    }
  }

  return "default";
}

function applyVariantStyle(target: HTMLElement, variant: CursorVariant) {
  const paint = CURSOR_VARIANT_STYLE[variant];
  target.style.setProperty("--cursor-dot-border", paint.border);
  target.style.setProperty("--cursor-dot-fill", paint.fill);
  target.style.setProperty("--cursor-dot-halo", paint.halo);
}

export function CursorGlowOverlay() {
  const [enabled, setEnabled] = useState(false);
  const bubbleRef = useRef<HTMLSpanElement | null>(null);
  const paintHostRef = useRef<HTMLDivElement | null>(null);
  const visibleRef = useRef(false);
  const variantRef = useRef<CursorVariant>("default");
  const pendingPointerRef = useRef<{ x: number; y: number; target: Element | null } | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastTargetRef = useRef<Element | null>(null);
  const lastBodyCursorRef = useRef("");
  const lastResolvedVariantRef = useRef<CursorVariant>("default");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const finePointer = window.matchMedia("(pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const syncEnabled = () => {
      setEnabled(finePointer.matches && !reducedMotion.matches);
    };

    const showDot = () => {
      const bubble = bubbleRef.current;
      if (!bubble || visibleRef.current) return;
      bubble.style.opacity = "1";
      visibleRef.current = true;
    };

    const hideDot = () => {
      const bubble = bubbleRef.current;
      if (!bubble) return;
      bubble.style.opacity = "0";
      visibleRef.current = false;
      pendingPointerRef.current = null;
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };

    const flushPointerFrame = () => {
      rafIdRef.current = null;
      const pending = pendingPointerRef.current;
      if (!pending) return;
      pendingPointerRef.current = null;

      if (bubbleRef.current) {
        bubbleRef.current.style.transform = `translate3d(${pending.x}px, ${pending.y}px, 0)`;
      }

      const bodyCursor = document.body.style.cursor;
      const variant = pending.target === lastTargetRef.current && bodyCursor === lastBodyCursorRef.current
        ? lastResolvedVariantRef.current
        : resolveCursorVariant(pending.target);

      if (pending.target !== lastTargetRef.current || bodyCursor !== lastBodyCursorRef.current) {
        lastTargetRef.current = pending.target;
        lastBodyCursorRef.current = bodyCursor;
        lastResolvedVariantRef.current = variant;
      }

      if (paintHostRef.current && variantRef.current !== variant) {
        applyVariantStyle(paintHostRef.current, variant);
        variantRef.current = variant;
      }

      showDot();
    };

    const queuePointerFrame = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      pendingPointerRef.current = {
        x: event.clientX,
        y: event.clientY,
        target: event.target instanceof Element ? event.target : null,
      };
      if (rafIdRef.current === null) {
        rafIdRef.current = window.requestAnimationFrame(flushPointerFrame);
      }
    };

    const onPointerLeave = () => hideDot();
    const onBlur = () => hideDot();
    const onPointerCancel = () => hideDot();

    syncEnabled();

    finePointer.addEventListener("change", syncEnabled);
    reducedMotion.addEventListener("change", syncEnabled);
    window.addEventListener("pointermove", queuePointerFrame, { passive: true });
    window.addEventListener("pointerdown", queuePointerFrame, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("blur", onBlur);

    return () => {
      finePointer.removeEventListener("change", syncEnabled);
      reducedMotion.removeEventListener("change", syncEnabled);
      window.removeEventListener("pointermove", queuePointerFrame);
      window.removeEventListener("pointerdown", queuePointerFrame);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("blur", onBlur);
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const className = "cursor-dot-only";
    const root = document.documentElement;
    const body = document.body;

    if (enabled) {
      root.classList.add(className);
      body.classList.add(className);
    } else {
      root.classList.remove(className);
      body.classList.remove(className);
    }

    return () => {
      root.classList.remove(className);
      body.classList.remove(className);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !paintHostRef.current || !bubbleRef.current) return;
    applyVariantStyle(paintHostRef.current, "default");
    bubbleRef.current.style.opacity = "0";
    bubbleRef.current.style.transform = "translate3d(-120px, -120px, 0)";
    visibleRef.current = false;
    variantRef.current = "default";
    pendingPointerRef.current = null;
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    lastTargetRef.current = null;
    lastBodyCursorRef.current = "";
    lastResolvedVariantRef.current = "default";
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <div ref={paintHostRef} aria-hidden className="pointer-events-none fixed inset-0 z-[140]">
      <span
        ref={bubbleRef}
        className="absolute left-0 top-0 h-0 w-0 will-change-transform transition-opacity duration-75"
        style={{
          transform: "translate3d(-120px, -120px, 0)",
          opacity: 0,
        }}
      >
        <span
          className="absolute left-1/2 top-1/2 h-[1.35rem] w-[1.35rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[3px] transition-colors duration-75"
          style={{
            background: "radial-gradient(circle, var(--cursor-dot-halo) 0%, rgba(0,0,0,0) 72%)",
          }}
        />
        <span
          className="absolute left-1/2 top-1/2 h-[0.72rem] w-[0.72rem] -translate-x-1/2 -translate-y-1/2 rounded-full border transition-colors duration-75"
          style={{
            borderColor: "var(--cursor-dot-border)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.1) 36%, rgba(255,255,255,0) 100%), var(--cursor-dot-fill)",
            boxShadow: "0 1px 4px rgba(2, 6, 23, 0.24)",
          }}
        />
      </span>
    </div>
  );
}
