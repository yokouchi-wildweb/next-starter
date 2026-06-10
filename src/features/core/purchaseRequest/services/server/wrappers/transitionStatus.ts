// src/features/core/purchaseRequest/services/server/wrappers/transitionStatus.ts
//
// purchase_request の status 遷移を一箇所に集約する。
//
// 設計方針（専門家パネルの指摘を反映）:
// - 状態遷移の許可ルールを ALLOWED_TRANSITIONS（単一の真実）として可視化する。
// - status のみを動かす単純遷移（orphan cleanup / expire 等）は transitionStatus を使い、
//   楽観ロック（WHERE status IN (from)）+ 許可表チェックを強制する。
// - completePurchase / failPurchase は status に加えて完了日時・取引ID・戦略実行などの
//   compound な更新を同一 tx で行うため、各自で楽観ロック付き UPDATE を持つ（本ヘルパーは
//   使わない）。ただしそれらの遷移も必ず ALLOWED_TRANSITIONS に従うこと。

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities/model";

type PurchaseStatus = PurchaseRequest["status"];

/**
 * 許可される status 遷移（from → to[]）。状態機械の単一の真実。
 *
 * - pending →  processing（セッション作成成功）/ failed / expired
 * - processing → completed（決済確定）/ failed（決済失敗）/ expired（放置・期限切れ）
 * - failed → completed（Webhook 順序逆転の救済。completePurchase が許可）
 * - completed / expired → 終端（遷移なし）
 */
export const ALLOWED_TRANSITIONS: Record<PurchaseStatus, readonly PurchaseStatus[]> = {
  pending: ["processing", "failed", "expired"],
  processing: ["completed", "failed", "expired"],
  failed: ["completed"],
  completed: [],
  expired: [],
};

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * status のみを楽観ロック付きで遷移させる（単純遷移用）。
 *
 * - from の各状態 → to が ALLOWED_TRANSITIONS に無ければ throw（設定ミスを早期検出）。
 * - `WHERE id AND status IN (from)` で UPDATE し、更新できたか（競合に勝ったか）を返す。
 *   既に他プロセスが遷移済みなら false（呼び出し側は冪等に扱う）。
 *
 * @returns 実際に status を更新できたら true、競合等で更新 0 行なら false
 */
export async function transitionStatus(args: {
  id: string;
  to: PurchaseStatus;
  from: readonly PurchaseStatus[];
  tx?: TransactionClient;
}): Promise<boolean> {
  const { id, to, from, tx } = args;

  for (const f of from) {
    if (!ALLOWED_TRANSITIONS[f].includes(to)) {
      throw new Error(`不正な status 遷移です: ${f} → ${to}`);
    }
  }

  const client = tx ?? db;
  const updated = await client
    .update(PurchaseRequestTable)
    .set({ status: to, updatedAt: new Date() })
    .where(
      and(
        eq(PurchaseRequestTable.id, id),
        inArray(PurchaseRequestTable.status, [...from]),
      ),
    )
    .returning({ id: PurchaseRequestTable.id });

  return updated.length > 0;
}
