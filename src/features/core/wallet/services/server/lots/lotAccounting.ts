// src/features/core/wallet/services/server/lots/lotAccounting.ts
// ロット会計（付与単位の台帳 + FIFO消費）
//
// ウォレット残高を変更する全経路（adjustBalance / debitBalance / consumeReservedBalance /
// clearBalance / bulkAdjustByType / bulkAdjustByUsers）から呼ばれ、
// 「SUM(wallet_lots.remaining) = wallets.balance」の不変条件を維持する。
//
// - 有効/無効の判定は各関数の内部で行う。無効な walletType では完全に no-op（呼び出し側は無条件に呼んでよい）
// - 全関数は呼び出し側が wallets 行ロック（SELECT FOR UPDATE / UPDATE）を取得済みの
//   同一トランザクション内で呼ぶこと。ロット行は wallets 行ロックにより直列化される
// - 消費は expires_at が近い順（FIFO）。window 関数の累積和による set-based SQL で
//   1文実行し、ホットパスでの追加ラウンドトリップを最小化する
// - expirationBasis: "lastActivity" の通貨では、付与・消費のたびに残っている全ロットの
//   expires_at を「現在 + expirationDays」に揃える。付与は新しいロットを作らず残っているロットに
//   足し込むため、残っているロットはウォレットあたり1本以下に保たれる（延長の UPDATE が1行で済む）。
//   "grant" から切り替えた直後は複数本残り得るが、本数は増えず、消費で 0 になったものから減っていく

import { and, sql, gt, inArray, eq } from "drizzle-orm";
import { WalletLotTable } from "@/features/core/wallet/entities/drizzle";
import type { WalletTypeValue } from "@/features/core/wallet/types/field";
import { DomainError } from "@/lib/errors/domainError";
import {
  calcExpiresAt,
  getExpirationBasis,
  getExpirationDays,
  isExpirationEnabled,
} from "@/features/core/wallet/utils/expiration";
import type { TransactionClient } from "@/lib/drizzle/transaction";

/** ロット合計と残高の不整合（初期化漏れ等）を検知した際の共通エラー */
function lotMismatchError(walletIds: string[]): DomainError {
  return new DomainError(
    `ウォレットロットが残高と一致しません。有効期限の初期化（pnpm task wallet-lots-init）が未実行の可能性があります。(walletIds: ${walletIds.join(", ")})`,
    { status: 500 },
  );
}

/**
 * lastActivity の付与: 残っているロットの失効日を揃えて延ばし、うち最新の1本に付与額を足し込む。
 * 残っているロットが無いウォレットにだけ新しいロットを作る。UPDATE と INSERT を1文で行う。
 * 足し込んだロットの granted_amount は付与額の累計になる（付与ごとの額は wallet_histories が持つ）。
 */
async function grantLotsLastActivity(
  trx: TransactionClient,
  params: { walletIds: string[]; amount: number; expiresAt: Date },
): Promise<void> {
  const idList = sql.join(
    params.walletIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  );
  const targetRows = sql.join(
    params.walletIds.map((id) => sql`(${id}::uuid)`),
    sql`, `,
  );
  const expiresAt = sql`${params.expiresAt.toISOString()}::timestamptz`;

  await trx.execute(sql`
    WITH live AS (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY wallet_id ORDER BY created_at DESC, id DESC) AS rn
      FROM ${WalletLotTable}
      WHERE ${WalletLotTable.wallet_id} IN (${idList}) AND ${WalletLotTable.remaining} > 0
    ),
    touched AS (
      UPDATE ${WalletLotTable} AS l
      SET expires_at = ${expiresAt},
          remaining = l.remaining + CASE WHEN live.rn = 1 THEN ${params.amount}::int ELSE 0 END,
          granted_amount = l.granted_amount + CASE WHEN live.rn = 1 THEN ${params.amount}::int ELSE 0 END
      FROM live
      WHERE l.id = live.id
      RETURNING l.wallet_id
    )
    INSERT INTO ${WalletLotTable} (wallet_id, granted_amount, remaining, expires_at)
    SELECT t.wallet_id, ${params.amount}::int, ${params.amount}::int, ${expiresAt}
    FROM (VALUES ${targetRows}) AS t(wallet_id)
    WHERE NOT EXISTS (SELECT 1 FROM touched WHERE touched.wallet_id = t.wallet_id)
  `);
}

