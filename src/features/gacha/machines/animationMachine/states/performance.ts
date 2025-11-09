import { StatesConfig } from "xstate";
import { AnimationContext, AnimationEvent } from "../types";

export const performanceStates = {
  initial: "phase1",
  states: {
    phase1: {
      on: {
        PHASE_END: [
          { guard: "expectedGte5", target: "phase1_interact" },
          { target: "#gachaAnimation.result.reveal" },
        ],
      },
    },
    phase1_interact: {
      on: {
        INTERACT: [
          { guard: "expectedGte10", target: "#gachaAnimation.result.reveal" },
          { target: "#gachaAnimation.result.reveal" },
        ],
      },
    },
    phase2: {
      on: {
        PHASE_END: [
          { guard: "expectedGte18", target: "phase2_interact" },
          { target: "#gachaAnimation.result.reveal" },
        ],
      },
    },
    phase2_interact: {
      on: {
        INTERACT: [
          { guard: "expectedGte24", target: "phase3" },
          { target: "#gachaAnimation.result.reveal" },
        ],
      },
    },
    phase3: {
      on: {
        PHASE_END: [
          { guard: "expectedGte28", target: "phase3_interact" },
          { target: "#gachaAnimation.result.reveal" },
        ],
      },
    },
    phase3_interact: {
      on: { INTERACT: "phase4" },
    },
    phase4: {
      on: { PHASE_END: "#gachaAnimation.result.reveal" },
    },
  },
} as any;

