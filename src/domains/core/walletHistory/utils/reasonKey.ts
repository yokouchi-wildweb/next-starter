// src/domains/core/walletHistory/utils/reasonKey.ts
// 付与の種類(reason key)の一覧の読み手(項目: 差す側の <ドメイン>/plugs/walletHistoryReasonKeys/<名前>.ts、一覧は生成物)。client / server どちらからも使える
// 保存した履歴の行の鍵の定義なので門番で絞らない(閉じたドメインが書いた行も表示名で読める。設定の欄と同じ、D26)

import { walletHistoryReasonKeys } from "@/domains/core/walletHistory/extensions/walletHistoryReasonKeys";
import type { WalletReasonKeyItem } from "@/domains/core/walletHistory/types/reasonKey";

const reasonKeys: Readonly<Record<string, WalletReasonKeyItem>> = Object.assign(
  Object.create(null),
  Object.fromEntries(walletHistoryReasonKeys.map((entry) => [entry.plug.key, entry.plug])),
);

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
