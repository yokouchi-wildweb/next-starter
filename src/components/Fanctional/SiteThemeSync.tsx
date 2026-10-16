// src/components/Fanctional/SiteThemeSync.tsx

"use client";

import { useSiteThemeSync } from "@/stores/siteTheme";

/**
 * サイトテーマを <html> と同期する常駐コンポーネント。root layout に 1 つだけ置く。
 *
 * 役割分担:
 * - SSR(app/layout.tsx): x-pathname からエリアを判定し dark クラスと data-area を初期出力
 * - bootstrap script(同 layout の <head>): 保存値と OS 設定を body 描画前に反映(フラッシュ防止)
 * - このコンポーネント: クライアント遷移・切替操作・OS 設定変化のたびに再解決して DOM を更新
 *
 * 描画は何もしない。
 */
export function SiteThemeSync() {
  useSiteThemeSync();
  return null;
}
