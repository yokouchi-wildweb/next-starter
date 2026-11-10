// src/features/core/wallet/services/server/wrappers/purchaseRestriction.ts
// 購入の制限(walletConfig.purchaseRestriction、設定の議会 D109・D111)のサーバーでの強制。
// 財布に入金する購入(purchaseRequest の type 設定 requiresWalletType)の開始・再開で initiatePurchase が呼ぶ。
// "phoneVerified" なら本人の SMS 認証(phoneVerifiedAt)を phoneVerification の requirePhoneVerification で確かめ、未認証は 403。
// SMS 認証の機能 phoneVerification が閉のまま "phoneVerified" の組は門 build の pnpm check proxies が止める(featureRequirements)。
// 実行時に閉なら黙って通さず 403 で断る(緩めない、D107)

import { walletConfig } from "@/features/wallet/config";
import { requirePhoneVerification } from "@/features/core/phoneVerification/utils/phoneVerificationGuard";
import { userService } from "@/features/core/user/services/server/userService";
import { gate } from "@/featureGate";
import { DomainError } from "@/lib/errors";

/** 購入の制限で断るときの文 */
export const PURCHASE_REQUIRES_PHONE_VERIFICATION_MESSAGE = "購入にはSMS認証が必要です";

/**
 * 財布に入金する購入を本人が始めてよいか。購入の制限が "none" なら何もしない。
 * @throws DomainError 403(SMS 認証が要るのに未認証・SMS 認証の機能が閉)・404(利用者がいない)
 */
export async function assertWalletPurchaseAllowed({ userId }: { userId: string }): Promise<void> {
  if (walletConfig.purchaseRestriction !== "phoneVerified") return;
  if (!gate.enabled("phoneVerification")) {
    throw new DomainError(PURCHASE_REQUIRES_PHONE_VERIFICATION_MESSAGE, { status: 403 });
  }
  const user = await userService.get(userId);
  if (!user) throw new DomainError("ユーザーが見つかりません", { status: 404 });
  requirePhoneVerification(user, PURCHASE_REQUIRES_PHONE_VERIFICATION_MESSAGE);
}
