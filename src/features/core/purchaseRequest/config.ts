// src/features/core/purchaseRequest/config.ts
// 購入(決済)の設定(既定 + 上書き、設定の議会 D3・D11・D19・D68・D95)。上書きは src/config/features/purchaseRequest.config.ts(このファイルだけが読む)。
// 置き方: src/config/README.md。合成: @/lib/defineConfig。呼び手は purchaseRequestConfig.<鍵> を読む。値を読む関数は ./utils/paymentMethods.ts
//
// 設計原則:
// - **1メソッド = 1プロバイダ**: 各支払い方法は payment.paymentMethods[i].provider で担当プロバイダを明示する（ソースオブトゥルース）。
//   解決は resolveProviderForMethod() を経由する。
// - プロバイダ別の API 名変換は payment.providers[*].methodMapping で表現。
// - ダウンストリームでプロバイダや支払い方法を追加する場合は、上書きの payment.paymentMethods および payment.providers を書く（コードロジックの変更は不要）。
// - 決済機能全体の有効/無効は門番の規則 payment(APP_FEATURES.payment.enabled、false でルート 404 + テーブル未作成)の持ち物で、ここには無い
// - 購入タイプを足す fork は上書きで `export type Extra = { type: { <purchase_type>: PurchaseTypeConfig } }` を宣言して値を書く(PurchaseTypeKey に入る)
//   [!!] 購入タイプの変更後は必ずマイグレーションが必要(purchase_type は DB の値)

import override, { type Extra } from "@/config/features/purchaseRequest.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

/**
 * 支払い方法のステータス
 * - available: 利用可能（決済画面に表示・選択可）
 * - coming_soon: 準備中（UI表示するがバッジ付き・選択不可）
 * - disabled: 無効（UIに表示しない）
 */
export type PaymentMethodStatus = "available" | "coming_soon" | "disabled";

/**
 * 支払い方法の定義
 *
 * provider:
 *   - status="available" の場合は必須。担当プロバイダ名を指定する。
 *   - status="coming_soon" / "disabled" の場合は任意（将来 available 化する際に設定）。
 */
export type PaymentMethodConfig = {
  /** 支払い方法ID */
  id: string;
  /** 表示ラベル */
  label: string;
  /** 補足説明（対応ブランド等、UI表示用） */
  description?: string;
  /** アイコン識別子（UIで使用） */
  icon: string;
  /** ステータス */
  status: PaymentMethodStatus;
  /**
   * 担当プロバイダ名。
   * status="available" の場合は必須（未指定だと resolveProviderForMethod が undefined を返し API が 400 を返す）。
   */
  provider?: string;
};

/**
 * プロバイダ設定
 *
 * methodMapping: 共通 paymentMethod ID → プロバイダ API 固有 ID への変換マップ。
 * - 例: Fincode の "credit_card" → "Card"
 * - mapping が無い場合は paymentMethod ID をそのまま渡す（プロバイダが共通 ID を解釈する場合）。
 *
 * sessionExpiryMinutes: 決済セッション（purchase_request.expires_at）の有効期限（分）。
 * - 未指定時はコア側のデフォルト（30 分）が使われる。
 * - 銀行振込のように振込確定までユーザーの実時間が必要なプロバイダで延長する用途。
 */
export type ProviderConfig = {
  /** 有効/無効 */
  enabled: boolean;
  /** config ID → プロバイダAPI固有ID の変換マップ */
  methodMapping?: Record<string, string>;
  /**
   * 決済セッションの有効期限（分）。
   * 未指定時はデフォルト（PROVIDER_DEFAULT_SESSION_EXPIRY_MINUTES = 30）が適用される。
   */
  sessionExpiryMinutes?: number;
};

/**
 * 自社受付の銀行振込（inhouse プロバイダ）固有の設定。
 *
 * - autoComplete: 振込完了申告 API が呼ばれたときの挙動切替。
 *   - true:  即時に completePurchase を実行し通貨を付与する（管理者確認なし）。
 *   - false: 管理者確認待ちフロー（今回スコープ外。API は 501 を返す）。
 * - account: 振込案内画面に表示する自社の振込先口座情報。事業者ごとに書き換える。
 *
 * このプロバイダは外部 Webhook を持たない自社決済方法のため、振込完了の起点は
 * ユーザーの自己申告 API (POST /api/wallet/purchase/[id]/bank-transfer/confirm) となる。
 */
