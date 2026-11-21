// src/lib/siteTheme/SiteThemeSync.tsx

"use client";

import { useSiteThemeSync } from "./stores";

/**
 * サイトテーマを <html> と同期する常駐コンポーネント。root layout に 1 つだけ置く。
 *
 * 役割分担:
 * - bootstrap script(app/layout.tsx の <head>): location.pathname・保存値・OS 設定から dark クラスと data-area を
 *   body 描画前に決める(フラッシュ防止。root layout は request を読まず、SSR の <html> には付けない)
 * - このコンポーネント: クライアント遷移・切替操作・OS 設定変化のたびに再解決して DOM を更新
 *
 * 描画は何もしない。
 */
export function SiteThemeSync() {
  useSiteThemeSync();
  return null;
}
