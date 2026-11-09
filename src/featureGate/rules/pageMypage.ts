// src/featureGate/rules/pageMypage.ts
// upstream の画面のスイッチ: マイページ全体とアカウントの画面(upstream の画面だけを完全一致で。fork が /mypage の下に足したページは止めない)
// アカウントのどの項目(email・password・profile・phone)を変えさせるかは機能でなく user の設定 account.editableItems(設定 D117)。
// 一覧に無い項目の画面は loader がアカウントのトップへ戻す。その他の操作の画面は mypageOther が pageMypage に dependsOn する(住所は子だけが持つ、D25・D34)。
// 紹介・休会・退会の画面は機能がマイページに依存しないので、両方に依存する小さな機能 mypageInvite・mypagePause・mypageWithdraw が持つ(L3.2)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "=/mypage",
    "=/mypage/account",
    "=/mypage/account/email",
    "=/mypage/account/password",
    "=/mypage/account/phone",
    "=/mypage/account/profile",
  ],
  defaultEnabled: true,
};
