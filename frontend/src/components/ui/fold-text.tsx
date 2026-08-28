"use client";

import { useEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import "./fold-text.css";

gsap.registerPlugin(ScrollTrigger);

const HINGE_CONFIG = {
  top: { origin: "50% 0%", rotateX: -92, rotateY: 0 },
  bottom: { origin: "50% 100%", rotateX: 92, rotateY: 0 },
  left: { origin: "0% 50%", rotateX: 0, rotateY: 92 },
  right: { origin: "100% 50%", rotateX: 0, rotateY: -92 },
} as const;

type Hinge = keyof typeof HINGE_CONFIG;
type SplitBy = "char" | "word" | "line";
type Trigger = "mount" | "hover" | "scroll" | "loop";

type FoldTextProps = {
  text?: string;
  splitBy?: SplitBy;
  hinge?: Hinge;
  duration?: number;
  stagger?: number;
  ease?: string;
  perspective?: number;
  creaseShading?: number;
  trigger?: Trigger;
  fontSize?: string | number;
  fontWeight?: string | number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const renderWhitespace = (value: string, key: string) =>
  value.split(/(\n)/).map((part, index) => {
    if (part === "\n") return <br key={`${key}-br-${index}`} />;
    if (!part) return null;
    return (
      <span className="fold-text-whitespace" key={`${key}-space-${index}`}>
        {part.replace(/ /g, "\u00A0")}
      </span>
    );
  });

export default function FoldText({
  text = "Design unfolds",
  splitBy = "char",
  hinge = "top",
  duration = 0.65,
  stagger = 0.045,
  ease = "power3.out",
  perspective = 700,
  creaseShading = 0.55,
  trigger = "mount",
  fontSize = 80,
  fontWeight = 800,
  color = "#f7f2e8",
  className = "",
  style = {},
}: FoldTextProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const hingeConfig = HINGE_CONFIG[hinge] || HINGE_CONFIG.top;
  const safeCrease = clamp(creaseShading, 0, 1);
  const safePerspective = Math.max(120, perspective);

  const segments = useMemo(() => {
    let segmentIndex = 0;

    const renderSegment = (content: string, key: string, split = splitBy) => {
      segmentIndex += 1;
      return (
        <span
          className="fold-text-segment"
          data-fold-split={split}
          key={key}
          style={{ "--fold-perspective": `${safePerspective}px` } as React.CSSProperties}
        >
          <span
            className="fold-text-piece"
            data-fold-hinge={hinge}
            style={
              {
                transformOrigin: hingeConfig.origin,
                "--fold-crease": 0,
              } as React.CSSProperties
            }
          >
            {content || "\u00A0"}
          </span>
        </span>
      );
    };

    if (splitBy === "line") {
      return text.split("\n").map((line, index) => (
        <span className="fold-text-line" key={`line-${index}`}>
          {renderSegment(line || "\u00A0", `segment-line-${index}`, "line")}
        </span>
      ));
    }

    if (splitBy === "word") {
      return text.split(/(\s+)/).flatMap((part, index) => {
        if (!part) return [];
        if (/^\s+$/.test(part)) return renderWhitespace(part, `ws-${index}`) as unknown as React.ReactNode[];
        return renderSegment(part, `segment-word-${segmentIndex}`);
      });
    }

    // Keep words intact when splitBy="char" so "knowledge" never breaks as "kn|owledge".
    // Each word is wrapped in a nowrap inline-block, line breaks only at whitespace.
    return text.split(/(\n|\s+)/).flatMap((part, index) => {
      if (!part) return [];
      if (part === "\n") return <br key={`br-${index}`} />;
      if (/^\s+$/.test(part)) return renderWhitespace(part, `ws-char-${index}`) as unknown as React.ReactNode[];
      return (
        <span className="fold-text-word" key={`word-char-${index}`}>
          {Array.from(part).map((char, ci) => renderSegment(char, `segment-char-${index}-${ci}`))}
        </span>
      );
    });
  }, [text, splitBy, hinge, hingeConfig.origin, safePerspective]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = rootRef.current;
    if (!root) return;

    const pieces = Array.from(root.querySelectorAll<HTMLElement>(".fold-text-piece"));
    if (!pieces.length) return;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const activeDuration = reduceMotion ? Math.min(duration, 0.22) : duration;
    const activeStagger = reduceMotion ? Math.min(stagger, 0.02) : stagger;
    const fromVars: gsap.TweenVars = {
      opacity: 0,
      rotateX: reduceMotion ? 0 : hingeConfig.rotateX,
      rotateY: reduceMotion ? 0 : hingeConfig.rotateY,
      "--fold-crease": reduceMotion ? 0 : safeCrease,
      transformOrigin: hingeConfig.origin,
      force3D: true,
    };
    const toVars: gsap.TweenVars = {
      opacity: 1,
      rotateX: 0,
      rotateY: 0,
      "--fold-crease": 0,
      duration: activeDuration,
      ease: reduceMotion ? "power1.out" : ease,
      stagger: activeStagger,
      clearProps: "willChange",
    };

    const killTimeline = () => {
      timelineRef.current?.kill();
      timelineRef.current = null;
      gsap.killTweensOf(pieces);
    };

    const play = (repeat: boolean) => {
      killTimeline();
      timelineRef.current = gsap.timeline({
        repeat: repeat ? -1 : 0,
        repeatDelay: repeat ? 0.75 : 0,
      });
      timelineRef.current.fromTo(pieces, fromVars, toVars);
      return timelineRef.current;
    };

    let scrollTrigger: ScrollTrigger | undefined;
    let hoverHandler: (() => void) | undefined;

    if (trigger === "hover") {
      gsap.set(pieces, {
        opacity: 1,
        rotateX: 0,
        rotateY: 0,
        "--fold-crease": 0,
        transformOrigin: hingeConfig.origin,
      });
      hoverHandler = () => play(false);
      root.addEventListener("mouseenter", hoverHandler);
    } else if (trigger === "scroll") {
      gsap.set(pieces, fromVars);
      scrollTrigger = ScrollTrigger.create({
        trigger: root,
        start: "top 82%",
        once: true,
        onEnter: () => play(false),
      });
    } else if (trigger === "loop") {
      play(true);
    } else {
      play(false);
    }

    return () => {
      if (hoverHandler) root.removeEventListener("mouseenter", hoverHandler);
      scrollTrigger?.kill();
      killTimeline();
    };
  }, [
    text,
    splitBy,
    hinge,
    duration,
    stagger,
    ease,
    perspective,
    safeCrease,
    trigger,
    hingeConfig.origin,
    hingeConfig.rotateX,
    hingeConfig.rotateY,
  ]);

  const rootStyle: React.CSSProperties = {
    "--fold-text-font-size": typeof fontSize === "number" ? `${fontSize}px` : fontSize,
    "--fold-text-font-weight": fontWeight,
    "--fold-text-color": color,
    ...style,
  } as React.CSSProperties;

  return (
    <span ref={rootRef} className={`fold-text ${className}`.trim()} style={rootStyle}>
      <span className="fold-text-sr-only">{text}</span>
      <span className="fold-text-visual" aria-hidden="true">
        {segments}
      </span>
    </span>
  );
}
