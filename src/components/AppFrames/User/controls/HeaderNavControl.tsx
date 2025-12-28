"use client";

import { useEffect } from "react";
import { useHeaderNavVisibility } from "../contexts/HeaderNavVisibilityContext";

export type HideHeaderNavProps = {
  /** スマホでヘッダーナビを非表示にする */
  sp?: boolean;
  /** PCでヘッダーナビを非表示にする */
  pc?: boolean;
};

/**
 * ページ単位でヘッダーナビゲーションの表示/非表示を制御するコンポーネント
 * ヘッダー自体は表示したまま、メニュー部分のみ非表示にできる
 *
 * @example
 * // 両方非表示（props未指定で両方非表示）
 * <HideHeaderNav />
 *
 * @example
 * // スマホのみ非表示
 * <HideHeaderNav sp />
 *
 * @example
 * // PCのみ非表示
 * <HideHeaderNav pc />
 */
export const HideHeaderNav = ({ sp, pc }: HideHeaderNavProps) => {
  const { setVisibility, reset } = useHeaderNavVisibility();

  useEffect(() => {
    // 両方未指定の場合は両方非表示
    const hideAll = sp === undefined && pc === undefined;
    const hideSp = hideAll || sp === true;
    const hidePc = hideAll || pc === true;

    setVisibility({
      sp: !hideSp,
      pc: !hidePc,
    });

    return () => {
      reset();
    };
  }, [sp, pc, setVisibility, reset]);

  return null;
};
