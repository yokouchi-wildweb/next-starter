"use client";

import { useEffect } from "react";
import { useFooterVisibility } from "../contexts/FooterVisibilityContext";

export type HideFooterProps = {
  /** スマホでフッターを非表示にする */
  sp?: boolean;
  /** PCでフッターを非表示にする */
  pc?: boolean;
};

/**
 * ページ単位でフッターの表示/非表示を制御するコンポーネント
 *
 * @example
 * // 両方非表示
 * <HideFooter sp pc />
 *
 * @example
 * // スマホのみ非表示
 * <HideFooter sp />
 *
 * @example
 * // PCのみ非表示
 * <HideFooter pc />
 */
export const HideFooter = ({ sp = false, pc = false }: HideFooterProps) => {
  const { setVisibility, reset } = useFooterVisibility();

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
