// src/features/core/purchaseRequest/types/payment.ts

import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities/model";
import type { PurchaseTypeKey } from "@/config/app/purchaseType.config";
import type { WalletTypeValue } from "@/features/core/wallet/types/field";

/**
 * 購入者住所情報（決済ページで事前入力）
 * Square の buyer_address に対応するプロバイダ非依存な型
 */
export type BuyerAddress = {
  /** 名（名前） */
  firstName?: string;
  /** 姓 */
  lastName?: string;
  /** 住所1行目（番地等） */
  addressLine1?: string;
  /** 住所2行目（建物名等） */
  addressLine2?: string;
  /** 市区町村 */
  locality?: string;
  /** 都道府県 */
  administrativeArea?: string;
  /** 郵便番号 */
  postalCode?: string;
  /** 国コード（ISO 3166-1 alpha-2） */
  country?: string;
};

/**
 * 決済セッション作成パラメータ
 */
export type CreatePaymentSessionParams = {
  /** 購入リクエストID */
  purchaseRequestId: string;
  /** 支払い金額（円） */
  amount: number;
  /** ユーザーID */
  userId: string;
  /**
   * ユーザーが選択した支払い方法 ID。
   * paymentConfig.paymentMethods[i].id と一致する値（例: "credit_card", "convenience_store"）。
   * 各プロバイダはこの値を providerConfig.methodMapping 経由で API 固有 ID に変換して使用する。
   */
  paymentMethod: string;
  /** 支払い成功時のリダイレクト先 */
  successUrl: string;
  /** キャンセル時のリダイレクト先 */
  cancelUrl: string;
  /** 追加メタデータ */
  metadata?: Record<string, string>;
  /** 購入者メールアドレス（決済ページで事前入力） */
  buyerEmail?: string;
  /** 購入者電話番号（E.164形式、決済ページで事前入力） */
  buyerPhoneNumber?: string;
  /** 購入者住所情報（決済ページで事前入力） */
  buyerAddress?: BuyerAddress;
  /** プロバイダ固有のオプション（下流から自由に渡せる） */
  providerOptions?: Record<string, unknown>;
  /**
   * 購入の履行形態（wallet_topup / direct_sale 等）。
   * 自社プロバイダが purchase_type 別に振る舞いを変えたい場合に参照する。
   */
  purchaseType?: PurchaseTypeKey;
  /**
   * 加算対象のウォレット種別（wallet_topup のときのみ非 null）。
   * 自社内の遷移先 URL を組み立てる必要があるプロバイダ（例: 自社銀行振込の振込案内ページ）が
   * slug 解決のために使う。外部決済プロバイダは通常使用しない。
   */
  walletType?: WalletTypeValue | null;
  /**
   * アプリのオリジン URL（例: https://example.com）。
   * 自社内の絶対 URL を組み立てる必要があるプロバイダで使用する。
   * 通常の外部リダイレクト型プロバイダは successUrl / cancelUrl で十分なので参照しない。
   */
  baseUrl?: string;
};

/**
 * 決済の起動指示。
 *
 * 各 provider の createSession が「クライアントが決済をどう開始するか」を表現して返す。
 * クライアント側の起動レイヤ (executePaymentLaunch) が type で分岐し、対応する handler に
 * dispatch する。新たな起動方式（QR ポーリング・デバイス API 等）を追加する場合は、
 * このユニオン型に variant を追加し、対応する LaunchHandler を実装するだけで済む。
 */
export type LaunchInstruction = LaunchRedirect | LaunchClientSdk;

/**
 * リダイレクト型: 既存の Stripe / Fincode / Square / inhouse 等が返す。
 * url は外部プロバイダのホスト型決済ページ URL でも、自社内の遷移先 URL でも可。
 * クライアントは window.location.href にこの url を代入して即時遷移する。
 */
export type LaunchRedirect = {
  type: "redirect";
  /** ブラウザが遷移する URL */
  url: string;
};

/**
 * クライアント SDK 起動型: Paidy 等が返す。
 * クライアント側で sdkName で識別される JS SDK を読み込み、config を渡して起動する。
 * 完了結果はクライアント側で受け取り、確定 API (/api/wallet/purchase/[id]/[provider]/confirm)
 * を呼び出して購入を確定させる。
 */
export type LaunchClientSdk = {
  type: "client_sdk";
  /** クライアント側 SDK ローダーレジストリのキー（"paidy" 等） */
  sdkName: string;
  /**
   * SDK 起動に必要なクライアント可視の設定。
   * 例: { publicKey, amount, currency, purchaseRequestId, buyer, storeName, ... }
   * 値はクライアントに直接渡るため、サーバー秘密 (sk_*) を含めてはならない。
   */
  config: Record<string, unknown>;
};

/**
 * 決済セッション
 */
export type PaymentSession = {
  /** 決済サービス側のセッションID（client_sdk 型では purchase_request.id を流用してよい） */
  sessionId: string;
  /** クライアントへの起動指示。type に応じてリダイレクト or SDK 起動が走る */
  instruction: LaunchInstruction;
  /** セッションの有効期限 */
  expiresAt?: Date;
};

/**
 * 決済結果（Webhook から取得）
 */
