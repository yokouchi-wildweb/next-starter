"use client";

import { useEffect } from "react";
import { useHeaderVisibility } from "../contexts/HeaderVisibilityContext";

export type HideHeaderProps = {
  /** スマホでヘッダーを非表示にする */
  sp?: boolean;
  /** PCでヘッダーを非表示にする */
  pc?: boolean;
};

/**
 * ページ単位でヘッダーの表示/非表示を制御するコンポーネント
 *
 * @example
 * // 両方非表示
 * <HideHeader sp pc />
 *
 * @example
 * // スマホのみ非表示
 * <HideHeader sp />
 *
 * @example
 * // PCのみ非表示
 * <HideHeader pc />
 */
export const HideHeader = ({ sp = false, pc = false }: HideHeaderProps) => {
  const { setVisibility, reset } = useHeaderVisibility();

  useEffect(() => {
    setVisibility({
      sp: !sp,
      pc: !pc,
    });

    return () => {
      reset();
    };
  }, [sp, pc, setVisibility, reset]);

  return null;
};
