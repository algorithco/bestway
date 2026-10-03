"use client";

import * as React from "react";
import {
  animate,
  motion,
  motionValue,
  useReducedMotion,
  useTransform,
  type HTMLMotionProps,
  type MotionValue,
} from "motion/react";
import styles from "./jelly-nav.module.css";

export interface JellyNavItem {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface JellyNavProps {
  items: JellyNavItem[];
  value: string;
  onChange: (value: string, index: number) => void;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  swell?: number;
  barge?: number;
  shrink?: number;
  jelly?: number;
  bounce?: number;
  stagger?: number;
  stiffness?: number;
}

interface ChipMotion {
  x: MotionValue<number>;
  sx: MotionValue<number>;
  sy: MotionValue<number>;
}

interface ChipProps extends Omit<HTMLMotionProps<"button">, "style"> {
  mv: ChipMotion;
}

const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { mv, children, ...props },
  ref,
) {
  const transform = useTransform(
    () => `translateX(${mv.x.get()}px) scale(${mv.sx.get()}, ${mv.sy.get()})`,
  );

  return (
    <motion.button ref={ref} style={{ transform }} {...props}>
      {children}
    </motion.button>
  );
});

function spring(stiffness: number, mass: number, bounce: number) {
  return {
    type: "spring" as const,
    stiffness,
    damping: 2 * Math.sqrt(stiffness * mass) * (1 - bounce),
    mass,
  };
}

export function JellyNav({
  items,
  value,
  onChange,
  ariaLabel = "Main navigation",
  disabled = false,
  className = "",
  swell = 0.18,
  barge = 5,
  shrink = 0.04,
  jelly = 1,
  bounce = 0.25,
  stagger = 22,
  stiffness = 580,
}: JellyNavProps) {
  // -1 = no selection (used off the home page, where section pills are meaningless).
  const activeIndex = items.findIndex((item) => item.value === value);
  const focusIndex = Math.max(0, activeIndex);
  const reduceMotion = useReducedMotion();
  const groupRef = React.useRef<HTMLDivElement>(null);
  const chipRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const widths = React.useRef<number[]>([]);
  const appliedIndex = React.useRef(activeIndex);
  const itemsKey = items.map((item) => item.value).join("|");
  const motionValues = React.useMemo<ChipMotion[]>(
    () =>
      items.map(() => ({
        x: motionValue(0),
        sx: motionValue(1),
        sy: motionValue(1),
      })),
    // Values only need rebuilding when the navigation choices change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemsKey],
  );

  const apply = React.useCallback(
    (selected: number, instant: boolean) => {
      const group = groupRef.current;
      const rtl = group ? getComputedStyle(group).direction === "rtl" : false;
      const push = ((widths.current[selected] ?? 0) * swell) / 2 + barge;

      motionValues.forEach((mv, index) => {
        const selectedChip = index === selected;
        const distance = selected < 0 ? Math.abs(index) + 1 : Math.abs(index - selected);
        const direction = selected < 0 ? 0 : Math.sign(index - selected) * (rtl ? -1 : 1);
        const x = direction * push;
        const scale = selectedChip ? 1 + swell : 1 - shrink;

        if (instant || reduceMotion) {
          mv.x.jump(x);
          mv.sx.jump(scale);
          mv.sy.jump(scale);
          return;
        }

        const chipStiffness = stiffness * (1 - 0.12 * Math.min(distance, 3));
        const inFlight = mv.x.isAnimating() || mv.sx.isAnimating() || mv.sy.isAnimating();
        const delay = inFlight ? 0 : (distance * stagger) / 1000;

        animate(mv.x, x, { ...spring(chipStiffness, 0.9, bounce), delay });
        animate(mv.sx, scale, {
          ...spring(
            chipStiffness * (1 + 0.24 * jelly),
            0.9 - 0.1 * jelly,
            Math.min(0.85, bounce + 0.3 * jelly),
          ),
          delay,
        });
        animate(mv.sy, scale, {
          ...spring(chipStiffness * (1 - 0.14 * jelly), 0.9 + 0.05 * jelly, bounce),
          delay: delay + 0.05 * jelly,
        });
      });
    }, [barge, bounce, jelly, motionValues, reduceMotion, shrink, stagger, stiffness, swell]);

  React.useLayoutEffect(() => {
    const measure = () => {
      const group = groupRef.current;
      if (!group) return;

      widths.current = chipRefs.current.map((element) => element?.offsetWidth ?? 0);
      const chipHeight = chipRefs.current[0]?.offsetHeight ?? 0;
      const maxWidth = Math.max(0, ...widths.current);
      group.style.setProperty(
        "--jn-safe-x",
        `${Math.ceil((maxWidth * swell * 1.3) / 2 + barge) + 2}px`,
      );
      group.style.setProperty("--jn-safe-y", `${Math.ceil((chipHeight * swell) / 2) + 2}px`);
      apply(appliedIndex.current, true);
    };

    measure();
    const observer = new ResizeObserver(measure);
    if (groupRef.current) observer.observe(groupRef.current);
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [apply, barge, itemsKey, swell]);

  React.useEffect(() => {
    if (appliedIndex.current === activeIndex) return;
    appliedIndex.current = activeIndex;
    apply(activeIndex, true);
  }, [activeIndex, apply]);

  React.useEffect(
    () => () => {
      motionValues.forEach((mv) => {
        mv.x.destroy();
        mv.sx.destroy();
        mv.sy.destroy();
      });
    },
    [motionValues],
  );

  const commit = (index: number, instant: boolean) => {
    if (disabled || index === activeIndex || !items[index] || items[index].disabled) return;
    appliedIndex.current = index;
    apply(index, instant);
    onChange(items[index].value, index);
  };

  const stepFrom = (index: number, direction: number) => {
    let next = index;
    for (let tries = 0; tries < items.length; tries += 1) {
      next = (next + direction + items.length) % items.length;
      if (!items[next].disabled) return next;
    }
    return index;
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = stepFrom(index, 1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = stepFrom(index, -1);
    else if (event.key === "Home") next = stepFrom(-1, 1);
    else if (event.key === "End") next = stepFrom(items.length, -1);
    else if (event.key === " " || event.key === "Enter") next = index;
    if (next === null) return;

    event.preventDefault();
    commit(next, true);
    chipRefs.current[next]?.focus();
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={ariaLabel}
      data-disabled={disabled ? "" : undefined}
      className={`${styles.root}${className ? ` ${className}` : ""}`}
    >
      {items.map((item, index) => (
        <Chip
          key={item.value}
          mv={motionValues[index]}
          ref={(element) => {
            chipRefs.current[index] = element;
          }}
          type="button"
          role="radio"
          aria-checked={index === activeIndex}
          tabIndex={index === focusIndex ? 0 : -1}
          disabled={disabled || item.disabled}
          className={styles.chip}
          data-on={index === activeIndex ? "true" : "false"}
          onClick={(event) => commit(index, event.detail === 0)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        >
          <span className={styles.skin}>{item.label}</span>
        </Chip>
      ))}
    </div>
  );
}
