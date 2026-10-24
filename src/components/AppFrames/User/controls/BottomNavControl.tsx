"use client";

import { useEffect, useId } from "react";

import {
  useBottomNavVisibility,
  type BottomNavVisibility,
} from "../contexts/BottomNavVisibilityContext";

export type HideBottomNavProps = {
  /** スマホでボトムナビを非表示にする */
  sp?: boolean;
  /** PCでボトムナビを非表示にする */
  pc?: boolean;
};

/**
 * ページ単位でボトムナビゲーションの表示/非表示を制御するコンポーネント
 *
 * @example
 * // 両方非表示（props未指定で両方非表示）
 * <HideBottomNav />
 *
 * @example
 * // スマホのみ非表示（デフォルトはスマホのみ表示なので、これで完全非表示になる）
 * <HideBottomNav sp />
 *
 * @example
 * // PCでも表示したい場合（ShowBottomNav的な使い方）
 * // → useBottomNavVisibilityを直接使用してください
 */
export const HideBottomNav = ({ sp, pc }: HideBottomNavProps) => {
  // 自分の上書きとして登録し、アンマウント時は自分の分だけ外す(他ページの Hide* を巻き込まない)
  const id = useId();
  const { setOverride, clearOverride } = useBottomNavVisibility();

  useEffect(() => {
    // 両方未指定の場合は両方非表示
    const hideAll = sp === undefined && pc === undefined;

    if (hideAll) {
      setOverride(id, { sp: false, pc: false });
    } else {
      // 指定されたものだけを変更（未指定のものはデフォルトを維持）
      const updates: Partial<BottomNavVisibility> = {};
      if (sp !== undefined) {
        updates.sp = !sp;
      }
      if (pc !== undefined) {
        updates.pc = !pc;
      }
      setOverride(id, updates);
    }

    return () => {
      clearOverride(id);
    };
  }, [id, sp, pc, setOverride, clearOverride]);

  return null;
};
