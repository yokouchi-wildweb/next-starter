// src/features/core/walletHistory/utils/reasonKey.ts
// 付与の種類(reason key)の一覧の読み手(項目: walletHistory/reasonKeys/<名前>.ts、一覧は生成物)。client / server どちらからも使える

import { reasonKeys } from "@/features/core/walletHistory/extensions/reasonKeys";
import type { WalletReasonKeyItem } from "@/features/core/walletHistory/types/reasonKey";

/** 登録された種類(未登録なら undefined) */
export function getWalletReasonKey(key: string): WalletReasonKeyItem | undefined {
  return reasonKeys[key];
}

/** 全種類(sortOrder → key の順) */
export function listWalletReasonKeys(): WalletReasonKeyItem[] {
  return Object.values(reasonKeys).sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.key.localeCompare(b.key),
  );
}

/** 表示名(未登録なら key そのもの) */
export function getWalletReasonKeyLabel(key: string): string {
  return reasonKeys[key]?.label ?? key;
}
