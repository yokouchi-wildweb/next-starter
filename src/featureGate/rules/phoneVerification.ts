// src/featureGate/rules/phoneVerification.ts
// SMS 認証(電話番号の認証、Firebase Phone Auth)。部品・hook・サービスは core/phoneVerification(表なし、認証済みの印は user の列)
// 上流の既定は閉。電話番号の画面(pageMypage の住所、項目は user の account.editableItems)は依存しない(電話番号は認証なしでも登録できる、設定 D122)。
// その画面・マイページの電話番号の行・財布の「SMS 認証が要る」案内は、この機能の入切を自分で確かめる

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  // 番号の確認・OTP の検証の API(domainEntry.ts が無いので汎用 API の住所は導かれない)
  pathPatterns: ["/api/phone-verification"],
  domains: [
    "core/phoneVerification",
  ],
  defaultEnabled: false,
};
