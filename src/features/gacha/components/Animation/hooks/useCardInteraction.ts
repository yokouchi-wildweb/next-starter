import { useEffect, useState } from "react";

export function useCardInteraction(cardState: string, getNextZIndex: () => number) {
  const [childX, setChildX] = useState<number | undefined>(undefined);
  const [childY, setChildY] = useState<number | undefined>(undefined);
  const [zIndex, setZIndex] = useState<number>(10);

  useEffect(() => {
    if (cardState === "staging") {
      setChildX(1);
      setChildY(1);
    }
  }, [cardState]);

  const handleInteract = () => {
    setZIndex(getNextZIndex());
  };

  return {
    childX,
    childY,
    zIndex,
    handleInteract,
  } as const;
}
