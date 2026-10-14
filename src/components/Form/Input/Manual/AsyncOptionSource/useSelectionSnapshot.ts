"use client";

// src/components/Form/Input/Manual/AsyncOptionSource/useSelectionSnapshot.ts
//
// 複数選択ピッカーの「選択済み」タブ用 session snapshot。
// open 時の選択値で初期化し、session 中に新しく選択した値は末尾に追加する。
// 解除しても snapshot からは消さない（「未選択」としてリストに残り、再選択できる）。
// close で破棄し、次回 open 時に最新の値から作り直す（start を呼び直す）。

import { useCallback, useState } from "react";

import { serializeOptionValue, type OptionPrimitive } from "@/components/Form/utils";

export function useSelectionSnapshot() {
  const [snapshot, setSnapshot] = useState<OptionPrimitive[]>([]);

  /** open 時: 現在の選択値で snapshot を作り直す */
  const start = useCallback((values: OptionPrimitive[]) => {
    setSnapshot([...values]);
  }, []);

  /** 選択追加時: 未収録なら末尾に追加（順序固定） */
  const add = useCallback((value: OptionPrimitive) => {
    const key = serializeOptionValue(value);
    setSnapshot((prev) => {
      const exists = prev.some((v) => serializeOptionValue(v) === key);
      return exists ? prev : [...prev, value];
    });
  }, []);

  return { snapshot, start, add } as const;
}
