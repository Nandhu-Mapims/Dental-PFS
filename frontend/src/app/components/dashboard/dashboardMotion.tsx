import { useEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useReducedMotion } from "motion/react";

/**
 * Small motion pieces for the Dashboard. All of them respect the device's "reduce motion"
 * setting: with it on, numbers and bars jump straight to their values.
 */

/** Smooth ease-out used everywhere so the page moves as one system. */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Counts from the previous value to the new one when the period changes. */
export function AnimatedNumber({
  value,
  decimals = 0,
  suffix = "",
}: {
  value: number | null;
  decimals?: number;
  suffix?: string;
}) {
  const reduce = useReducedMotion();
  const shownRef = useRef(0);
  const [shown, setShown] = useState<number | null>(value);

  useEffect(() => {
    if (value == null) {
      setShown(null);
      return;
    }
    if (reduce) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    const controls = animate(shownRef.current, value, {
      duration: 0.9,
      ease: EASE_OUT,
      onUpdate: (v) => {
        shownRef.current = v;
        setShown(v);
      },
    });
    return () => controls.stop();
  }, [value, reduce]);

  if (shown == null) return <>—</>;
  return (
    <>
      {shown.toFixed(decimals)}
      {suffix}
    </>
  );
}

/** Fades and lifts a block into place; `order` staggers sibling blocks. */
export function Reveal({
  children,
  order = 0,
  className,
  as = "div",
}: {
  children: ReactNode;
  order?: number;
  className?: string;
  as?: "div" | "section" | "li";
}) {
  const reduce = useReducedMotion();
  const Component = motion[as];
  return (
    <Component
      className={className}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_OUT, delay: Math.min(order, 10) * 0.05 }}
    >
      {children}
    </Component>
  );
}

export type Segment = { key: string; value: number; color: string; label: string };

/**
 * A 100% stacked strip (positive / neutral / negative). Segments grow from zero and re-flow
 * when the data changes; a 2px surface gap separates them instead of a stroke.
 */
export function SegmentBar({
  segments,
  height = 10,
  delay = 0,
}: {
  segments: Segment[];
  height?: number;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  return (
    <div
      className="flex w-full gap-[2px] overflow-hidden rounded-[4px] bg-gray-100"
      style={{ height }}
      role="img"
      aria-label={
        total
          ? visible.map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(", ")
          : "No data"
      }
    >
      {total
        ? visible.map((s) => (
            <motion.div
              key={s.key}
              className="h-full"
              style={{ backgroundColor: s.color }}
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${(s.value / total) * 100}%` }}
              transition={{ duration: 0.8, ease: EASE_OUT, delay }}
            />
          ))
        : null}
    </div>
  );
}

/** A single bar that grows to `pct` of its track. */
export function GrowBar({
  pct,
  color,
  height = 8,
  delay = 0,
}: {
  pct: number;
  color: string;
  height?: number;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="w-full overflow-hidden rounded-[4px] bg-gray-100" style={{ height }}>
      <motion.div
        className="h-full rounded-[4px]"
        style={{ backgroundColor: color }}
        initial={reduce ? false : { width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        transition={{ duration: 0.8, ease: EASE_OUT, delay }}
      />
    </div>
  );
}
