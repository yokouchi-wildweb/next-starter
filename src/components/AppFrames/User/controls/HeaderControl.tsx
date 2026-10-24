"use client";

import { useEffect, useId } from "react";
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
 * // 両方非表示（props未指定で両方非表示）
 * <HideHeader />
 *
 * @example
 * // スマホのみ非表示
 * <HideHeader sp />
 *
 * @example
 * // PCのみ非表示
 * <HideHeader pc />
 */
export const HideHeader = ({ sp, pc }: HideHeaderProps) => {
  // 自分の上書きとして登録し、アンマウント時は自分の分だけ外す(他ページの Hide* を巻き込まない)
  const id = useId();
  const { setOverride, clearOverride } = useHeaderVisibility();

  useEffect(() => {
    // 両方未指定の場合は両方非表示
    const hideAll = sp === undefined && pc === undefined;
    const hideSp = hideAll || sp === true;
    const hidePc = hideAll || pc === true;

    setOverride(id, {
      sp: !hideSp,
      pc: !hidePc,
    });

    return () => {
      clearOverride(id);
    };
  }, [id, sp, pc, setOverride, clearOverride]);

  return null;
};
