// src/features/core/messaging/hooks/useCopyMessageVariable.ts
// 変数のチップを押した時の流れ: '{{変数名}}' をクリップボードに写し、短い知らせを出す(D78)。
// クリップボードが使えない(権限・古いブラウザ)時は黙って何もしない。部品 AllowedKeysHint の onCopyKey に渡す

"use client";

import { useCallback } from "react";

import { useToast } from "@/lib/toast";

export function useCopyMessageVariable() {
  const { showToast } = useToast();
  return useCallback(
    async (key: string) => {
      const text = `{{${key}}}`;
      try {
        if (!navigator.clipboard?.writeText) return;
        await navigator.clipboard.writeText(text);
        showToast(`${text} をコピーしました`, "success");
      } catch {
        // 写せない時は黙る(画面の操作は止めない)
      }
    },
    [showToast],
  );
}
