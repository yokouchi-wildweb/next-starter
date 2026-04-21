// src/features/core/purchaseRequest/services/server/completion/walletTopupStrategy.ts
// wallet_topup（ウォレット加算型購入）のビルトイン戦略
//
// 旧 completePurchase.ts 内にインライン記述されていたウォレット加算処理を戦略として切り出したもの。
// 挙動は従来と完全に同一。完全互換を優先しており、新しい振る舞いは加えていない。

import { CURRENCY_CONFIG } from "@/config/app/currency.config";
import { DomainError } from "@/lib/errors/domainError";
import { walletService } from "@/features/core/wallet/services/server/walletService";
import type { WalletTypeValue } from "@/features/core/wallet/types/field";
import type { PurchaseCompletionStrategy } from "./types";

export const walletTopupStrategy: PurchaseCompletionStrategy = {
  type: "wallet_topup",

  /**
   * 購入パッケージ照合
   * 旧 initiatePurchase.ts の CURRENCY_CONFIG[walletType] 検証と同等。
   */
  validateInitiation: async ({ params }) => {
    const { walletType, amount, paymentAmount } = params;

    if (!walletType) {
      throw new DomainError(
        "wallet_topup では walletType が必須です。",
        { status: 400 },
      );
    }

    const currencyConfig = CURRENCY_CONFIG[walletType as keyof typeof CURRENCY_CONFIG] as
      | { packages: ReadonlyArray<{ amount: number; price: number }> }
      | undefined;
    if (!currencyConfig?.packages?.length) {
      throw new DomainError("このウォレット種別では購入できません。", { status: 400 });
    }
    const validPackage = currencyConfig.packages.find(
      (pkg) => pkg.amount === amount && pkg.price === paymentAmount,
    );
    if (!validPackage) {
      throw new DomainError("無効な購入パッケージです。", { status: 400 });
    }
  },

  /**
   * ウォレット残高の加算
   * トランザクション内で実行される。戻り値の walletHistory は
   * completePurchase 側で purchase_requests.wallet_history_id に記録される。
   */
  complete: async ({ purchaseRequest, tx }) => {
    // wallet_topup では wallet_type は必須（アサーション）
    if (!purchaseRequest.wallet_type) {
      throw new DomainError(
        "wallet_topup 購入の wallet_type が未設定です（データ不整合）",
        { status: 500 },
      );
    }

    const walletResult = await walletService.adjustBalance(
      {
        userId: purchaseRequest.user_id,
        walletType: purchaseRequest.wallet_type as WalletTypeValue,
        changeMethod: "INCREMENT",
        amount: purchaseRequest.amount,
        sourceType: "user_action",
        requestBatchId: purchaseRequest.id,
        reason: "コイン購入",
        reasonCategory: "purchase",
        meta: {
          purchaseRequestId: purchaseRequest.id,
          paymentMethod: purchaseRequest.payment_method,
          paymentAmount: purchaseRequest.payment_amount,
        },
      },
      tx,
    );

    if (!walletResult.history) {
      throw new DomainError("ウォレット履歴の記録に失敗しました。", { status: 500 });
    }

    return { walletHistory: walletResult.history };
  },
};
