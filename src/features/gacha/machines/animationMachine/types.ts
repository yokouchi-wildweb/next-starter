import { CardWithNames } from "@/features/card/entities";

export type AnimationContext = {
  cards: CardWithNames[];
  expected: number;
  currentCardIndex: number;
  cardActors: Record<string, any>;
  totalCards: number;
  cardRest: number;
  flippedCount: number;
  appearedCount: number;
  readyCount: number;
  dismissedCount: number;
};

export type AnimationEvent =
  | { type: "NEXT" }
  | { type: "PHASE_END" }
  | { type: "INTERACT" }
  | { type: "FLIP_NEXT" }
  | { type: "CARD_APPEARED" }
  | { type: "CARD_READY" }
  | { type: "CARD_FLIPPED" }
  | { type: "CARD_DISMISSED" }
  | { type: "DONE" };
