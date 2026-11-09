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

/**
 * SMS 認証なしの電話番号の入力(PATCH /api/me/phone・電話番号の画面の入力)を受け付けるか(L1.39):
 * 一覧に phone があり、かつ SMS 認証の機能 phoneVerification が閉のときだけ。開なら番号は SMS の手順でだけ変える
 */
export function isPhoneNumberInputOpen(
  phoneVerificationOpen: boolean,
  editableItems: readonly AccountEditableItem[] = userConfig.account.editableItems,
): boolean {
  return isAccountItemEditable("phone", editableItems) && !phoneVerificationOpen;
}
