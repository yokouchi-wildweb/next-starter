"use client";

// src/lib/googleTag/GoogleTag.tsx

import { useEffect } from "react";
import { initGoogleTag } from "./googleTag";

/**
 * Google tag 初期化コンポーネント
 * - マウント時に gtag.js を初期化
 * - NEXT_PUBLIC_GOOGLE_TAG_ID / NEXT_PUBLIC_GOOGLE_ADS_ID が未設定なら何もしない
 * - ルートレイアウト body 内に配置する
 */
export function GoogleTag() {
  useEffect(() => {
    initGoogleTag();
  }, []);

  return null;
}
