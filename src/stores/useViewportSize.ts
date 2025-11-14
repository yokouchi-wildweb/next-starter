import { useViewportSizeStore } from './useViewportSizeStore';

export function useViewportSize() {
  const width = useViewportSizeStore((s) => s.width);
  const height = useViewportSizeStore((s) => s.height);
  const setSize = useViewportSizeStore((s) => s.setSize);
  return { width, height, setSize };
}
