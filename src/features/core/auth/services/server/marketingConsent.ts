// src/features/core/auth/services/server/marketingConsent.ts
//
// 会員登録の宣伝の同意(D88・D71)。本登録の処理(registration.ts)が有効化の前に、仮登録の利用者の id で呼ぶ。
// - false(同意しない)→ 宣伝の種別まるごとの停止の行(kind marketing、'*' '*')を source signup で書く(fork が後から足す宣伝の種類にも効く)
// - true(同意する)→ 同じ登録の前の失敗した試みが残した宣伝の種別まるごとの行を消す(有効化の前の利用者にほかの行は無い。退会の後片付けが消す)
// - 省略 → 何もしない(上流の登録画面に同意のチェックは無い。チェックを足した fork だけが値を送る)
// 書けなければ投げる(有効化の前なので登録はやり直せる。同意しない人に宣伝が届く形を残さない)

import { PREFERENCE_SIGNUP_SOURCE } from "@/features/core/messaging/constants/preferences";

/** 宣伝の同意で止める種別 */
export const MARKETING_CONSENT_KIND = "marketing";

export type MarketingConsentDeps = {
  /** messagingService.setMessagePreference(本物は registration.ts が渡す) */
  setPreference: (userId: string, input: { kind: string; optedOut: boolean }, options: { source: string }) => Promise<unknown>;
};

export async function recordSignupMarketingConsent(
  userId: string,
  consent: boolean | undefined,
  deps: MarketingConsentDeps,
): Promise<void> {
  if (consent === undefined) return;
  await deps.setPreference(userId, { kind: MARKETING_CONSENT_KIND, optedOut: !consent }, { source: PREFERENCE_SIGNUP_SOURCE });
}