export type BankTransferConfig = {
  /** 振込完了申告時に即時で通貨を付与するか（false=管理者確認モード・今回スコープ外） */
  autoComplete: boolean;
  /**
   * AI による振込画像の事前判定ステップを有効化するか。
   * - true: 画像添付 → AI 判定 → 通過後のみ申告ボタンが活性化（4ステップ構成）
   * - false: 画像添付 → 即申告ボタン活性化（従来の 3ステップ構成）
   *   Anthropic API キー未設定や AI サービス停止時の緊急バイパスにも使える。
   */
  aiImageJudgmentEnabled: boolean;
  /**
   * AI 判定のストリクトモード。aiImageJudgmentEnabled=true のときのみ有効。
   * - true: 明細内で「①振込人名が読み取れる ②名前の前後どちらかに識別数字（8桁）が
   *   一致して付与されている ③振込金額が一致する」の 3 点すべてを確認できなければ不合格。
   *   確認できない・不鮮明な場合も不合格に倒す（通常モードは「迷ったら通す」）。
   * - false: 従来どおり「振込明細らしい画像か」のざっくり仮判定のみ。
   */
  aiImageJudgmentStrictMode: boolean;
  /** 振込先口座情報（案内画面に表示） */
  account: {
    bankName: string;
    branchName: string;
    /** 支店コード（3 桁数字。案内画面では「支店名 (コード)」形式で表示） */
    branchCode: string;
    accountType: string;
    accountNumber: string;
    accountHolder: string;
  };
};

/**
 * 購入タイプ1件の設定
 */
export type PurchaseTypeConfig = {
  /** 管理画面等で表示する日本語ラベル */
  label: string;
  /**
   * wallet_type カラムを必須とするか
   * - true:  ウォレット加算を伴う購入（例: wallet_topup）
   * - false: ウォレット加算を伴わない購入（例: direct_sale）
   *
   * この値は initiatePurchase / completePurchase のバリデーションで利用される。
   * 戦略レジストリ（completion/strategyRegistry）と整合するよう各戦略側でも制御する。
   */
  requiresWalletType: boolean;
};

/**
 * 購入タイプ設定マップ
 * キー = purchase_type（DB値）
 *
 * 下流プロジェクトで独自の購入タイプ（例: direct_sale, subscription）を追加する場合は、
 * このマップにエントリを追加したうえで、対応する PurchaseCompletionStrategy を
 * `features/core/purchaseRequest/services/server/completion/` に実装・登録すること。
 */
const purchaseType = {
  wallet_topup: {
    label: "ウォレット加算",
    requiresWalletType: true,
  },
  // 下流での追加例:
  // direct_sale: {
  //   label: "ダイレクト販売",
  //   requiresWalletType: false,
  // },
} satisfies Record<string, PurchaseTypeConfig>;

export type PurchaseRequestConfig = {
  /** 決済設定(プロバイダ・自社振込・デバッグログ・Webhook・支払い方法) */
  payment: {
    /** プロバイダ別設定。ダウンストリームでプロバイダを追加する場合はここに enabled / methodMapping を書く */
    providers: Record<string, ProviderConfig>;
    /** inhouse プロバイダ（自社銀行振込）の設定。振込先口座は自社振込を使う事業者が必ず書き換える */
    bankTransfer: BankTransferConfig;
    /** true にすると決済プロバイダーの Webhook ペイロードやリクエストボディを全体出力する(PII を含むため本番は false) */
    debugLog: boolean;
    /** Webhook設定 */
    webhook: {
      /** 署名検証に使用するヘッダー名のマッピング(null = 署名検証をスキップ) */
      signatureHeaders: Record<string, string | null>;
    };
    /** 支払い方法の定義(UIで使用。表示順 = 配列順。配列の上書きは丸ごと置き換え) */
    paymentMethods: PaymentMethodConfig[];
  };
  /**
   * プロバイダ設定の sessionExpiryMinutes 未指定時のデフォルト（分）。
   * 既存挙動（initiatePurchase の固定値 30 分）と一致させている。
   */
  providerDefaultSessionExpiryMinutes: number;
  /** 購入タイプ設定マップ(キー = purchase_type、DB の値) */
  type: { [K in keyof typeof purchaseType]: PurchaseTypeConfig };
};

