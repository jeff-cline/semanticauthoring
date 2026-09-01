"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Hero background video.
 *
 * Decorative, so it is aria-hidden and carries no controls. It is muted and
 * plays inline, which is what browsers require before they will autoplay at
 * all. The poster frame paints immediately, so the hero never opens on a black
 * rectangle while the video loads — and it stays visible as the still fallback
 * when autoplay is blocked or the visitor prefers reduced motion.
 */
export default function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [motionOk, setMotionOk] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      setMotionOk(!mq.matches);
      const v = ref.current;
      if (!v) return;
      if (mq.matches) v.pause();
      else v.play().catch(() => { /* autoplay blocked — the poster stands in */ });
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return (
    <div aria-hidden="true"
         style={{ position: "absolute", inset: 0, overflow: "hidden",
                  background: "var(--midnight)" }}>
      <video
        ref={ref}
        muted
        loop
        playsInline
        autoPlay={motionOk}
        preload="metadata"
        poster="/hero-poster.jpg"
        style={{ width: "100%", height: "100%", objectFit: "cover",
                 objectPosition: "center 38%", display: "block" }}
      >
        <source src="/hero.mp4" type="video/mp4" />
      </video>

      {/* Scrim. The footage is bright and busy through the middle, so the
          headline needs real contrast rather than a token tint. */}
      <div style={{
        position: "absolute", inset: 0,
        background:
          "linear-gradient(to bottom, rgba(23,36,58,.62) 0%, rgba(23,36,58,.45) 28%, " +
          "rgba(23,36,58,.78) 62%, rgba(23,36,58,.94) 100%)",
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 50% 30%, rgba(23,36,58,0) 30%, rgba(23,36,58,.55) 100%)",
      }} />
    </div>
  );
}
