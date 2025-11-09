// src/features/gacha/machines/animationMachine/states/result.ts

import { StatesConfig } from "xstate";
import { AnimationContext, AnimationEvent } from "../types";

export const resultStates = {
  initial: "reveal",
  states: {
    reveal: {
      entry: "spawnCardMachines",
      after: { 500: "decking" },
    },
    decking: {
      entry: "sendAppearToAllCards",
      always: {
        target: "deckingWait",
        guard: "allCardsAppeared",
      },
    },
    deckingWait: {
      after: {
        1000: "prepareDraw",
      },
    },
    prepareDraw: {
      entry: "sendPrepareToAllCards",
      always: {
        target: "draw",
        guard: "allCardsReady",
      },
    },
    draw: {
      always: {
        target: "drawWait",
        guard: "allCardsDismissed",
      },
    },
    drawWait: {
      after: {
        1000: "complete",
      },
    },
    complete: {
      on: {
        DONE: { target: "done" },
      },
    },
    done: {
      type: "final",
    },
  },

} as any;