const defaults: PurchaseRequestConfig = {
  payment: {
    /**
     * プロバイダ別設定
     * ダウンストリームでプロバイダを追加する場合はここに enabled / methodMapping を定義する。
     */
    providers: {
      dummy: {
        enabled: true,
      },
      fincode: {
        enabled: true,
        methodMapping: {
          credit_card: "Card",
          convenience_store: "Konbini",
          paypay: "Paypay",
          bank_transfer: "Virtualaccount",
        },
      },
      square: {
        enabled: true,
        methodMapping: {
          credit_card: "card",
        },
      },
      stripe: {
        enabled: true,
        methodMapping: {
          credit_card: "card",
        },
      },
      /**
       * 自社受付の銀行振込プロバイダ。
       * 外部決済プロバイダを介さず、ユーザーが指定の口座に振り込み、
       * 振込完了をユーザー自身が画面から申告するフロー。
       * sessionExpiryMinutes を 7 日に設定（営業日跨ぎの振込に対応）。
       */
      inhouse: {
        enabled: true,
        sessionExpiryMinutes: 60 * 24 * 7,
      },
      /**
       * Paidy（あと払い）。
       * client_sdk 起動方式（paidy.js）でモーダル決済を起動するため、
       * createSession は外部 URL ではなく LaunchInstruction を返す。
       * 単一メソッド ("paidy") のみ担当するため methodMapping は不要。
       */
      paidy: {
        enabled: true,
      },
      /**
       * PayPal（直接連携）。
       * client_sdk 起動方式（PayPal JS SDK ボタン）。createSession で Orders v2 の Order を
       * サーバー作成し order_id を返す。単一メソッド ("paypal") のみ担当するため methodMapping は不要。
       */
      paypal: {
        enabled: true,
      },
    },

    /**
     * inhouse プロバイダ（自社銀行振込）の設定。
     * 振込先口座は事業者ごとに必ず書き換えること。
     */
    bankTransfer: {
      autoComplete: true,
      aiImageJudgmentEnabled: true,
      aiImageJudgmentStrictMode: true,
      account: {
        bankName: "サンプル銀行",
        branchName: "サンプル支店",
        branchCode: "000",
        accountType: "普通",
        accountNumber: "0000000",
        accountHolder: "サンプル（カ",
      },
    },

    /**
     * デバッグログ
     * true にすると決済プロバイダーの Webhook ペイロードやリクエストボディを
     * 全体出力する。PII（メールアドレス、電話番号等）を含むため、
     * 本番環境では false にすること。
     */
    debugLog: false,

    /**
     * Webhook設定
     */
    webhook: {
      /**
       * 署名検証に使用するヘッダー名のマッピング
       * null の場合は署名検証をスキップ（開発用）
       */
      signatureHeaders: {
        dummy: null,
        fincode: "Fincode-Signature",
        square: "x-square-hmacsha256-signature",
        stripe: "Stripe-Signature",
        // komoju: "X-Komoju-Signature",
        // Paidy は HMAC 等の Webhook 署名検証機構を提供していないため null。
        // 偽 Webhook 対策は verifyWebhook 側で payment_id 経由の GET /payments/{id} 二重確認で行う。
        paidy: null,
        // PayPal は verify-webhook-signature API による署名検証を持つ。
        // verifyWebhookSignature がトランスミッション系ヘッダー + webhook_id + 生ペイロードで検証する。
        paypal: "Paypal-Transmission-Sig",
      },
    },

    /**
     * 支払い方法の定義（UIで使用）
     *
     * - provider: status="available" の場合に担当プロバイダを指定する。
     *   ダウンストリームで切替えたい場合はここを書き換えるだけで配信先プロバイダが変わる。
     * - 同一プロバイダが複数の支払い方法を担当することは可能。
     * - 同一の支払い方法 ID を複数プロバイダで担当することは禁止
     *   （1メソッド = 1プロバイダの原則）。
     */
    // 表示順 = この配列順（getVisiblePaymentMethods が順序を保持）。並べ替えはここで行う。
    paymentMethods: [
      {
        // Paidy 規約上、表記は「あと払い（ペイディ）」+ 指定の説明文に固定すること（変更不可）。
        id: "paidy",
        label: "あと払い（ペイディ）",
        description: "クレジットカード登録不要、お支払いは翌月でOK",
        icon: "paidy",
        status: "available",
        provider: "paidy",
      },
      {
        id: "paypal",
        label: "PayPal",
        description: "PayPal 残高・クレジットカード・銀行口座で支払い",
        icon: "paypal",
        status: "available",
        provider: "paypal",
      },
      /**
       * 自社受付の銀行振込。
       * - 外部決済プロバイダを介さず、画面上に表示する自社の口座へ直接振り込んでもらう。
       * - 振込完了はユーザーが画面から自己申告（POST /api/wallet/purchase/[id]/bank-transfer/confirm）。
       * - fincode 仮想口座とは別メソッドとして並立。
       * - 既定は disabled（オプトイン）。有効化する場合は status を "available" にする。
       *   管理画面の「銀行振込レビュー」メニュー / 画面 / API は、この支払い方法が
       *   選択可能（isPaymentMethodSelectable）なときだけ露出する（featureGate + 管理メニューが連動）。
       */
      { id: "bank_transfer_inhouse", label: "リアルタイム銀行振込", description: "手続き後に即時反映されます", icon: "bank-realtime", status: "disabled", provider: "inhouse" },
      { id: "credit_card", label: "クレジットカード", description: "VISA / Mastercard / JCB / AMEX / Diners", icon: "credit-card", status: "available", provider: "fincode" },
      { id: "convenience_store", label: "コンビニ決済", description: "セブン-イレブン / ファミリーマート / ローソン", icon: "store", status: "available", provider: "fincode" },
      // { id: "bank_transfer", label: "銀行振込（仮想口座）", description: "Fincode の仮想口座で受付", icon: "bank", status: "available", provider: "fincode" },
      { id: "paypay", label: "PayPay", icon: "paypay", status: "coming_soon", provider: "fincode" },
      { id: "amazon_pay", label: "Amazon Pay", icon: "amazon", status: "disabled" },
    ],
  },
  providerDefaultSessionExpiryMinutes: 30,
  type: purchaseType,
};

