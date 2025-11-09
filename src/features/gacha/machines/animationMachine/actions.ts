// src/features/gacha/machines/animationMachine/actions.ts

import { assign } from "xstate";
import { createCardMachine } from "./createCardMachine";
import type { CardWithNames } from "@/features/card/entities";
import type { AnimationContext } from "./types";

export const spawnCardMachines = assign(({ context, spawn }) => ({
  cardActors: Object.fromEntries(
    context.cards.map((c: CardWithNames) => [c.id, spawn(createCardMachine(c.id), { id: c.id })]),
  ),
}));

export const initializeContext = assign(({ context }) => ({
  expected: 60,
  totalCards: context.cards.length,
  cardRest: context.cards.length,
}));

export const countAppeared = assign(({ context }) => ({
  appearedCount: context.appearedCount + 1,
}));

export const countReady = assign(({ context }) => ({
  readyCount: context.readyCount + 1,
}));

export const countFlippedState = assign(({ context }) => ({
  flippedCount: context.flippedCount + 1,
  cardRest: context.cardRest - 1,

}));

export const countDismissed = assign(({ context }) => ({
  dismissedCount: context.dismissedCount + 1,
}));

export const sendAppearToAllCards = ({ context }: { context: AnimationContext }) => {

    Object.values(context.cardActors).forEach((actor) => {

    actor.send({ type: "COME_OUT" });
  });
};

export const sendPrepareToAllCards = ({ context }: { context: AnimationContext }) => {

  Object.values(context.cardActors).forEach((actor) => {
    actor.send({ type: "PREPARE" });
  });
};
