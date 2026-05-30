"use client";

import * as React from "react";

// --- DUAL-PHYSICS RIPPLE ENGINE ---
// Shared between the Material dropdown menu and the restyled Radix Select so
// both surfaces get identical press feedback. The cinematic open/close + item
// stagger keyframes live in app/globals.css (.m3-content / .m3-item-enter).
const MINIMUM_PRESS_MS = 300;

export type M3RippleVariant = "trigger" | "item";

export const useM3Ripple = ({ disabled = false, variant = "item" }: { disabled?: boolean; variant?: M3RippleVariant } = {}) => {
  const [pressed, setPressed] = React.useState(false);
  const surfaceRef = React.useRef<HTMLDivElement>(null);
  const rippleRef = React.useRef<HTMLDivElement>(null);
  const growAnimationRef = React.useRef<Animation | null>(null);
  const isMounted = React.useRef(true);

  React.useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const startPressAnimation = (event?: React.PointerEvent | React.KeyboardEvent) => {
    if (disabled || !surfaceRef.current || !rippleRef.current) return;

    const rect = surfaceRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    setPressed(true);
    growAnimationRef.current?.cancel();

    let clickX = rect.width / 2;
    let clickY = rect.height / 2;

    if (event && "clientX" in event) {
      clickX = (event as React.PointerEvent).clientX - rect.left;
      clickY = (event as React.PointerEvent).clientY - rect.top;
    }

    if (variant === "trigger") {
      // --- TRIGGER PHYSICS (Gentle, Area-based, True Geometric bounds) ---
      const maxDistance = Math.max(
        Math.hypot(clickX, clickY),
        Math.hypot(rect.width - clickX, clickY),
        Math.hypot(clickX, rect.height - clickY),
        Math.hypot(rect.width - clickX, rect.height - clickY)
      );

      const finalRadius = maxDistance / 0.65;
      const finalSize = finalRadius * 2;
      const initialScale = Math.min(10 / finalSize, 0.04);

      const surfaceArea = rect.width * rect.height;
      const areaDuration = Math.sqrt(surfaceArea) * 3;
      const duration = Math.min(Math.max(600, areaDuration), 1000);

      rippleRef.current.style.width = `${finalSize}px`;
      rippleRef.current.style.height = `${finalSize}px`;

      const left = clickX - finalRadius;
      const top = clickY - finalRadius;
      const centerLeft = (rect.width - finalSize) / 2;
      const centerTop = (rect.height - finalSize) / 2;

      growAnimationRef.current = rippleRef.current.animate([
          { transform: `translate(${left}px, ${top}px) scale(${initialScale})` },
          { transform: `translate(${centerLeft}px, ${centerTop}px) scale(1)` }
        ],
        { duration, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" }
      );
    } else {
      // --- ITEM PHYSICS (Snappy, Explosive, Scale-Multiplier bounds) ---
      const maxDim = Math.max(rect.width, rect.height);
      const softEdgeSize = Math.max(0.35 * maxDim, 75);
      const initialSize = Math.max(2, Math.floor(maxDim * 0.2));
      const hypotenuse = Math.sqrt(rect.width ** 2 + rect.height ** 2);
      const maxRadius = hypotenuse + 10;
      const duration = Math.min(Math.max(400, hypotenuse * 1.5), 1000);
      const scale = (maxRadius + softEdgeSize) / initialSize;

      rippleRef.current.style.width = `${initialSize}px`;
      rippleRef.current.style.height = `${initialSize}px`;

      const startX = clickX - initialSize / 2;
      const startY = clickY - initialSize / 2;
      const endX = (rect.width - initialSize) / 2;
      const endY = (rect.height - initialSize) / 2;

      growAnimationRef.current = rippleRef.current.animate([
          { transform: `translate(${startX}px, ${startY}px) scale(1)` },
          { transform: `translate(${endX}px, ${endY}px) scale(${scale})` }
        ],
        { duration, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "forwards" }
      );
    }
  };

  const endPressAnimation = async () => {
    const animation = growAnimationRef.current;
    if (animation && typeof animation.currentTime === "number" && animation.currentTime < MINIMUM_PRESS_MS) {
      await new Promise((r) => setTimeout(r, MINIMUM_PRESS_MS - (animation.currentTime as number)));
    }
    if (isMounted.current) setPressed(false);
  };

  return {
    surfaceRef, rippleRef, pressed,
    events: {
      onPointerDown: (e: React.PointerEvent) => { if (e.button === 0) startPressAnimation(e); },
      onPointerUp: endPressAnimation,
      onPointerLeave: endPressAnimation,
      onPointerCancel: endPressAnimation,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          startPressAnimation();
          setTimeout(endPressAnimation, MINIMUM_PRESS_MS);
        }
      },
    },
  };
};

export const M3RippleLayer = ({ pressed, rippleRef, variant = "item" }: { pressed: boolean; rippleRef: React.RefObject<HTMLDivElement | null>; variant?: M3RippleVariant }) => (
  <div className="absolute inset-0 overflow-hidden rounded-[inherit] pointer-events-none z-0">
    <div className="absolute inset-0 bg-current opacity-0 transition-opacity duration-200 group-hover:opacity-[0.08] group-data-[highlighted]:opacity-[0.08]" />
    <div
      ref={rippleRef}
      className="absolute rounded-full opacity-0 bg-current"
      style={{
        background: variant === "trigger"
            ? "radial-gradient(closest-side, currentColor 65%, transparent 100%)"
            : "radial-gradient(closest-side, currentColor max(calc(100% - 70px), 65%), transparent 100%)",
        transition: "opacity 375ms linear",
        opacity: pressed ? "0.12" : "0",
        transitionDuration: pressed ? "100ms" : "375ms",
        top: 0,
        left: 0,
      }}
    />
  </div>
);
