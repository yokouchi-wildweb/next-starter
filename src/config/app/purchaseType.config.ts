// src/config/app/purchaseType.config.ts
// 購入タイプ（履行形態）の設定ファイル
// ※ユーザー編集対象：購入タイプの追加・変更はこのファイルで行う

// [!!]設定の変更後は必ずマイグレーションが必要です

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
export const PURCHASE_TYPE_CONFIG = {
  wallet_topup: {
    label: "ウォレット加算",
    requiresWalletType: true,
  },
  // 下流での追加例:
  // direct_sale: {
  //   label: "ダイレクト販売",
  //   requiresWalletType: false,
  // },
} as const satisfies Record<string, PurchaseTypeConfig>;

/**
 * 購入タイプのキー型（設定から自動推論）
 */
export type PurchaseTypeKey = keyof typeof PURCHASE_TYPE_CONFIG;

/**
 * 全購入タイプのキー一覧
 */
export const PURCHASE_TYPE_KEYS = Object.keys(PURCHASE_TYPE_CONFIG) as [PurchaseTypeKey, ...PurchaseTypeKey[]];
