// src/features/core/purchaseQuota/services/server/wrappers/purchaseQuotaHelper.ts

import { and, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import {
  PURCHASE_QUOTA_LEDGER_RETENTION_DAYS,
  PURCHASE_QUOTA_RULES,
  type QuotaRule,
} from "@/config/app/purchase-quota.config";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { PURCHASE_QUOTA_ACTIVE_STATUSES } from "@/features/core/purchaseQuota/constants";
import { PurchaseQuotaLedgerTable } from "@/features/core/purchaseQuota/entities/drizzle";
import type { PurchaseQuotaLedger } from "@/features/core/purchaseQuota/entities/model";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors/domainError";

// ============================================================================
// 型定義
// ============================================================================

/**
 * db.transaction 内のクライアント型。
 * 既存 wrappers (completePurchase 等) と同一のパターンで取り出す。
 */
type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * tx を必須にしたい関数のための型。
 * 既存トランザクションへの相乗りを強制し、購入処理との atomic 整合を担保する。
 */
type TxExecutor = TransactionClient;

export type ReserveQuotaInput = {
  /** 集計キーとなるユーザー ID */
  userId: string;
  /** 決済方法名 (payment.config.ts の paymentMethod と一致) */
  paymentMethod: string;
  /** 予約金額 (円単位の整数) */
  amount: number;
  /** 紐付け対象 purchase_request の id */
  purchaseRequestId: string;
};

export type QuotaUsage = {
  rule: QuotaRule;
  /** 現在のウィンドウ内累計金額 (released 除外) */
  currentAmount: number;
  /** 残り上限金額 (負にはならない) */
  remaining: number;
  /** ウィンドウ起点となる時刻 (このウィンドウは this 〜 now を集計対象とする) */
  windowStart: Date;
};

/**
 * クォータ超過時に投げられる例外。
 *
 * API レイヤーで normalizeHttpError 経由でクライアントに 429 として伝搬する。
 * label と code を含むメッセージで「どのルールに引っかかったか」を識別できる。
 */
export class PurchaseQuotaExceededError extends DomainError {
  readonly ruleKey: string;
  readonly ruleLabel: string;
  readonly currentAmount: number;
  readonly requestedAmount: number;
  readonly maxAmount: number;

  constructor(params: {
    rule: QuotaRule;
    currentAmount: number;
    requestedAmount: number;
  }) {
    const { rule, currentAmount, requestedAmount } = params;
    super(
      `購入上限を超えました (${rule.label})。しばらく経ってから再度お試しください。`,
      { status: 429 },
    );
    this.name = "PurchaseQuotaExceededError";
    this.ruleKey = rule.key;
    this.ruleLabel = rule.label;
    this.currentAmount = currentAmount;
    this.requestedAmount = requestedAmount;
    this.maxAmount = rule.maxAmount;
  }
}

// ============================================================================
// 内部ユーティリティ
// ============================================================================

/**
 * ルールが対象 paymentMethod に適用されるか判定する。
 * - scope.all は全 paymentMethod を対象に集計
 * - scope.paymentMethod は値一致のみを対象に集計
 */
function ruleAppliesTo(rule: QuotaRule, paymentMethod: string): boolean {
  if (rule.scope.type === "all") return true;
  return rule.scope.value === paymentMethod;
}

/**
 * 指定ルールの現在使用量を集計する。
 * - status が reserved または committed の行を SUM
 * - created_at >= now - windowSeconds のみを対象
 * - excludeLedgerId が指定された場合はその台帳行を除外 (再予約時の自己除外用)
 */
async function sumUsage(
  executor: TxExecutor | typeof db,
  rule: QuotaRule,
  userId: string,
  now: Date,
  excludeLedgerId: string | null,
): Promise<number> {
  const windowStart = new Date(now.getTime() - rule.windowSeconds * 1000);

  const conditions = [
    eq(PurchaseQuotaLedgerTable.user_id, userId),
    inArray(
      PurchaseQuotaLedgerTable.status,
      PURCHASE_QUOTA_ACTIVE_STATUSES as unknown as string[],
    ),
    gte(PurchaseQuotaLedgerTable.created_at, windowStart),
  ];
  if (rule.scope.type === "paymentMethod") {
    conditions.push(
      eq(PurchaseQuotaLedgerTable.payment_method, rule.scope.value),
    );
  }
  if (excludeLedgerId) {
    conditions.push(ne(PurchaseQuotaLedgerTable.id, excludeLedgerId));
  }

  const rows = await executor
    .select({
      total: sql<number>`COALESCE(SUM(${PurchaseQuotaLedgerTable.amount}), 0)::int`,
    })
    .from(PurchaseQuotaLedgerTable)
    .where(and(...conditions));

  return rows[0]?.total ?? 0;
}

/**
 * 既存の reserved/committed 台帳行を purchase_request_id から探す。
 * 冪等性のために released は除外しない (released は再 reserve を許可するため最新の active 行を探す)。
 */
async function findActiveLedger(
  tx: TxExecutor,
  purchaseRequestId: string,
): Promise<PurchaseQuotaLedger | null> {
  const rows = await tx
    .select()
    .from(PurchaseQuotaLedgerTable)
    .where(
      and(
        eq(PurchaseQuotaLedgerTable.purchase_request_id, purchaseRequestId),
        inArray(
          PurchaseQuotaLedgerTable.status,
          PURCHASE_QUOTA_ACTIVE_STATUSES as unknown as string[],
        ),
      ),
    )
    .limit(1);

  return (rows[0] as PurchaseQuotaLedger | undefined) ?? null;
}

/**
 * クォータ超過イベントを監査ログに記録する。
 *
 * - bestEffort: true で AuditContext 未設定時も dead-letter に流して握り潰す
 * - tx を渡さない → 拒否を投げた後の購入 tx ロールバックで監査も巻き戻ることを防ぐ
 *
 * 観測目的: 不正アクセス・出金洗浄の検知に使えるため必ず残す。
 */
async function recordExceededAudit(params: {
  userId: string;
  rule: QuotaRule;
  paymentMethod: string;
  currentAmount: number;
  requestedAmount: number;
  purchaseRequestId: string;
}): Promise<void> {
  try {
    await auditLogger.record({
      targetType: "purchase_quota",
      targetId: params.purchaseRequestId,
      // action 名は ESLint rule (audit/action-naming) で静的検証する必要があるためリテラル指定。
      // 変更時は src/features/core/purchaseQuota/constants/index.ts の
      // PURCHASE_QUOTA_AUDIT_ACTIONS.EXCEEDED と src/features/core/auditLog/presenters.ts の
      // DEFAULT_ACTION_LABELS のキーを必ず同期させること。
      action: "purchase_quota.reservation.exceeded",
      after: {
        userId: params.userId,
        ruleKey: params.rule.key,
        ruleLabel: params.rule.label,
        scope: params.rule.scope,
        windowSeconds: params.rule.windowSeconds,
        maxAmount: params.rule.maxAmount,
        paymentMethod: params.paymentMethod,
        currentAmount: params.currentAmount,
        requestedAmount: params.requestedAmount,
      },
      bestEffort: true,
    });
  } catch (error) {
    // bestEffort: true なので基本ここには来ないが、念のためログだけ残す。
    console.error(
      "[purchaseQuota] 監査ログ記録失敗 (best-effort):",
      error,
    );
  }
}

// ============================================================================
// 公開 API
// ============================================================================

/**
 * クォータをチェックし、台帳に仮押さえ (reserved) 行を作成する。
 *
 * - PURCHASE_QUOTA_RULES が空なら no-op (デフォルト) で完全に既存挙動を維持
 * - 同一ユーザーの同時実行は pg_advisory_xact_lock でシリアライズ
 * - 同一 purchase_request_id への再呼び出し (pending 再利用) は既存行を上書き
 * - いずれかのルールを超過した場合 PurchaseQuotaExceededError を throw
 *   (監査ログには tx 外で記録するため、購入 tx ロールバック後も残る)
 *
 * tx は呼び出し元の購入 tx を必ず渡すこと (購入レコードとの atomic 整合のため)。
 */
export async function reserveQuota(
  input: ReserveQuotaInput,
  tx: TxExecutor,
): Promise<void> {
  if (PURCHASE_QUOTA_RULES.length === 0) return;

  const { userId, paymentMethod, amount, purchaseRequestId } = input;

  if (amount <= 0) return;

  // 同一ユーザー単位でシリアライズ。tx 終了 (commit/rollback) で自動解放。
  // hashtext は PostgreSQL 組込関数、Neon HTTP でもそのまま動く。
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);

  const existing = await findActiveLedger(tx, purchaseRequestId);
  const now = new Date();

  // 各ルールを評価。再予約時 (existing 有) は自己除外して計算する。
  for (const rule of PURCHASE_QUOTA_RULES) {
    if (!ruleAppliesTo(rule, paymentMethod)) continue;

    const currentAmount = await sumUsage(
      tx,
      rule,
      userId,
      now,
      existing?.id ?? null,
    );
    const projected = currentAmount + amount;

    if (projected > rule.maxAmount) {
      // 監査は tx 外で記録 (rollback で消えないように)
      await recordExceededAudit({
        userId,
        rule,
        paymentMethod,
        currentAmount,
        requestedAmount: amount,
        purchaseRequestId,
      });
      throw new PurchaseQuotaExceededError({
        rule,
        currentAmount,
        requestedAmount: amount,
      });
    }
  }

  // 全ルール通過 → 台帳に書き込み (再予約なら上書き、新規なら insert)
  if (existing) {
    await tx
      .update(PurchaseQuotaLedgerTable)
      .set({
        amount,
        payment_method: paymentMethod,
        status: "reserved",
        updated_at: now,
      })
      .where(eq(PurchaseQuotaLedgerTable.id, existing.id));
  } else {
    await tx.insert(PurchaseQuotaLedgerTable).values({
      id: uuidv7(),
      user_id: userId,
      payment_method: paymentMethod,
      amount,
      purchase_request_id: purchaseRequestId,
      status: "reserved",
      created_at: now,
      updated_at: now,
    });
  }
}

