// src/features/core/wallet/services/server/wrappers/reasonKey.ts
// 書き込みの区分(reason_category)と付与の種類(reason_key)を決める。全書き込み口(adjust・consume・debit・一括)が使う。
// - reasonKey あり: 登録の category が区分。reasonCategory も渡して食い違う・未登録の key は書き手の誤り → DomainError 500
// - reasonKey なし: 今まで通り reasonCategory ?? 既定(other)。区分が requiresKey なら console.warn(止めない)
// 詳細: src/features/core/walletHistory/README.md「付与の種類(reason key)」

import { DEFAULT_REASON_CATEGORY, walletHistoryConfig, type ReasonCategory, type ReasonCategoryConfig } from "@/features/walletHistory/config";
import { getWalletReasonKey } from "@/features/core/walletHistory/utils/reasonKey";
import type { WalletReasonKeyItem } from "@/features/core/walletHistory/types/reasonKey";
import { DomainError } from "@/lib/errors";

export type ResolvedWalletReason = {
  reasonCategory: ReasonCategory;
  reasonKey: string | null;
};

/** 差し込み口(テスト用): 種類の引き方・区分の設定・警告の出し先 */
export type ResolveWalletReasonDeps = {
  lookup: (key: string) => WalletReasonKeyItem | undefined;
  categories: Readonly<Record<string, ReasonCategoryConfig>>;
  warn: (message: string) => void;
};

const defaultDeps: ResolveWalletReasonDeps = {
  lookup: getWalletReasonKey,
  categories: walletHistoryConfig.reasonCategory,
  warn: (message) => console.warn(message),
};

export function resolveWalletReason(
  params: { reasonCategory?: ReasonCategory | null; reasonKey?: string | null },
  deps: ResolveWalletReasonDeps = defaultDeps,
): ResolvedWalletReason {
  const key = params.reasonKey?.trim() || null;
  if (key) {
    const item = deps.lookup(key);
    if (!item) {
      throw new DomainError(`付与の種類 "${key}" は登録されていません(walletHistory/reasonKeys)。`, {
        status: 500,
        code: "wallet_reason_key_unknown",
      });
    }
    if (params.reasonCategory && params.reasonCategory !== item.category) {
      throw new DomainError(
        `付与の種類 "${key}" の区分は "${item.category}" です("${params.reasonCategory}" を渡しています)。`,
        { status: 500, code: "wallet_reason_key_mismatch" },
      );
    }
    return { reasonCategory: item.category, reasonKey: key };
  }
  const reasonCategory = params.reasonCategory ?? DEFAULT_REASON_CATEGORY;
  if (deps.categories[reasonCategory]?.requiresKey) {
    deps.warn(
      `[wallet] 区分 "${reasonCategory}" の書き込みに付与の種類(reasonKey)がありません。walletHistory/reasonKeys に種類を足して渡してください(書き込みは続行)`,
    );
  }
  return { reasonCategory, reasonKey: null };
}

/** 履歴の行の 2 列にする(insert の values に広げる) */
export function toHistoryReason(reason: ResolvedWalletReason): { reason_category: ReasonCategory; reason_key: string | null } {
  return { reason_category: reason.reasonCategory, reason_key: reason.reasonKey };
}

/** 管理者の調整の固定キー(区分 admin_adjustment の既定の種類。walletHistory/reasonKeys/adminAdjustment.ts) */
export const ADMIN_ADJUSTMENT_REASON_KEY = "admin_adjustment";

/**
 * 管理画面の調整(個別・一括)の区分と種類。
 * - reasonKey あり: 登録済みでなければ 400(入力の誤り)、区分は種類から(reasonCategory は渡さない)
 * - reasonKey なし: 区分 = reasonCategory ?? "admin_adjustment"、区分が admin_adjustment なら固定キー
 */
export function resolveAdminAdjustReason(input: {
  reasonCategory?: ReasonCategory;
  reasonKey?: string | null;
}): { reasonCategory?: ReasonCategory; reasonKey?: string } {
  const key = input.reasonKey?.trim();
  if (key) {
    const item = getWalletReasonKey(key);
    if (!item) {
      throw new DomainError(`付与の種類 "${key}" は登録されていません。`, { status: 400, code: "wallet_reason_key_unknown" });
    }
    if (input.reasonCategory && input.reasonCategory !== item.category) {
      throw new DomainError(`付与の種類 "${key}" の区分は "${item.category}" です。`, {
        status: 400,
        code: "wallet_reason_key_mismatch",
      });
    }
    return { reasonKey: key };
  }
  const reasonCategory = input.reasonCategory ?? "admin_adjustment";
  return reasonCategory === "admin_adjustment"
    ? { reasonKey: ADMIN_ADJUSTMENT_REASON_KEY }
    : { reasonCategory };
}
