// src/features/core/user/utils/accountItems.ts
// マイページのアカウントで項目を変えられるか(設定 userConfig.account.editableItems)。メニュー(AccountDetails)と各画面の loader が使う

import { userConfig, type AccountEditableItem } from "@/features/user/config";

/** 項目が変えられる一覧にあるか。既定は合成済みの設定の一覧(テストは一覧を渡す) */
export function isAccountItemEditable(
  item: AccountEditableItem,
  editableItems: readonly AccountEditableItem[] = userConfig.account.editableItems,
): boolean {
  return editableItems.includes(item);
}