/**
 * 仮押さえ (reserved) を確定 (committed) に遷移させる。
 *
 * - 集計上は reserved と committed の両方が含まれるため計算結果は不変
 * - 状態遷移のみ。観測 (現在 reserved/committed) と将来の特殊処理用フックポイント
 * - 該当行が見つからない / 既に released の場合は何もしない (冪等)
 *
 * tx は省略可。省略時は db を直接使用 (購入完了処理外で単独遷移したい場合用)。
 */
export async function commitQuota(
  purchaseRequestId: string,
  tx?: TxExecutor,
): Promise<void> {
  if (PURCHASE_QUOTA_RULES.length === 0) return;

  const executor = tx ?? db;
  await executor
    .update(PurchaseQuotaLedgerTable)
    .set({ status: "committed", updated_at: new Date() })
    .where(
      and(
        eq(
          PurchaseQuotaLedgerTable.purchase_request_id,
          purchaseRequestId,
        ),
        eq(PurchaseQuotaLedgerTable.status, "reserved"),
      ),
    );
}

/**
 * 予約を解放 (released) する。集計対象から外れる。
 *
 * - 失敗・キャンセル・期限切れ時に呼ぶ
 * - 複数 ID をまとめて release 可能 (bulk expire 用)
 * - 既に released な行は何もしない (冪等)
 *
 * tx は省略可。省略時は db を直接使用。
 * 既存購入 tx に乗せたい場合は明示的に tx を渡すこと (整合性のため推奨)。
 */
