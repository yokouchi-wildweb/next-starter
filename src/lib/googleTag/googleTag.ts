// src/lib/googleTag/googleTag.ts

/**
 * Google tag (gtag.js) + Google Ads コンバージョン計測
 * - すべて NEXT_PUBLIC_* env 駆動。未設定なら完全 no-op
 * - Firebase Analytics と window.gtag / dataLayer を共存（既存があれば再利用・上書き禁止）
 * - クライアント専用（SSR では何もしない）
 */

import { ACQUISITION_CONFIG } from "@/config/app/acquisition.config";

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

/**
 * リファラーを無視するパス（外部リダイレクト決済からの戻りルート）
 *
 * 背景: リダイレクト型決済（Stripe / fincode / Square 等）から戻ると、
 * リファラーが決済ドメインになり GA4 がセッションの参照元を上書きする
 * （stripe.com は Google の参照元カテゴリで「ショッピングサイト」扱いのため
 * Organic Shopping に振り分けられる）。該当ルートへのランディング時は
 * `ignore_referrer: true` を config に付与し、元の流入元セッションを維持する。
 *
 * GA4 管理画面の「除外する参照のリスト」でも対処できるが、フォーク先ごとの
 * 設定漏れを防ぐためコード側で常時無視する（二重に設定しても害はない）。
 */
const DEFAULT_IGNORE_REFERRER_PATTERNS: RegExp[] = [
  // 決済戻り: /wallet/{slug}/purchase/{callback|complete|failed}
  /^\/wallet\/[^/]+\/purchase\/(callback|complete|failed)(\/|$)/,
];

/**
 * リファラーを無視するドメインの denylist（外部リダイレクトの中間ドメイン）
 *
 * パス判定は「決まったルートに戻る」決済フローにしか効かない。
 * Firebase Auth の signInWithRedirect はログインを開始した任意のページに
 * 戻ってくるため、「どこから戻ってきたか」= リファラードメインで判定する。
 * サブドメインも一致対象（例: checkout.stripe.com は stripe.com にマッチ）。
 */
const DEFAULT_IGNORE_REFERRER_DOMAINS: string[] = [
  // Firebase Auth signInWithRedirect（authDomain 既定 = {project}.firebaseapp.com）
  "firebaseapp.com",
  // リダイレクト型決済プロバイダ
  "stripe.com",
  "fincode.jp",
  "square.site",
  "squareup.com",
  // GMO-PG（fincode カード決済の 3D セキュア認証ページ front.secure.gmopg.jp 等）
  "gmopg.jp",
  // PayPal（JS SDK だがモバイル等でフルページリダイレクトにフォールバックしうる）
  "paypal.com",
  // LINE ログインの認可画面。line.me 全体は無視しない
  // （LINE トーク・公式アカウント配信からの本物の流入まで消えるため）
  "access.line.me",
];

export type GoogleTagInitOptions = {
  /**
   * リファラーを無視するパスの追加パターン（デフォルトにマージ）
   * downstream が独自の外部リダイレクト戻りルートを持つ場合に指定
   */
  ignoreReferrerPaths?: RegExp[];
  /**
   * リファラーを無視するドメインの追加 denylist（デフォルトにマージ）
   * downstream が独自の決済・外部認証プロバイダを使う場合に指定
   * （サブドメイン込みで一致。例: "example.com" は pay.example.com にもマッチ）
   */
  ignoreReferrerDomains?: string[];
};

/**
 * リファラー無視対象か（パス判定 OR リファラードメイン判定）
 * - パス判定: 決済戻りルートへのランディング（リファラーが取れない環境でも効く）
 * - ドメイン判定: 既知の中間ドメイン（認証・決済）から戻ってきた場合
 */
