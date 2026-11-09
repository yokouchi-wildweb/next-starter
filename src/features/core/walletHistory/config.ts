// src/features/core/walletHistory/config.ts
// ウォレット履歴の区分の設定(既定 + 上書き、設定の議会 D11・D19・D74・D95)。上書きは src/config/features/walletHistory.config.ts(このファイルだけが読む)。
// 置き方: src/config/README.md。合成: @/lib/defineConfig。呼び手は walletHistoryConfig.reasonCategory を読む
// 区分を足す fork は上書きで `export type Extra = { reasonCategory: { <区分>: ReasonCategoryConfig } }` を宣言して値を書く(ReasonCategory に入る)
// 発行(コイン創出)に数える区分は分析の判断なので analytics の設定(issuanceReasonCategories)が持つ(D74)

import override, { type Extra } from "@/config/features/walletHistory.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

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
   * この区分の書き込みは付与の種類(reasonKey、受け口 walletHistory/reasonKeys)を渡すべきか(省略 = 要らない)。
   * 渡さないと console.warn(書き込みは止めない)。上流のコードは静的な検査(pnpm test src/features/core/wallet/services/server/wrappers/reasonKey.test.ts)で必ず渡す
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
const reasonCategory = {
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
    // 販促・特典の付与（紹介報酬・クーポン帰属報酬・登録ボーナス等）。発行に数えるかは analytics の issuanceReasonCategories
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
} satisfies Record<string, ReasonCategoryConfig>;

/** 上流の既定の形(区分の値は ReasonCategoryConfig に広げる) */
export type WalletHistoryConfig = {
  /** ウォレット履歴カテゴリ設定マップ(キー = reason_category、DB の値) */
  reasonCategory: { [K in keyof typeof reasonCategory]: ReasonCategoryConfig };
};

export const walletHistoryConfigDef = defineConfig<WalletHistoryConfig>({ reasonCategory }, { label: "walletHistory" });

/** 上書きのファイルの型(`export default { ... } satisfies WalletHistoryOverride<Extra>`) */
export type WalletHistoryOverride<E extends object = Record<never, never>> = OverrideOf<typeof walletHistoryConfigDef, E>;

/** 合成済みの設定(上流の区分 + 上書きで足した区分) */
export const walletHistoryConfig = walletHistoryConfigDef.compose<Extra>(override);

/**
 * カテゴリキーの型(上流 + 上書きの Extra)
 */
export type ReasonCategory = keyof typeof walletHistoryConfig.reasonCategory & string;

/**
 * 全カテゴリキーの配列（Zodバリデーション用）
 */
export const REASON_CATEGORY_VALUES = Object.keys(walletHistoryConfig.reasonCategory) as [
  ReasonCategory,
  ...ReasonCategory[],
];

/**
 * デフォルトカテゴリ（未指定時のフォールバック）
 */
export const DEFAULT_REASON_CATEGORY: ReasonCategory = "other";
