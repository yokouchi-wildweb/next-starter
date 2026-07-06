"use client";

// src/lib/googleTag/GoogleTag.tsx

import { useEffect } from "react";
import { initGoogleTag, type GoogleTagInitOptions } from "./googleTag";

type GoogleTagProps = {
  /**
   * リファラーを無視するパスの追加パターン（デフォルトの決済戻りルートにマージ）
   * downstream が独自の外部リダイレクト戻りルートを持つ場合に指定
   */
  ignoreReferrerPaths?: GoogleTagInitOptions["ignoreReferrerPaths"];
  /**
   * リファラーを無視するドメインの追加 denylist（デフォルトにマージ）
   * downstream が独自の決済・外部認証プロバイダを使う場合に指定
   */
  ignoreReferrerDomains?: GoogleTagInitOptions["ignoreReferrerDomains"];
};

/**
 * Google tag 初期化コンポーネント
 * - マウント時に gtag.js を初期化
 * - NEXT_PUBLIC_GOOGLE_TAG_ID / NEXT_PUBLIC_GOOGLE_ADS_ID が未設定なら何もしない
 * - ルートレイアウト body 内に配置する
 */
export function GoogleTag({
  ignoreReferrerPaths,
  ignoreReferrerDomains,
}: GoogleTagProps) {
  useEffect(() => {
    initGoogleTag({ ignoreReferrerPaths, ignoreReferrerDomains });
    // 初期化は冪等かつ初回ランディング時の 1 回で確定するため依存は空
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
