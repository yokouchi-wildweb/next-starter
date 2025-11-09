// src/features/gacha/components/Animation/performance/Performance.tsx
"use client";

import { useEffect, useMemo } from "react";
import { NextButton } from "./partials/NextButton";
import Summoning from "@/components/Three/Summoning/Summoning";
import type { AnimationEvent } from "@/features/gacha/machines/animationMachine/types";

export type PerformanceProps = {
  state: any;
  send: (event: AnimationEvent) => void;
};

const PHASE_DURATION = 20_000;

const VIDEOS = {
  phase1: "/videos/fase_1.mp4",
  phase2: "/videos/fase_2.mp4",
  phase3: "/videos/fase_3.mp4",
  phase4: "/videos/fase_4.mp4",
} as const;

export default function Performance({ state, send }: PerformanceProps) {
  const videoSrc = useMemo(() => {
    if (state.matches("performance.phase2") || state.matches("performance.phase2_interact")) return VIDEOS.phase2;
    if (state.matches("performance.phase3") || state.matches("performance.phase3_interact")) return VIDEOS.phase3;
    if (state.matches("performance.phase4")) return VIDEOS.phase4;
    return "";
  }, [state]);

  useEffect(() => {
    if (
      state.matches("performance.phase1") ||
      state.matches("performance.phase2") ||
      state.matches("performance.phase3") ||
      state.matches("performance.phase4")
    ) {
      const timer = setTimeout(() => send({ type: "PHASE_END" }), PHASE_DURATION);
      return () => clearTimeout(timer);
    }
  }, [state, send]);

  const showButton =
    state.matches("performance.phase1_interact") ||
    state.matches("performance.phase2_interact") ||
    state.matches("performance.phase3_interact");

  return (
    <div className={`
      relative
      h-full
      w-full       
      z-[3]
      `}>

      {(state.matches("performance.phase1") ||
        state.matches("performance.phase1_interact")) && <Summoning />}

      {videoSrc && (
        <video
          src={videoSrc}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
        />
      )}
      {showButton && <NextButton label="tap" onClick={() => send({ type: "INTERACT" })} />}

    </div>
  );
}