/**
 * lastActivity の消費後: 残っている全ロットの失効日を「現在 + expirationDays」に揃える。
 * "grant" の通貨では no-op。
 */
async function extendLotsOnActivity(
  trx: TransactionClient,
  params: { walletIds: string[]; walletType: WalletTypeValue },
): Promise<void> {
  const days = getExpirationDays(params.walletType);
  if (days === null || getExpirationBasis(params.walletType) !== "lastActivity") return;

  await trx
    .update(WalletLotTable)
    .set({ expires_at: calcExpiresAt(new Date(), days) })
    .where(and(inArray(WalletLotTable.wallet_id, params.walletIds), gt(WalletLotTable.remaining, 0)));
}

/**
 * 付与: 新しいロットを1本作成する（expires_at = 付与時刻 + expirationDays）。
 * lastActivity の通貨では残っているロットに足し込み、全額の失効日を延ばす。
 * 無効な walletType では no-op。
 */
export async function grantLot(
  trx: TransactionClient,
  params: { walletId: string; walletType: WalletTypeValue; amount: number; grantedAt?: Date },
): Promise<void> {
  const days = getExpirationDays(params.walletType);
  if (days === null || params.amount <= 0) return;

  const grantedAt = params.grantedAt ?? new Date();
  if (getExpirationBasis(params.walletType) === "lastActivity") {
    await grantLotsLastActivity(trx, {
      walletIds: [params.walletId],
      amount: params.amount,
      expiresAt: calcExpiresAt(grantedAt, days),
    });
    return;
  }

  await trx.insert(WalletLotTable).values({
    wallet_id: params.walletId,
    granted_amount: params.amount,
    remaining: params.amount,
    expires_at: calcExpiresAt(grantedAt, days),
  });
}

/**
 * 付与（バルク）: 複数ウォレットに同額のロットを一括作成する。
 */
export async function grantLotsBulk(
  trx: TransactionClient,
  params: { walletIds: string[]; walletType: WalletTypeValue; amount: number; grantedAt?: Date },
): Promise<void> {
  const days = getExpirationDays(params.walletType);
  if (days === null || params.amount <= 0 || params.walletIds.length === 0) return;

  const expiresAt = calcExpiresAt(params.grantedAt ?? new Date(), days);
  if (getExpirationBasis(params.walletType) === "lastActivity") {
    await grantLotsLastActivity(trx, { walletIds: params.walletIds, amount: params.amount, expiresAt });
    return;
  }

  await trx.insert(WalletLotTable).values(
    params.walletIds.map((walletId) => ({
      wallet_id: walletId,
      granted_amount: params.amount,
      remaining: params.amount,
      expires_at: expiresAt,
    })),
  );
}

/**
 * 消費: 失効日が近いロットから順（FIFO）に remaining を減算する。
 *
 * window 関数の累積和で対象ロットを特定し、UPDATE 1文で消費する。
 * ロット合計が不足している場合（初期化漏れ・不整合）は throw して呼び出し元 tx ごと rollback。
 * 無効な walletType では no-op。
 */
export async function consumeLotsFifo(
  trx: TransactionClient,
  params: { walletId: string; walletType: WalletTypeValue; amount: number },
): Promise<void> {
  if (!isExpirationEnabled(params.walletType) || params.amount <= 0) return;

  const rows = (await trx.execute(sql`
    WITH ordered AS (
      SELECT id, remaining,
             SUM(remaining) OVER (ORDER BY expires_at ASC, created_at ASC, id ASC) AS cum
      FROM ${WalletLotTable}
      WHERE ${WalletLotTable.wallet_id} = ${params.walletId} AND ${WalletLotTable.remaining} > 0
    )
    UPDATE ${WalletLotTable} AS l
    SET remaining = CASE WHEN o.cum <= ${params.amount} THEN 0 ELSE (o.cum - ${params.amount})::int END
    FROM ordered AS o
    WHERE l.id = o.id AND (o.cum - o.remaining) < ${params.amount}
    RETURNING (o.remaining - l.remaining) AS consumed
  `)) as Array<{ consumed: number | string }>;

  const consumed = rows.reduce((total, row) => total + Number(row.consumed), 0);
  if (consumed !== params.amount) {
    throw lotMismatchError([params.walletId]);
  }

  await extendLotsOnActivity(trx, { walletIds: [params.walletId], walletType: params.walletType });
}

