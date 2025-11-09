import { AnimationContext } from "./types";

export const expectedGte5 = ({ context }: { context: AnimationContext }) => {
  return context.expected >= 5;
};

export const expectedGte10 = ({ context }: { context: AnimationContext }) => {
  return context.expected >= 10;
};

export const expectedGte18 = ({ context }: { context: AnimationContext }) => context.expected >= 18;
export const expectedGte24 = ({ context }: { context: AnimationContext }) => context.expected >= 24;
export const expectedGte28 = ({ context }: { context: AnimationContext }) => context.expected >= 28;
export const hasMoreCards = ({ context }: { context: AnimationContext }) =>
  context.currentCardIndex < context.cards.length - 1;

export const allCardsAppeared = ({ context }: { context: AnimationContext }) => {
  return context.appearedCount >= context.totalCards;
};

export const allCardsReady = ({ context }: { context: AnimationContext }) => {
  return context.readyCount >= context.totalCards;
};

export const allCardsFlipped = ({ context }: { context: AnimationContext }) => {
  return context.flippedCount >= context.totalCards;
};

export const allCardsDismissed = ({ context }: { context: AnimationContext }) => {
  return context.dismissedCount >= context.totalCards;
};
