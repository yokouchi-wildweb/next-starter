// src/features/wallet/services/server/wrappers/utils.ts

import type { Wallet } from "@/features/core/wallet/entities";
import { WalletTable } from "@/features/core/wallet/entities/drizzle";
import type { WalletTypeValue } from "@/features/core/wallet/types/field";
import type { WalletHistoryMeta, WalletHistoryMetaInput } from "@/features/core/walletHistory/types/meta";
import { DomainError } from "@/lib/errors/domainError";
import { isPgUniqueViolation, handleConstraintError } from "@/lib/crud/drizzle/service";
import { db } from "@/lib/drizzle";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function runWithTransaction<T>(
  tx: TransactionClient | undefined,
  handler: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  if (tx) {
    return handler(tx);
  }
  return db.transaction(async (innerTx) => handler(innerTx));
}

export async function getOrCreateWallet(
  tx: TransactionClient,
  userId: string,
  walletType: WalletTypeValue,
  options?: { lock?: boolean },
): Promise<Wallet> {
  const selectWallet = async () => {
    const query = tx
      .select()
      .from(WalletTable)
      .where(and(eq(WalletTable.user_id, userId), eq(WalletTable.type, walletType)))
      .limit(1);
    const rows = options?.lock ? await query.for("update") : await query;
    return rows[0] as Wallet | undefined;
  };

  const existing = await selectWallet();
  if (existing) return existing;

  try {
    const inserted = await tx
      .insert(WalletTable)
      .values({
        user_id: userId,
        type: walletType,
      })
      .returning();
    const created = inserted[0] as Wallet | undefined;
    if (!created) {
      throw new DomainError("ウォレットの初期化に失敗しました。", { status: 500 });
    }
    return created;
  } catch (error) {
    // レースコンディション: 他のリクエストが先に作成した場合
    if (isPgUniqueViolation(error)) {
      const retried = await selectWallet();
      if (retried) return retried;
    }
    // その他の制約エラーはDomainErrorに変換
    throw handleConstraintError(error);
  }
}

export async function getWallet(
  tx: TransactionClient,
  userId: string,
  walletType: WalletTypeValue,
  options?: { lock?: boolean; createIfNotExists?: boolean },
): Promise<Wallet | null> {
  const shouldCreate = options?.createIfNotExists ?? true;

  if (shouldCreate) {
    return getOrCreateWallet(tx, userId, walletType, { lock: options?.lock });
  }

  const query = tx
    .select()
    .from(WalletTable)
    .where(and(eq(WalletTable.user_id, userId), eq(WalletTable.type, walletType)))
    .limit(1);
  const rows = options?.lock ? await query.for("update") : await query;
  return (rows[0] as Wallet | undefined) ?? null;
}

export function normalizeAmount(value: number, options: { allowZero?: boolean } = {}): number {
  const normalized = Number.isFinite(value) ? Math.trunc(value) : NaN;
  if (Number.isNaN(normalized) || normalized < 0 || (!options.allowZero && normalized === 0)) {
    throw new DomainError("正の整数で金額を指定してください。", { status: 400 });
  }
  return normalized;
}

export function ensureSufficientAvailable(wallet: Wallet, amount: number) {
  const available = wallet.balance - wallet.locked_balance;
  if (available < amount) {
    throw new DomainError("利用可能な残高が不足しています。", { status: 409 });
  }
}

export function ensureLockedAmount(wallet: Wallet, amount: number) {
  if (wallet.locked_balance < amount) {
    throw new DomainError("ロック済み残高が不足しています。", { status: 409 });
  }
}

export function ensureNotBelowLockedBalance(wallet: Wallet, nextBalance: number) {
  if (nextBalance < wallet.locked_balance) {
    throw new DomainError("ロック済み残高を下回るような変更はできません。", { status: 409 });
  }
  if (nextBalance < 0) {
    throw new DomainError("残高がマイナスになるような変更はできません。", { status: 409 });
  }
}

export function sanitizeMeta(meta?: WalletHistoryMetaInput): WalletHistoryMeta | null {
  if (!meta) return null;
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined) continue;
    normalized[key] = value;
  }
  return Object.keys(normalized).length ? (normalized as WalletHistoryMeta) : null;
}

export function resolveRequestBatchId(requestBatchId?: string | null): string {
  if (requestBatchId && requestBatchId.trim().length > 0) {
    return requestBatchId;
  }
  return randomUUID();
}