export async function releaseQuota(
  purchaseRequestId: string | readonly string[],
  tx?: TxExecutor,
): Promise<void> {
  if (PURCHASE_QUOTA_RULES.length === 0) return;

  const ids = Array.isArray(purchaseRequestId)
    ? purchaseRequestId
    : [purchaseRequestId as string];

  if (ids.length === 0) return;

  const executor = tx ?? db;
  await executor
    .update(PurchaseQuotaLedgerTable)
    .set({ status: "released", updated_at: new Date() })
    .where(
      and(
        inArray(PurchaseQuotaLedgerTable.purchase_request_id, ids),
        ne(PurchaseQuotaLedgerTable.status, "released"),
      ),
    );
}

/**
 * 指定ユーザーの現在クォータ使用量を全ルール分まとめて返す。
 *
 * - UI / 管理画面表示用 (state 変更なし)
 * - paymentMethod スコープのルールは全 paymentMethod を横断集計したいケースもあるため、
 *   ここでは現状の全 active 台帳を対象に各ルール定義どおりに集計する
 */
export async function getQuotaUsage(
  userId: string,
): Promise<QuotaUsage[]> {
  if (PURCHASE_QUOTA_RULES.length === 0) return [];

  const now = new Date();
  const results: QuotaUsage[] = [];

  for (const rule of PURCHASE_QUOTA_RULES) {
    const currentAmount = await sumUsage(db, rule, userId, now, null);
    const windowStart = new Date(now.getTime() - rule.windowSeconds * 1000);
    results.push({
      rule,
      currentAmount,
      remaining: Math.max(0, rule.maxAmount - currentAmount),
      windowStart,
    });
  }

  return results;
}

/**
 * 古い台帳行を物理削除する (cron 用)。
 *
 * - retentionDays より古い created_at の行を削除
 * - status は問わない (どの状態でも集計範囲外なら不要)
 * - 監査ログ用途で長期保管したい場合は retentionDays を大きくすること
 */
export async function cleanupOldLedger(
  retentionDays: number = PURCHASE_QUOTA_LEDGER_RETENTION_DAYS,
): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const result = await db
    .delete(PurchaseQuotaLedgerTable)
    .where(lt(PurchaseQuotaLedgerTable.created_at, cutoff));

  return (result as unknown as { rowCount: number }).rowCount ?? 0;
}
