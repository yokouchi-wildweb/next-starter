"use client";

// src/lib/clarity/MicrosoftClarity.tsx

import { useEffect } from "react";
import { initClarity } from "./clarity";

/**
 * Microsoft Clarity 初期化コンポーネント
 * - マウント時に Clarity スクリプトを初期化
 * - NEXT_PUBLIC_MICROSOFT_CLARITY_ID が未設定の場合は何もしない
 */
export function MicrosoftClarity() {
  useEffect(() => {
    initClarity();
  }, []);

  return null;
}