export type PaymentResult = {
  /** 決済成功かどうか */
  success: boolean;
  /**
   * Webhookのステータス分類。
   * - "completed": 決済成功（completePurchase を実行）
   * - "failed": 決済失敗確定（failPurchase を実行）
   * - "pending": 未確定（何もせず 200 を返す）
   * 未指定の場合は success で判定（後方互換）
   */
  status?: "completed" | "failed" | "pending";
  /** 決済サービス側のセッションID */
  sessionId: string;
  /** プロバイダ側の取引ID（問い合わせ・追跡用） */
  transactionId?: string;
  /** 実際に使用された支払い方法 */
  paymentMethod?: string;
  /** 支払い完了日時 */
  paidAt?: Date;
  /** プロバイダ固有データ（デバッグ用） */
  rawResponse?: unknown;
  /** プロバイダが実際に課金した金額（Webhookペイロードから取得、照合用） */
  paidAmount?: number;
  /** エラーコード */
  errorCode?: string;
  /** エラーメッセージ */
  errorMessage?: string;
};

/**
 * provider.validateInitiation に渡されるコンテキスト。
 *
 * initiatePurchase が「冪等キーで既存が見つからなかった新規リクエスト」に対し、
 * purchase_request 作成の直前にプロバイダ固有の事前チェックを実行する用途で使う。
 * （冪等キー再利用の pending 上書きケースでは呼ばれない。自分自身を並行扱いにしないため。）
 */
export type InitiationGuardContext = {
  userId: string;
  /** ユーザーが選択した支払い方法 ID（payment.config.ts の paymentMethods[i].id） */
  paymentMethod: string;
  /** 購入の履行形態 */
  purchaseType: PurchaseTypeKey;
  /** 加算対象ウォレット種別（wallet_topup のときのみ非 null） */
  walletType: WalletTypeValue | null;
};

/**
 * provider.validateInitiation の戻り値。
 *
 * - undefined を返した場合は通常通り新規 purchase_request の作成に進む。
 * - { kind: "redirect", existing } を返した場合、initiatePurchase は新規作成せず、
 *   その既存リクエストを handleExistingRequest 相当のレスポンスとしてクライアントに返す。
 *   （自社銀行振込の「同一ユーザーで未完了の振込が既にある場合は新規作成せず既存案内ページへ」用途）
 */
export type InitiationGuardResult =
  | { kind: "redirect"; existing: PurchaseRequest }
  | undefined;

/**
 * 決済ステータス照会結果（ポーリング用）
 */
export type PaymentStatusResult = {
  /** 決済ステータス */
  status: "pending" | "processing" | "completed" | "failed" | "expired";
  /** 決済サービス側のセッションID */
  sessionId: string;
  /** プロバイダ側の取引ID */
  transactionId?: string;
  /** 支払い完了日時 */
  paidAt?: Date;
  /** エラーコード */
  errorCode?: string;
  /** エラーメッセージ */
  errorMessage?: string;
};

/**
 * 決済プロバイダインターフェース
 * 各決済サービス（KOMOJU, Stripe等）はこのインターフェースを実装する
 *
 * 起動方式の区別は createSession が返す LaunchInstruction.type で表現する
 * （フィールドではなく値で多態化する設計）。新しい起動方式を追加する場合は
 * LaunchInstruction にバリアントを追加する。
 */
export interface PaymentProvider {
  /** プロバイダ名 */
  readonly providerName: string;

  /**
   * 決済セッションを作成
   * @param params セッション作成パラメータ
   * @returns 決済セッション情報（LaunchInstruction を含む）
   */
  createSession(params: CreatePaymentSessionParams): Promise<PaymentSession>;

  /**
   * Webhookペイロードを検証・パース
   * @param request HTTPリクエスト
   * @returns 決済結果
   */
  verifyWebhook(request: Request): Promise<PaymentResult>;

  /**
   * Webhook署名を検証（本文解析前の検証）
   * @param request HTTPリクエスト（clone済み）
   * @param signature 署名ヘッダーの値
   * @returns 署名が有効かどうか
   */
  verifyWebhookSignature?(request: Request, signature: string): Promise<boolean>;

  /**
   * 決済ステータスを照会（Webhook未着時のフォールバック用）
   * @param sessionId 決済セッションID
   * @param paymentMethod 共通 paymentMethod ID（プロバイダによっては照会 API の引数に必要）
   * @returns 決済ステータス
   */
  getPaymentStatus?(sessionId: string, paymentMethod?: string): Promise<PaymentStatusResult>;

  /**
   * 新規 purchase_request 作成の直前に呼ばれるプロバイダ固有の事前チェック。
   *
   * 冪等キーによる既存 pending の再利用ケースでは呼ばれない（自分自身を並行扱いしないため）。
   * 同一ユーザーが既に未完了の同種リクエストを持っている場合に、新規作成を阻止して
   * 既存リクエストを再開させたいプロバイダ（自社銀行振込など）が実装する。
   *
   * - undefined を返す → 新規作成へ進む
   * - { kind: "redirect", existing } を返す → 新規作成せず既存リクエストへ誘導
   * - throw する → そのままエラーレスポンス（DomainError 等）
   *
   * 外部決済プロバイダ（Square / Fincode 等）は通常実装不要。
   */
  validateInitiation?(ctx: InitiationGuardContext): Promise<InitiationGuardResult>;
}
