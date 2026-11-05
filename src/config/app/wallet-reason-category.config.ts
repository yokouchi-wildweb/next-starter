// src/config/app/wallet-reason-category.config.ts
// ウォレット履歴のカテゴリ分類設定
// ※ダウンストリームで拡張可能：カテゴリ追加はこのファイルに行を追加するだけ

/**
 * カテゴリ設定の型
 */
export type ReasonCategoryConfig = {
  /** 表示名 */
  label: string;
  /** このカテゴリが使用されるsource_type */
  sourceTypes: readonly ("user_action" | "admin_action" | "system")[];
  /** 集計時のデフォルト表示順（小さいほど先） */
  sortOrder: number;
  /**
   * コイン創出サマリー（管理画面のコイン収支）の発行 wallet_bonus_grant に数えるか（省略 = 数えない）。
   * 数える通貨は src/config/app/coin-issuance.config.ts の COIN_ISSUANCE_WALLET_TYPES
   */
  countsAsIssuance?: boolean;
  /**
   * この区分の書き込みは付与の種類(reasonKey、受け口 walletHistory/reasonKeys)を渡すべきか(省略 = 要らない)。
   * 渡さないと console.warn(書き込みは止めない)。上流のコードは静的な検査(test:wallet-reason-key)で必ず渡す
   */
  requiresKey?: boolean;
};

/**
 * ウォレット履歴カテゴリ設定マップ
 * キー = reason_category（DB値）
 *
 * ダウンストリームでの拡張例:
 *   gacha_play: { label: "ガチャ", sourceTypes: ["user_action"], sortOrder: 20 },
 *   item_conversion: { label: "アイテム交換", sourceTypes: ["user_action"], sortOrder: 25 },
 */
export const REASON_CATEGORY_CONFIG = {
  purchase: {
    label: "購入",
    sourceTypes: ["user_action"],
    sortOrder: 10,
  },
  consumption: {
    label: "消費",
    sourceTypes: ["user_action"],
    sortOrder: 20,
  },
  bonus: {
    label: "ボーナス",
    sourceTypes: ["user_action", "system"],
    sortOrder: 30,
    // 販促・特典の付与（紹介報酬・クーポン帰属報酬・登録ボーナス等）。発行として数える
    countsAsIssuance: true,
    // 施策ごとの内訳を出すため、付与の種類（reasonKey）を渡す
    requiresKey: true,
  },
  refund: {
    label: "返金",
    sourceTypes: ["admin_action", "system"],
    sortOrder: 40,
  },
  admin_adjustment: {
    label: "管理者調整",
    sourceTypes: ["admin_action"],
    sortOrder: 50,
  },
  system: {
    label: "システム",
    sourceTypes: ["system"],
    sortOrder: 60,
  },
  expiration: {
    label: "有効期限切れ",
    sourceTypes: ["system"],
    sortOrder: 65,
  },
  other: {
    label: "その他",
    sourceTypes: ["user_action", "admin_action", "system"],
    sortOrder: 99,
  },
} as const satisfies Record<string, ReasonCategoryConfig>;

/**
 * カテゴリキーの型（キーから自動推論）
 */
export type ReasonCategory = keyof typeof REASON_CATEGORY_CONFIG;

/**
 * 全カテゴリキーの配列（Zodバリデーション用）
 */
export const REASON_CATEGORY_VALUES = Object.keys(REASON_CATEGORY_CONFIG) as [
  ReasonCategory,
  ...ReasonCategory[],
];

/**
 * デフォルトカテゴリ（未指定時のフォールバック）
 */
export const DEFAULT_REASON_CATEGORY: ReasonCategory = "other";
