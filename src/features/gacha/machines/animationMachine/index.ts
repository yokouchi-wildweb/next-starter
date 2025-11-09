// src/features/gacha/machines/animationMachine/index.ts

import { createMachine } from "xstate";
import { AnimationContext, AnimationEvent } from "./types";
import { performanceStates } from "./states/performance";
import { resultStates } from "./states/result";
import * as guards from "./guards";
import * as actions from "./actions";

export function createAnimationMachine(cards: AnimationContext["cards"]) {
  return createMachine(
    {
      types: {} as {
        context: AnimationContext;
        events: AnimationEvent;
      },
      id: "gachaAnimation",
      initial: "init",
      context: {
        cards,
        expected: 0,
        currentCardIndex: 0,
        cardActors: {} as Record<string, any>,
        totalCards: 0,
        cardRest: 0,
        appearedCount: 0,
        readyCount: 0,
        flippedCount: 0,
        dismissedCount: 0,
      },
      on: {
        CARD_APPEARED: { actions: "countAppeared" },
        CARD_READY: { actions: "countReady" },
        CARD_FLIPPED: { actions: "countFlippedState" },
        CARD_DISMISSED: { actions: "countDismissed" },
      },
      states: {
        init: {
          entry: "initializeContext",
          always: {
            target: "performance.phase1",
          },
        },
        performance: performanceStates,
        result: resultStates,
        done: { type: "final" },
      },
    },
    {
      guards,
      actions: actions as any,
    },
  );
}
