import { useEffect, useRef, useState } from "react";
import { useSelector } from "@xstate/react";
import { analyzeSwipe } from "@/utils/gesture";
import type { DragState } from "@use-gesture/react";
import { stateValueToString } from "@/features/gacha/machines/animationMachine/utils";
import type { CardWithNames } from "@/features/card/entities";
import { log } from "@/utils/log";

export const initialStyle = {
  x: "calc(50vw - 50%)",
  y: "calc(-50vh + 50%)",
  scale: 1,
  RotateX: 0,
  rotateZ: 0,
  opacity: 1,
};

function getCurrentTransform(stateName: string) {
  switch (stateName) {
    case "preparing":
      return { x: "-3%", y: "6%", scale: 1.2 };
    case "staging":
      return { x: "calc(50vw - 50%)", y: "calc(-50vh + 50%)", scale: 1.8 };
    case "dismissing":
      return {
        x: "15vw",
        y: "-80vh",
        z: -800,
        rotateX: 80,
        rotateZ: 480,
        scale: 0.2,
        opacity: 0,
      };
    case "performance.phase4":
      return { x: -200, y: 200, scale: 3 };
  }
}

export function usePresentationCard({
  state,
  card,
}: {
  state: any;
  card: CardWithNames;
}) {
  const cardActor = state.context.cardActors?.[card.id];
  const dummyActor: any = { getSnapshot: () => undefined };
  const cardSnapshot = useSelector(cardActor ?? dummyActor, (s) => s) as any;
  const cardContext = cardSnapshot?.context;

  const [animeStarted, setAnimeStarted] = useState(false);
  useEffect(() => {
    if (state.matches("result.decking") && !animeStarted) {
      setAnimeStarted(true);
    }
  }, [state, animeStarted]);

  const isInitialized = useRef(false);
  const cardState = cardSnapshot ? stateValueToString(cardSnapshot) : "";
  const currentTransform = getCurrentTransform(cardState);
  const enableTouchMove = ["ready", "flipped"].includes(cardState);

  const parentScaleRef = useRef(currentTransform?.scale ?? 1);
  if (currentTransform?.scale !== undefined) {
    parentScaleRef.current = currentTransform.scale;
  }

  const handleAnimationStart = () => {
    isInitialized.current = true;
  };

  const handleAnimationComplete = () => {
    switch (cardState) {
      case "preparing":
        cardActor.send({ type: "READY" } as any);
        break;
      case "staging":
        cardActor.send({ type: "STAGED" } as any);
        break;
      case "dismissing":
        cardActor.send({ type: "DISMISSED" } as any);
        break;
    }
  };

  const handleDrag = (dragState: DragState) => {
    const [mx, my] = dragState.movement;
    const { distance } = analyzeSwipe(mx, my);
    switch (true) {
      case cardState === "ready" && distance >= 60:
        cardActor.send({ type: "FLIP" } as any);
        break;
      case cardState === "staged" && distance >= 30:
        log(3, "now DISMISS");
        cardActor.send({ type: "DISMISS" } as any);
        break;
    }
  };

  const handleAppeared = () => {
    cardActor.send({ type: "APPEARED" } as any);
  };

  return {
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
  } as const;
}
