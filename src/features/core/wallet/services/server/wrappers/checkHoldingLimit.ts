// src/features/core/wallet/services/server/wrappers/checkHoldingLimit.ts

import { and, eq } from "drizzle-orm";

import { CURRENCY_CONFIG, type WalletType } from "@/config/app/currency.config";
import { WalletTable } from "@/features/core/wallet/entities/drizzle";
import type { CurrencyConfig } from "@/features/core/wallet/types/currency";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors/domainError";

/**
 * ウォレットの保有残高が `maxHoldingAmount` 以上なら DomainError を投げる。
 *
 * - `CURRENCY_CONFIG[walletType].maxHoldingAmount` が未設定の通貨は no-op
 * - 判定対象は `balance` のみ (locked_balance は含めない)
 * - ウォレット未作成 (残高 0) のユーザーは常に通過
 *
 * 購入開始処理 (initiatePurchase) から呼び出す。
 * トランザクション不要 (単発の SELECT)。
 *
 * @throws DomainError 残高が上限以上の場合 (status 409)
 */
export async function assertHoldingLimit(params: {
  userId: string;
  walletType: WalletType;
}): Promise<void> {
  // CURRENCY_CONFIG は `as const satisfies` で個別リテラル型に narrow されており、
  // 値を設定していない通貨では optional フィールドが見えなくなるため、
  // 仕様上の型 CurrencyConfig 経由で読み出す。
  const config = CURRENCY_CONFIG[params.walletType] as CurrencyConfig;
  const limit = config.maxHoldingAmount;
  if (limit === undefined) return;

  const rows = await db
    .select({ balance: WalletTable.balance })
    .from(WalletTable)
    .where(
      and(
        eq(WalletTable.user_id, params.userId),
        eq(WalletTable.type, params.walletType),
      ),
    )
    .limit(1);

  const balance = rows[0]?.balance ?? 0;
  if (balance >= limit) {
    throw new DomainError(
      `${limit.toLocaleString()}${config.unit}以上を保有しているため追加購入ができません。`,
      { status: 409 },
    );
  }
}
