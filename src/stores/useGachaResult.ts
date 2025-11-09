import { useGachaResultStore } from './useGachaResultStore';

export function useGachaResult() {
  const cards = useGachaResultStore((s) => s.cards);
  const setCards = useGachaResultStore((s) => s.setCards);
  const clear = useGachaResultStore((s) => s.clear);
  return { cards, setCards, clear };
}
