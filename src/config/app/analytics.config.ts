// src/config/app/analytics.config.ts

/**
 * ブラウザのアクセス解析（ページビュー・カスタムイベントの送信）の設定。
 * どの計測サービスに送るかは env で決まる（今は Firebase Analytics = NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID）。
 * ここは「送ってよいか」だけを決める。判定は isAnalyticsAllowed()（@/lib/analyticsConsent）。
 *
 * 管理画面の DAU などのサーバー側の集計（features/core/analytics）とは別物で、この設定の影響を受けない。
 */
export const ANALYTICS_CONFIG = {
  /**
   * 送信を有効にする。デフォルト無効（オプトイン）。
   * false の間は計測サービスを初期化せず、page_view も trackEvent も何も送らない。
   */
  enabled: false,

  /**
   * 同意の扱い。
   * - "required"（既定）: setAnalyticsConsent("granted") が呼ばれるまで送らない。fork の同意バナー / CMP から呼ぶ
   * - "notRequired": 同意を待たずに送る（同意の取得を求めない運用。fork の判断で明示的に選ぶ）
   */
  consent: "required" as "required" | "notRequired",
};
