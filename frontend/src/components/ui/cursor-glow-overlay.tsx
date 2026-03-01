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
  bg: string;
  shadow: string;
};

const CURSOR_VARIANT_STYLE: Record<CursorVariant, CursorPaint> = {
  default: {
    border: "rgba(14, 165, 233, 0.66)",
    bg: "rgba(14, 165, 233, 0.07)",
    shadow: "0 0 0 1px rgba(14, 165, 233, 0.2)",
  },
  pointer: {
    border: "rgba(34, 197, 94, 0.68)",
    bg: "rgba(34, 197, 94, 0.07)",
    shadow: "0 0 0 1px rgba(22, 163, 74, 0.2)",
  },
  text: {
    border: "rgba(250, 204, 21, 0.68)",
    bg: "rgba(250, 204, 21, 0.07)",
    shadow: "0 0 0 1px rgba(217, 119, 6, 0.2)",
  },
  move: {
    border: "rgba(168, 85, 247, 0.68)",
    bg: "rgba(168, 85, 247, 0.07)",
    shadow: "0 0 0 1px rgba(126, 34, 206, 0.2)",
  },
  resize: {
    border: "rgba(251, 146, 60, 0.68)",
    bg: "rgba(251, 146, 60, 0.07)",
    shadow: "0 0 0 1px rgba(194, 65, 12, 0.2)",
  },
  "not-allowed": {
    border: "rgba(248, 113, 113, 0.68)",
    bg: "rgba(248, 113, 113, 0.07)",
    shadow: "0 0 0 1px rgba(185, 28, 28, 0.2)",
  },
  help: {
    border: "rgba(129, 140, 248, 0.68)",
    bg: "rgba(129, 140, 248, 0.07)",
    shadow: "0 0 0 1px rgba(67, 56, 202, 0.2)",
  },
  wait: {
    border: "rgba(244, 114, 182, 0.68)",
    bg: "rgba(244, 114, 182, 0.07)",
    shadow: "0 0 0 1px rgba(190, 24, 93, 0.2)",
  },
  crosshair: {
    border: "rgba(45, 212, 191, 0.68)",
    bg: "rgba(45, 212, 191, 0.07)",
    shadow: "0 0 0 1px rgba(13, 148, 136, 0.2)",
  },
};

const TEXT_INPUT_TYPES = new Set([
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

const INTERACTIVE_ROLES = new Set(["button", "link", "menuitem", "tab", "option", "switch", "checkbox", "radio"]);

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
    return TEXT_INPUT_TYPES.has(element.type);
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
  if (role && INTERACTIVE_ROLES.has(role)) {
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

function applyVariantStyle(target: HTMLElement, variant: CursorVariant, liteMode = false) {
  const paint = CURSOR_VARIANT_STYLE[variant];
  target.style.setProperty("--cursor-dot-border", paint.border);
  target.style.setProperty("--cursor-dot-bg", liteMode ? "transparent" : paint.bg);
  target.style.setProperty("--cursor-dot-shadow", liteMode ? "none" : paint.shadow);
}

export function CursorGlowOverlay() {
  const [enabled, setEnabled] = useState(false);
  const ringRef = useRef<HTMLSpanElement | null>(null);
  const visibleRef = useRef(false);
  const variantRef = useRef<CursorVariant>("default");
  const lastTargetRef = useRef<Element | null>(null);
  const lastBodyCursorRef = useRef("");
  const lastModalStateRef = useRef(false);
  const lastResolvedVariantRef = useRef<CursorVariant>("default");
  const liteModeRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const finePointer = window.matchMedia("(pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const syncEnabled = () => {
      setEnabled(finePointer.matches && !reducedMotion.matches);
    };

    const showDot = () => {
      const ring = ringRef.current;
      if (!ring || visibleRef.current) return;
      ring.style.opacity = "1";
      visibleRef.current = true;
    };

    const hideDot = () => {
      const ring = ringRef.current;
      if (!ring) return;
      ring.style.opacity = "0";
      visibleRef.current = false;
    };

    const syncLiteMode = () => {
      const isModalOpen = document.body.style.overflow === "hidden";
      if (isModalOpen !== liteModeRef.current && ringRef.current) {
        liteModeRef.current = isModalOpen;
        applyVariantStyle(ringRef.current, variantRef.current, isModalOpen);
      }
      return isModalOpen;
    };

    const applyVariantForTarget = (target: Element | null, force = false) => {
      const isModalOpen = syncLiteMode();
      const bodyCursor = document.body.style.cursor;

      if (
        !force &&
        target === lastTargetRef.current &&
        bodyCursor === lastBodyCursorRef.current &&
        isModalOpen === lastModalStateRef.current
      ) {
        return;
      }

      const variant = isModalOpen ? "default" : resolveCursorVariant(target);
      lastTargetRef.current = target;
      lastBodyCursorRef.current = bodyCursor;
      lastModalStateRef.current = isModalOpen;
      lastResolvedVariantRef.current = variant;

      if (ringRef.current && variantRef.current !== variant) {
        applyVariantStyle(ringRef.current, variant, liteModeRef.current);
        variantRef.current = variant;
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;

      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      }

      showDot();

      if (!lastTargetRef.current) {
        applyVariantForTarget(event.target instanceof Element ? event.target : null, true);
        return;
      }

      const bodyCursor = document.body.style.cursor;
      const isModalOpen = document.body.style.overflow === "hidden";
      if (bodyCursor !== lastBodyCursorRef.current || isModalOpen !== lastModalStateRef.current) {
        applyVariantForTarget(lastTargetRef.current, true);
      }
    };

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      applyVariantForTarget(event.target instanceof Element ? event.target : null, true);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      applyVariantForTarget(event.target instanceof Element ? event.target : null, true);
    };

    const onPointerLeave = () => hideDot();
    const onBlur = () => hideDot();
    const onPointerCancel = () => hideDot();

    syncEnabled();

    finePointer.addEventListener("change", syncEnabled);
    reducedMotion.addEventListener("change", syncEnabled);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerover", onPointerOver, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("blur", onBlur);

    return () => {
      finePointer.removeEventListener("change", syncEnabled);
      reducedMotion.removeEventListener("change", syncEnabled);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerover", onPointerOver);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("blur", onBlur);
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
    if (!enabled || !ringRef.current) return;
    applyVariantStyle(ringRef.current, "default", false);
    ringRef.current.style.opacity = "0";
    ringRef.current.style.transform = "translate3d(-120px, -120px, 0)";
    visibleRef.current = false;
    variantRef.current = "default";
    lastTargetRef.current = null;
    lastBodyCursorRef.current = "";
    lastModalStateRef.current = false;
    lastResolvedVariantRef.current = "default";
    liteModeRef.current = false;
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[140]">
      <span
        ref={ringRef}
        className="absolute left-0 top-0 h-[1.35rem] w-[1.35rem] -translate-x-1/2 -translate-y-1/2 rounded-full border will-change-transform transition-opacity duration-50 [background-color:var(--cursor-dot-bg)] [border-color:var(--cursor-dot-border)] [box-shadow:var(--cursor-dot-shadow)]"
        style={{
          transform: "translate3d(-120px, -120px, 0)",
          opacity: 0,
        }}
      />
    </div>
  );
}
