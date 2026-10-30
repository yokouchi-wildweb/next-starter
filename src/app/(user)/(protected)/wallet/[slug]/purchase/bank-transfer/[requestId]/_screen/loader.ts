// src/app/(user)/(protected)/wallet/[slug]/purchase/bank-transfer/[requestId]/_screen/loader.ts
// /wallet/[slug]/purchase/bank-transfer/[requestId](自社受付の銀行振込の振込案内)の loader。上流所有。
// 下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。規則と差し替え手順: src/lib/screens/README.md §4
//
// useCoinPurchase 経由で /wallet/[slug]/purchase からリダイレクトされてくる。
// ユーザーがブックマークして振込完了後に再訪することも想定している。
//
// 仕様(redirect / notFound 条件):
// - 未知の slug → notFound
// - 未ログイン → /login へ(範囲 (user)/(protected) の createLoader、access authenticated)
// - purchase_request が無い / 他人のもの → notFound(認可と存在を同一視して秘匿)
// - provider / method が自社銀行振込でない(誤遷移) → notFound
// - status === "completed" → 完了画面へ redirect
// - status が processing 以外(pending / expired / failed) → wallet トップへ救済 redirect
// - status === "processing" → 案内に必要なデータを返す

import "server-only";
import { notFound, redirect } from "next/navigation";

import { getBankTransferConfig, type BankTransferConfig } from "@/config/app/payment.config";
import type { ScreenProps } from "@/lib/screens/types";
import {
  INHOUSE_BANK_TRANSFER_METHOD_ID,
  INHOUSE_PROVIDER_NAME,
} from "@/features/core/purchaseRequest/services/server/payment/inhouse";
import { purchaseRequestService } from "@/features/core/purchaseRequest/services/server/purchaseRequestService";
import { getCurrencyConfigBySlug } from "@/features/core/wallet/utils/currency";
import { createLoader } from "@/app/(user)/(protected)/guard";

export type WalletPurchaseBankTransferScreenParams = { slug: string; requestId: string };

/** 振込案内に必要な最小のデータ(= BankTransferInstruction の props) */
export type WalletPurchaseBankTransferScreenData = {
  /** 通貨の表示名(ストリクトモードの注意喚起文言に使用) */
  currencyLabel: string;
  /** purchase_request の ID */
  requestId: string;
  /** 振込金額(円) */
  paymentAmount: number;
  /** 振込先口座情報 */
  account: BankTransferConfig["account"];
  /** 振込人名末尾に付与する識別子(provider_order_id。無ければ空文字) */
  identifier: string;
  /** 振込期限。null なら表示しない */
  expiresAt: Date | null;
  /** AI 画像判定ステップの有効化フラグ */
  aiImageJudgmentEnabled: boolean;
  /** AI 判定のストリクトモードフラグ(説明文の切替用。実際の厳格判定はサーバー側) */
  aiImageJudgmentStrictMode: boolean;
};

export const loadWalletPurchaseBankTransferScreen = createLoader({
  access: "authenticated",
  key: async (props: ScreenProps<WalletPurchaseBankTransferScreenParams>): Promise<[string, string]> => {
    const { slug, requestId } = await props.params;
    return [slug, requestId];
  },
  load: async ({ user }, slug, requestId): Promise<WalletPurchaseBankTransferScreenData> => {
    // slug の妥当性検証を兼ねて通貨設定を取得
    const currency = getCurrencyConfigBySlug(slug);
    if (!currency) {
      notFound();
    }

    if (!user) {
      notFound();
    }

    // 認可と存在を 404 で同一視して秘匿
    const purchaseRequest = await purchaseRequestService.get(requestId);
    if (!purchaseRequest || purchaseRequest.user_id !== user.userId) {
      notFound();
    }

    // provider/method 不整合(誤遷移)も notFound で秘匿
    if (
      purchaseRequest.payment_provider !== INHOUSE_PROVIDER_NAME ||
      purchaseRequest.payment_method !== INHOUSE_BANK_TRANSFER_METHOD_ID
    ) {
      notFound();
    }

    if (purchaseRequest.status === "completed") {
      redirect(`/wallet/${slug}/purchase/complete?request_id=${purchaseRequest.id}`);
    }
    if (purchaseRequest.status !== "processing") {
      // pending / expired / failed → wallet トップへ救済
      redirect(`/wallet/${slug}`);
    }

    const bankTransferConfig = getBankTransferConfig();

    return {
      currencyLabel: currency.label,
      requestId: purchaseRequest.id,
      paymentAmount: purchaseRequest.payment_amount,
      account: bankTransferConfig.account,
      identifier: purchaseRequest.provider_order_id ?? "",
      expiresAt: purchaseRequest.expires_at,
      aiImageJudgmentEnabled: bankTransferConfig.aiImageJudgmentEnabled,
      aiImageJudgmentStrictMode: bankTransferConfig.aiImageJudgmentStrictMode,
    };
  },
});