export const purchaseRequestConfigDef = defineConfig<PurchaseRequestConfig>(defaults, { label: "purchaseRequest" });

/** 上書きのファイルの型(`export default { ... } satisfies PurchaseRequestOverride<Extra>`) */
export type PurchaseRequestOverride<E extends object = Record<never, never>> = OverrideOf<typeof purchaseRequestConfigDef, E>;

/** 合成済みの設定(上流の値 + 上書き、購入タイプは Extra で足した分も入る) */
export const purchaseRequestConfig = purchaseRequestConfigDef.compose<Extra>(override);

/** 決済設定の型 */
export type PaymentConfig = PurchaseRequestConfig["payment"];

/**
 * 購入タイプのキー型(上流 + 上書きの Extra)
 */
export type PurchaseTypeKey = keyof typeof purchaseRequestConfig.type & string;

/**
 * 全購入タイプのキー一覧
 */
export const PURCHASE_TYPE_KEYS = Object.keys(purchaseRequestConfig.type) as [PurchaseTypeKey, ...PurchaseTypeKey[]];

/**
 * 自社振込(bank_transfer_inhouse)が支払い方法として available で、担当プロバイダが enabled か(合成した値から導く。設定 D100)。
 * 門番の規則 bankTransferReview が APP_FEATURES.payment.enabled と合わせて読む(規則は地区の config だけを読むため、関数でなく値で渡す)。
 * 判定は utils/paymentMethods.ts の isPaymentMethodSelectable("bank_transfer_inhouse") から payment.enabled を除いたものと同じ
 */
export const bankTransferInhouseSelectable: boolean = (() => {
  const method = purchaseRequestConfig.payment.paymentMethods.find((m) => m.id === "bank_transfer_inhouse");
  if (!method || method.status !== "available" || !method.provider) return false;
  return Boolean(purchaseRequestConfig.payment.providers[method.provider]?.enabled);
})();
