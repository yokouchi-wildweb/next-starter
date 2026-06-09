// src/features/core/purchaseRequest/services/server/payment/paypal/payPalClient.ts
//
// PayPal REST API クライアント（サーバー専用）。
//
// 役割:
// - 環境（sandbox / live）に応じた API ベース URL の解決。
// - OAuth2 client_credentials によるアクセストークンの取得とメモリキャッシュ。
// - Orders API / Webhook 検証 API を叩くための共通 fetch ラッパ。
//
// 設計の要点:
// - Paidy は test/本番が同一エンドポイントでキー prefix で切り替わるが、PayPal は
//   sandbox（api-m.sandbox.paypal.com）と live（api-m.paypal.com）で **API ホストが異なる**。
//   そのため PAYPAL_ENV による明示的な切替を必須とする。
// - アクセストークンは expires_in（通常 ~9 時間）まで有効なので、毎リクエスト取得せず
//   モジュールスコープにキャッシュする。安全マージン（60 秒）を引いて期限を判定する。
// - クライアントに渡る値（publicKey 相当 = PAYPAL_CLIENT_ID）と、サーバー秘密
//   （PAYPAL_CLIENT_SECRET / PAYPAL_WEBHOOK_ID）を明確に分離する。

/**
 * PayPal の実行環境。
 * - sandbox: 開発・疎通確認用（実決済が走らない）
 * - live: 本番
 *
 * API ホストが環境ごとに異なるため、キー prefix ではなくこの値で切り替える。
 */
export type PayPalEnv = "sandbox" | "live";

/**
 * PayPal サーバー設定。
 * createSession / capture / fetchOrder / verifyWebhookSignature から共有される。
 */
export type PayPalConfig = {
  /** クライアント JS SDK に渡す公開 ID（pk 相当） */
  clientId: string;
  /** サーバーから REST API を叩くためのシークレット */
  clientSecret: string;
  /** 実行環境（sandbox / live） */
  env: PayPalEnv;
  /** REST API のベース URL（環境により異なる） */
  apiBaseUrl: string;
};

/**
 * 環境ごとの REST API ベース URL。
 * 公式: https://developer.paypal.com/api/rest/ (sandbox / live エンドポイント)
 */
const PAYPAL_API_BASE_URL: Record<PayPalEnv, string> = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
};

/**
 * PAYPAL_ENV を正規化する。未指定時は sandbox にフォールバックして事故（誤って live を叩く）を防ぐ。
 */
function resolveEnv(): PayPalEnv {
  const raw = (process.env.PAYPAL_ENV ?? "sandbox").toLowerCase();
  if (raw === "live" || raw === "production") {
    return "live";
  }
  return "sandbox";
}

/**
 * 環境変数から PayPal 設定を解決する。
 * clientId / clientSecret 未設定時は明示的に throw（createSession 等の早期失敗用）。
 */
export function getPayPalConfig(): PayPalConfig {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId) {
    throw new Error("PAYPAL_CLIENT_ID is not configured");
  }
  if (!clientSecret) {
    throw new Error("PAYPAL_CLIENT_SECRET is not configured");
  }

  const env = resolveEnv();
  return {
    clientId,
    clientSecret,
    env,
    apiBaseUrl: PAYPAL_API_BASE_URL[env],
  };
}

/**
 * Webhook 署名検証に使う Webhook ID を取得する。
 * 未設定時は throw（署名検証は本番で必須のため、サイレントに skip させない）。
 */
export function getPayPalWebhookId(): string {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    throw new Error("PAYPAL_WEBHOOK_ID is not configured");
  }
  return webhookId;
}

// ============================================================================
// アクセストークンのキャッシュ
// ============================================================================

type CachedToken = {
  token: string;
  /** 失効する UNIX エポックミリ秒（安全マージン適用済み） */
  expiresAtMs: number;
  /** 取得に使った clientId（キー変更時にキャッシュを無効化するため保持） */
  clientId: string;
  /** 取得に使った環境（環境変更時にキャッシュを無効化するため保持） */
  env: PayPalEnv;
};

/** モジュールスコープのトークンキャッシュ（プロセス内で共有） */
let cachedToken: CachedToken | null = null;

/** トークン失効判定の安全マージン（ミリ秒）。期限ギリギリでの 401 を避ける。 */
const TOKEN_EXPIRY_SAFETY_MARGIN_MS = 60 * 1000;

type OAuthTokenResponse = {
  access_token: string;
  token_type: string;
  /** 秒単位の有効期間 */
  expires_in: number;
};

/**
 * OAuth2 アクセストークンを取得する（client_credentials grant）。
 * 有効なキャッシュがあればそれを返し、無ければ取得してキャッシュする。
 *
 * 公式: POST /v1/oauth2/token, Authorization: Basic base64(clientId:clientSecret)
 */
export async function getPayPalAccessToken(config: PayPalConfig): Promise<string> {
  const now = Date.now();

  // キャッシュが有効で、かつ同一 clientId / 同一環境で取得したものなら再利用
  if (
    cachedToken &&
    cachedToken.clientId === config.clientId &&
    cachedToken.env === config.env &&
    cachedToken.expiresAtMs > now
  ) {
    return cachedToken.token;
  }

  const basicAuth = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
  ).toString("base64");

  const response = await fetch(`${config.apiBaseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `[PayPal] アクセストークン取得に失敗しました: status=${response.status}, body=${body}`,
    );
  }

  const data = (await response.json()) as OAuthTokenResponse;
  cachedToken = {
    token: data.access_token,
    expiresAtMs: now + data.expires_in * 1000 - TOKEN_EXPIRY_SAFETY_MARGIN_MS,
    clientId: config.clientId,
    env: config.env,
  };

  return cachedToken.token;
}

/**
 * Bearer トークン付きで PayPal REST API を叩く共通ラッパ。
 *
 * - アクセストークンの取得・付与を内部で行う。
 * - 401（トークン失効）を受けた場合はキャッシュを捨てて 1 度だけ再試行する。
 * - レスポンスの ok 判定は呼び出し側に委ねる（Response をそのまま返す）。
 *
 * @param path "/v2/checkout/orders" のような先頭スラッシュ付きパス
 * @param init  fetch の RequestInit（method / body / 追加ヘッダー）
 */
export async function payPalFetch(
  config: PayPalConfig,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const doFetch = async (token: string): Promise<Response> => {
    return fetch(`${config.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  };

  let token = await getPayPalAccessToken(config);
  let response = await doFetch(token);

  // 401 はトークン失効の可能性が高い。キャッシュを破棄して 1 度だけ再取得・再試行する。
  if (response.status === 401) {
    cachedToken = null;
    token = await getPayPalAccessToken(config);
    response = await doFetch(token);
  }

  return response;
}
