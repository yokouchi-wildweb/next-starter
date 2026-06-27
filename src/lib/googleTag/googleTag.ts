// src/lib/googleTag/googleTag.ts

/**
 * Google tag (gtag.js) + Google Ads コンバージョン計測
 * - すべて NEXT_PUBLIC_* env 駆動。未設定なら完全 no-op
 * - Firebase Analytics と window.gtag / dataLayer を共存（既存があれば再利用・上書き禁止）
 * - クライアント専用（SSR では何もしない）
 */

const GOOGLE_TAG_ID = process.env.NEXT_PUBLIC_GOOGLE_TAG_ID; // GA4: G-XXXXXXX
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID; // Ads: AW-XXXXXXX

/**
 * named コンバージョンのレジストリ（env から解決）
 * - 値は "AW-XXXXXXX/label" 形式の send_to。未設定キーは undefined（= no-op）
 * - コアの共有ライフサイクル点（signup / coinPurchase）を初期登録
 * - downstream 独自のコンバージョンは、自前の env を読んで
 *   trackGoogleAdsConversion({ sendTo }) を直接呼べばよい（本レジストリ／lib の改修不要）
 */
export const GOOGLE_ADS_CONVERSIONS = {
  signup: process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_SIGNUP,
  coinPurchase: process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_COIN_PURCHASE,
} as const;

export type GoogleAdsConversionKey = keyof typeof GOOGLE_ADS_CONVERSIONS;

type GtagWindow = typeof window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

let initialized = false;

/**
 * Google tag が有効か（GA4 もしくは Ads のいずれかの ID が設定済み）
 */
export function isGoogleTagEnabled(): boolean {
  return !!(GOOGLE_TAG_ID || GOOGLE_ADS_ID);
}

/**
 * window.gtag / dataLayer を確保する
 * - 既に存在する場合（Firebase Analytics 等）は再利用し、決して上書きしない
 */
function ensureGtag(win: GtagWindow): NonNullable<GtagWindow["gtag"]> {
  win.dataLayer = win.dataLayer || [];
  if (!win.gtag) {
    win.gtag = function gtag() {
      // gtag.js 公式 shim と同形（arguments をそのまま dataLayer へ）
      win.dataLayer!.push(arguments);
    };
  }
  return win.gtag;
}

/**
 * Google tag を初期化
 * - SSR では何もしない
 * - ID 未設定なら何もしない
 * - 冪等（複数回呼んでも loader 注入・config は一度だけ）
 * - Firebase Analytics 等が既に gtag.js を読み込んでいれば loader は再注入しない
 */
export function initGoogleTag(): void {
  if (typeof window === "undefined") return;
  if (initialized) return;
  if (!isGoogleTagEnabled()) return;

  const win = window as GtagWindow;
  const gtag = ensureGtag(win);

  // loader（gtag.js）が未読み込みのときだけ 1 度注入する
  const hasLoader = !!document.querySelector(
    'script[src*="googletagmanager.com/gtag/js"]'
  );
  if (!hasLoader) {
    const primaryId = GOOGLE_TAG_ID || GOOGLE_ADS_ID;
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${primaryId}`;
    document.head.appendChild(script);
    gtag("js", new Date());
  }

  // 1 つの loader に対し複数 ID の config が可能（GA4 と Ads を併載）
  if (GOOGLE_TAG_ID) gtag("config", GOOGLE_TAG_ID);
  if (GOOGLE_ADS_ID) gtag("config", GOOGLE_ADS_ID);

  initialized = true;
}

type ConversionParams = {
  /** "AW-XXXXXXX/label" 形式の send_to。空（undefined / "")なら no-op */
  sendTo: string | undefined;
  /** コンバージョン値 */
  value?: number;
  /** 通貨コード（例: "JPY"） */
  currency?: string;
  /** 重複計上防止用のトランザクションID */
  transactionId?: string;
};

/**
 * Google Ads コンバージョンを送信する低レベル API
 * - sendTo が空、もしくは gtag 不在（SSR / 未初期化 / 未設定）なら no-op
 * - downstream が独自のコンバージョンを発火する際の汎用エスケープハッチ
 */
export function trackGoogleAdsConversion({
  sendTo,
  value,
  currency,
  transactionId,
}: ConversionParams): void {
  if (!sendTo) return;
  if (typeof window === "undefined") return;

  const win = window as GtagWindow;
  if (!win.gtag) return;

  const payload: Record<string, unknown> = { send_to: sendTo };
  if (value !== undefined) payload.value = value;
  if (currency !== undefined) payload.currency = currency;
  if (transactionId !== undefined) payload.transaction_id = transactionId;

  win.gtag("event", "conversion", payload);
}
