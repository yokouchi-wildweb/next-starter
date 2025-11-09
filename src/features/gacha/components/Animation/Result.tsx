// src/features/gacha/components/Animation/Result.tsx

import type { AnimationEvent } from "@/features/gacha/machines/animationMachine/types";
import { CardWithNames } from "@/features/card/entities";
import { motion } from "framer-motion";
import { StateFrom } from "xstate";
import { createAnimationMachine } from "@/features/gacha/machines/animationMachine";
import { stateValueToString } from "@/features/gacha/machines/animationMachine/utils";
import { useRef } from "react";
import { PresentationCard } from "@/features/gacha/components/Animation/partials/PresentationCard";
import { cn } from "@/lib/cn";
import { GachaButton } from "../GachaButton";

export type Props = {
  state: any;
  send: (event: AnimationEvent) => void;
  cards: CardWithNames[];
};


export function Result({ state, send, cards }: Props) {
  const zIndexRef = useRef(1000)
  const getNextZIndex = () => {
    zIndexRef.current += 1
    return zIndexRef.current
  }
  return (
    <div className={`
      relative
      w-full
      h-full
      z-[5]
      perspective-[1000]
      [transform-style:preserve-3d]
     `}>

      {cards.map((card, index) => (
        <PresentationCard
          key={card.id}
          index={index}
          state={state}
          send={send}
          card={card}
          getNextZIndex={getNextZIndex}
        ></PresentationCard>
      ))}

        <GachaButton
          onClick={state.matches("result.complete") ? () => send({ type: "DONE" }) : undefined}
          tone={state.matches("result.complete") ? "complete" : "bounce"}
          size={state.matches("result.complete") ? "md" : "lg"}
          className={cn(
            "absolute z-[2000]",
            state.matches("result.complete")
              ? "right-[50%] bottom-[50%] w-[280px] translate-x-1/2 translate-y-1/2"
              : "right-1 bottom-1"
          )}
        >
          {state.matches("result.complete") ? "ドローを終了する" : `残り ${state.context.cardRest} 枚`}
        </GachaButton>

    </div>

  )

}