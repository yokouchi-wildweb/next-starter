// src/config/app/acquisition.config.ts

/**
 * サインアップ流入経路計測（userAcquisition）の設定
 *
 * 訪問者の流入タッチ（UTM パラメータ / クリック ID / 外部リファラー）を
 * cookie に蓄積し、サインアップ本登録時に user_acquisitions /
 * user_acquisition_touches へ確定保存するための設定。
 */
export const ACQUISITION_CONFIG = {
  /** 計測全体の有効 / 無効。false にすると cookie 蓄積・保存とも停止する */
  enabled: true,

  /**
   * タッチ履歴 cookie の有効期間（日）。
   * タッチを追記するたびに maxAge をリフレッシュするため、
   * 実質「最終タッチからこの日数」が遡り可能期間になる。
   */
  cookieMaxAgeDays: 30,

  /**
   * cookie に保持するタッチ数の上限（cookie 4KB 制限対策）。
   * 超過時は first-touch を必ず保持し、古い中間タッチから間引く
   * （アトリビューション分析では first / last が最重要のため）。
   */
  maxTouches: 15,

  /**
   * 広告クリック ID として認識する URL パラメータと、
   * UTM が無い場合に補完する source / medium（GA の慣例に準拠）。
   * 値の null は「クリック ID は extras に保存するが source/medium は導出しない」の意。
   */
  clickIdParams: {
    gclid: { source: "google", medium: "cpc" },
    wbraid: { source: "google", medium: "cpc" },
    gbraid: { source: "google", medium: "cpc" },
    fbclid: { source: "facebook", medium: "paid-social" },
    ttclid: { source: "tiktok", medium: "paid-social" },
    msclkid: { source: "bing", medium: "cpc" },
    yclid: { source: "yahoo", medium: "cpc" },
    twclid: { source: "twitter", medium: "paid-social" },
    ldtag_cl: { source: "line", medium: "paid-social" },
  } as Record<string, { source: string; medium: string } | null>,
} as const;