/**
 * 消費（バルク）: 複数ウォレットからそれぞれ同額を FIFO 消費する。
 * PARTITION BY wallet_id の累積和で全ウォレット分を UPDATE 1文で処理する。
 * 1件でもロット不足のウォレットがあれば throw して tx ごと rollback。
 */
export async function consumeLotsFifoBulk(
  trx: TransactionClient,
  params: { walletIds: string[]; walletType: WalletTypeValue; amount: number },
): Promise<void> {
  if (!isExpirationEnabled(params.walletType) || params.amount <= 0 || params.walletIds.length === 0) {
    return;
  }

  const idList = sql.join(
    params.walletIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  );

  const rows = (await trx.execute(sql`
    WITH ordered AS (
      SELECT id, wallet_id, remaining,
             SUM(remaining) OVER (
               PARTITION BY wallet_id
               ORDER BY expires_at ASC, created_at ASC, id ASC
             ) AS cum
      FROM ${WalletLotTable}
      WHERE ${WalletLotTable.wallet_id} IN (${idList}) AND ${WalletLotTable.remaining} > 0
    )
    UPDATE ${WalletLotTable} AS l
    SET remaining = CASE WHEN o.cum <= ${params.amount} THEN 0 ELSE (o.cum - ${params.amount})::int END
    FROM ordered AS o
    WHERE l.id = o.id AND (o.cum - o.remaining) < ${params.amount}
    RETURNING l.wallet_id AS wallet_id, (o.remaining - l.remaining) AS consumed
  `)) as Array<{ wallet_id: string; consumed: number | string }>;

  const consumedByWallet = new Map<string, number>();
  for (const row of rows) {
    consumedByWallet.set(row.wallet_id, (consumedByWallet.get(row.wallet_id) ?? 0) + Number(row.consumed));
  }

  const mismatched = params.walletIds.filter(
    (walletId) => (consumedByWallet.get(walletId) ?? 0) !== params.amount,
  );
  if (mismatched.length > 0) {
    throw lotMismatchError(mismatched);
  }

  await extendLotsOnActivity(trx, { walletIds: params.walletIds, walletType: params.walletType });
}

/**
 * 再ベースライン（SET用）: 既存ロットを全破棄し、新残高を「現在取得扱い」の1本に置き直す。
 * SET は取得時期の情報を破壊する操作のため、決定的にこの解釈で統一する。
 * lastActivity の通貨でも「SET 時刻 + expirationDays」の1本になるので、そのまま正しい。
 * 無効な walletType では no-op。
 */
export async function rebaselineLots(
  trx: TransactionClient,
  params: { walletId: string; walletType: WalletTypeValue; newBalance: number; grantedAt?: Date },
): Promise<void> {
  const days = getExpirationDays(params.walletType);
  if (days === null) return;

  await trx.delete(WalletLotTable).where(eq(WalletLotTable.wallet_id, params.walletId));

  if (params.newBalance > 0) {
    const grantedAt = params.grantedAt ?? new Date();
    await trx.insert(WalletLotTable).values({
      wallet_id: params.walletId,
      granted_amount: params.newBalance,
      remaining: params.newBalance,
      expires_at: calcExpiresAt(grantedAt, days),
    });
  }
}

/**
 * 再ベースライン（バルク）: 複数ウォレットのロットを全破棄し、同一の新残高で置き直す。
 */
export async function rebaselineLotsBulk(
  trx: TransactionClient,
  params: { walletIds: string[]; walletType: WalletTypeValue; newBalance: number; grantedAt?: Date },
): Promise<void> {
  const days = getExpirationDays(params.walletType);
  if (days === null || params.walletIds.length === 0) return;

  await trx.delete(WalletLotTable).where(inArray(WalletLotTable.wallet_id, params.walletIds));

  if (params.newBalance > 0) {
    const expiresAt = calcExpiresAt(params.grantedAt ?? new Date(), days);
    await trx.insert(WalletLotTable).values(
      params.walletIds.map((walletId) => ({
        wallet_id: walletId,
        granted_amount: params.newBalance,
        remaining: params.newBalance,
        expires_at: expiresAt,
      })),
    );
  }
}

/**
 * ロット全削除: 残高クリア（0化）に対応する。
 * 無効な walletType にはそもそも行が存在しないため、config 判定なしで安全に呼べる。
 */
export async function clearLots(trx: TransactionClient, walletIds: string[]): Promise<void> {
  if (walletIds.length === 0) return;
  await trx.delete(WalletLotTable).where(inArray(WalletLotTable.wallet_id, walletIds));
}