function shouldIgnoreReferrer(
  win: GtagWindow,
  options?: GoogleTagInitOptions
): boolean {
  const patterns = options?.ignoreReferrerPaths
    ? [...DEFAULT_IGNORE_REFERRER_PATTERNS, ...options.ignoreReferrerPaths]
    : DEFAULT_IGNORE_REFERRER_PATTERNS;
  if (patterns.some((pattern) => pattern.test(win.location.pathname))) {
    return true;
  }

  const referrer = win.document.referrer;
  if (!referrer) return false;
  let referrerHost: string;
  try {
    referrerHost = new URL(referrer).hostname;
  } catch {
    return false;
  }
  const domains = options?.ignoreReferrerDomains
    ? [...DEFAULT_IGNORE_REFERRER_DOMAINS, ...options.ignoreReferrerDomains]
    : DEFAULT_IGNORE_REFERRER_DOMAINS;
  return domains.some(
    (domain) => referrerHost === domain || referrerHost.endsWith(`.${domain}`)
  );
}

/**
 * 招待リンク（?invite=CODE）のみで流入した場合の GA4 手動キャンペーン値を解決する。
 *
 * 背景: GA4 は utm_* / クリック ID しか流入元判定に使わず、独自の invite
 * パラメータは無視される。X 等でシェアされた招待リンクからの流入が
 * 「t.co / referral」や「(direct) / (none)」に分類されてしまうため、
 * campaign_source / campaign_medium を config で明示し、独自チャンネル
 * （既定: invite / invite）としてセッションを分類させる。
 *
 * 優先順位はサービス側 DB 解析（attributionCookie の source/medium 補完）と同一:
 * UTM > クリック ID > 招待リンク。UTM またはクリック ID がある場合は
 * GA 本来の判定（あるいは招待リンクへの utm 併記）を尊重して何もしない。
 * 語彙は ACQUISITION_CONFIG.referralParam を共有（downstream の変更に両側が追随）。
 *
 * 注意: これはセッションの参照元/メディアの割り当てまで。GA4 のチャンネル
 * グループ表示で「invite」を独自チャンネルとしてまとめたい場合は、GA 側で
 * source=invite を条件にしたカスタムチャンネルグループを別途作成する（任意）。
 */
export function resolveInviteCampaign(
  search: string
): { campaign_source: string; campaign_medium: string } | null {
  const params = new URLSearchParams(search);

  if (!params.get(ACQUISITION_CONFIG.referralParam.param)?.trim()) return null;

  // UTM 明示指定が最優先（招待リンクに utm を併記する運用も尊重）
  if (params.get("utm_source") || params.get("utm_medium") || params.get("utm_campaign")) {
    return null;
  }
  // クリック ID があれば広告流入として GA / Ads の自動判定に任せる
  for (const clickIdParam of Object.keys(ACQUISITION_CONFIG.clickIdParams)) {
    if (params.get(clickIdParam)) return null;
  }

  return {
    campaign_source: ACQUISITION_CONFIG.referralParam.source,
    campaign_medium: ACQUISITION_CONFIG.referralParam.medium,
  };
}

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
export function initGoogleTag(options?: GoogleTagInitOptions): void {
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
  // 決済・認証リダイレクト戻り時は中間ドメインによる参照元上書きを抑止。
  // config パラメータは以後のイベントにも引き継がれるが、ランディング後の
  // SPA 遷移のリファラーは同一オリジンのため実害はない
  const ga4Params: Record<string, unknown> = {};

  if (shouldIgnoreReferrer(win, options)) {
    ga4Params.ignore_referrer = true;
  }

  // 招待リンクのみでの流入は独自チャンネル（invite/invite）としてセッションを分類。
  // リファラー（t.co 等）による上書きを防ぐため ignore_referrer も併せて付与
  const inviteCampaign = resolveInviteCampaign(win.location.search);
  if (inviteCampaign) {
    ga4Params.campaign_source = inviteCampaign.campaign_source;
    ga4Params.campaign_medium = inviteCampaign.campaign_medium;
    ga4Params.ignore_referrer = true;
  }

  if (GOOGLE_TAG_ID) {
    gtag(
      "config",
      GOOGLE_TAG_ID,
      ...(Object.keys(ga4Params).length > 0 ? [ga4Params] : [])
    );
  }
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
