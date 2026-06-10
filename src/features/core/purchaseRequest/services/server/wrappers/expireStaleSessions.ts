// src/features/core/purchaseRequest/services/server/wrappers/expireStaleSessions.ts
//
// 放置された client_sdk 型 processing リクエストの掃除（orphan cleanup）。
//
// 背景:
// 冪等キーを intent 由来にした結果、ユーザーが支払い方法や金額を切り替えると別の冪等キー＝
// 別 purchase_request が作られ、切り替え前の client_sdk(PayPal/Paidy)の processing リクエストが
// 放置される。これらを expired にして「後から confirm で capture されうる窓」を閉じる。
//
// なぜ status 遷移だけで十分か（外部 void が不要な理由）:
// - PayPal の CAPTURE intent Order は API で void/cancel できない（未 capture なら自動失効する）。
//   かつ capture は我々の confirm 経由でしか起きないため、purchase_request を expired にして
//   confirm を弾けば、それ以上 capture されることはない。
// - Paidy は createSession 時点でサーバー側 payment を作らない（SDK がクライアント側で生成）。
// よって外部 API での void は不要で、purchase_request の status 遷移で安全に閉じられる。
//
// なぜ「他の processing を expire してよい」と言えるか（誤って成功決済を潰さないか）:
// - client_sdk 型は決済成功時に successUrl へ即遷移して画面を離れる。よってユーザーが新しい購入を
//   開始できる時点で、古い client_sdk リクエストは「モーダルを閉じただけの未完了」に限られる。

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import { releaseQuota } from "@/features/core/purchaseQuota/services/server/wrappers/purchaseQuotaHelper";
import { getPaymentProvider, type PaymentProviderName } from "../payment";
import { transitionStatus } from "./transitionStatus";

/**
 * 同一ユーザーの放置された client_sdk processing リクエストを expired にする（best-effort）。
 *
 * initiatePurchase の新規作成（create）経路の直前に呼ぶ。失敗しても新規購入はブロックしない
 * （ログのみ）。expire できた分はクォータ台帳も released に戻す。
 */
export async function expireStaleClientSdkSessions(userId: string): Promise<void> {
  const rows = await db
    .select()
    .from(PurchaseRequestTable)
    .where(
      and(
        eq(PurchaseRequestTable.user_id, userId),
        eq(PurchaseRequestTable.status, "processing"),
      ),
    );

  for (const row of rows) {
    const providerName = row.payment_provider;
    if (!providerName) continue;

    // launchType を見て client_sdk 型のみ対象にする（redirect 型はユーザーが画面外へ
    // 遷移しているため、同一画面での放置という前提が成り立たない）。
    let isClientSdk: boolean;
    try {
      isClientSdk =
        getPaymentProvider(providerName as PaymentProviderName).launchType === "client_sdk";
    } catch {
      // 未知 / 未実装 provider はスキップ
      continue;
    }
    if (!isClientSdk) continue;

    try {
      const moved = await transitionStatus({
        id: row.id,
        to: "expired",
        from: ["processing"],
      });
      if (moved) {
        await releaseQuota(row.id);
      }
    } catch (error) {
      // 1 件の失敗で新規購入を止めないためログのみ
      console.error(`[expireStaleClientSdkSessions] 遷移に失敗: id=${row.id}`, error);
    }
  }
}
