// src/config/app/acquisition.config.ts

/**
 * サインアップ流入経路計測（userAcquisition）の設定
 *
 * 訪問者の流入タッチ（UTM パラメータ / クリック ID / 外部リファラー）を
 * cookie に蓄積し、サインアップ本登録時に user_acquisitions /
 * user_acquisition_touches へ確定保存するための設定。
 */
export const ACQUISITION_CONFIG = {
  /**
   * 計測全体の有効 / 無効（cookie 蓄積・確定保存の両方を制御）。
   * デフォルト無効。downstream で流入経路計測が必要になったら true にする（オプトイン）。
   * 有効化した時点以降のサインアップから蓄積される（過去のサインアップには遡及できない）。
   */
  enabled: false,

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
   * ユーザー紹介（referral / referralReward）の招待リンク用 URL パラメータ。
   * 例: https://example.com/lp?invite=ABC123
   *
   * ここで定義するのは「解析」側の扱い: このパラメータ付き訪問をタッチとして記録し、
   * UTM 無指定なら下記 source / medium を補完する。medium は GA が外部サイト流入に
   * 自動分類する "referral" と混ざらないよう別語彙にしている。
   * コード自体は extras[param] に保存され「どの紹介者経由か」まで追える。
   *
   * 紹介リワードの「機能」（フォームプリフィル / 本登録時の自動適用）は referral 側の
   * 専用 cookie が担い、本 config の enabled とは独立して動く
   * （param 名の語彙だけ referral/lib/inviteLinkCookie.ts と共有される）。
   */
  referralParam: {
    param: "invite",
    source: "invite",
    medium: "invite",
  },

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
