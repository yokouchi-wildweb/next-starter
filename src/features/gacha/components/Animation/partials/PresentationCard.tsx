// src/features/gacha/components/Animation/partials/PresentationCard.tsx

import type { AnimationEvent } from "@/features/gacha/machines/animationMachine/types";
import { CardWithNames } from "@/features/card/entities";
import { motion } from "framer-motion";

import InteractiveDecoratedCard from "@/features/card/components/common/InteractiveDecoratedCard";
import { cn } from "@/lib/cn";
import {
  initialStyle,
  usePresentationCard,
} from "../hooks/usePresentationCard";
import { useCardInteraction } from "../hooks/useCardInteraction";

export type Props = {
  index: number;
  state: any;
  send: (event: AnimationEvent) => void;
  card: CardWithNames;
  getNextZIndex: () => number;
};


export function PresentationCard({ index, state, send, card, getNextZIndex }: Props) {
  const {
    cardActor,
    cardContext,
    animeStarted,
    isInitialized,
    cardState,
    currentTransform,
    enableTouchMove,
    parentScaleRef,
    handleAnimationStart,
    handleAnimationComplete,
    handleDrag,
    handleAppeared,
  } = usePresentationCard({ state, card });

  const { zIndex, handleInteract, childX, childY } = useCardInteraction(
    cardState,
    getNextZIndex,
  );

  if (!cardActor) return null;


  return (
    <motion.div
      initial={
        isInitialized.current
          ? false
          : initialStyle
      }
      animate={currentTransform}
      transition={{ duration: 0.5 }}
      onAnimationComplete={handleAnimationComplete}
      onAnimationStart={handleAnimationStart}

      className={cn(`
        absolute
        max-w-[300px]
        w-[45%]
        bottom-0
        left-0
        pointer-events-none
      `)}
      style={{
        zIndex,
      }}
    >
      <InteractiveDecoratedCard
        index={index}
        card={card}
        flipped={ cardContext.flipped }

        enableIntroAnimation={true}
        animeStarted={ animeStarted }
        animeFillMode={`both`}
        onAppeared={handleAppeared}

        enableTouchMove={enableTouchMove}
        onDrag={handleDrag}
        parentScale={parentScaleRef.current}
        externalX={childX}
        externalY={childY}

        onInteract={handleInteract}

        hasAura={ cardContext.flipped && card.rarityName === 'SSR' }
        isGlossy={ cardContext.flipped && card.rarityName === 'SSR' }
      />
    </motion.div>
  )

}
