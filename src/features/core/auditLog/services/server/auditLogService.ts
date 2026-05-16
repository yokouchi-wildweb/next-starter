// src/features/core/auditLog/services/server/auditLogService.ts

import { db } from "@/lib/drizzle";
import {
  computeAuditDiff,
  getAuditContext,
  stripDenylisted,
  truncateLargeValues,
  validateActionName,
  validateTargetId,
  type AuditContext,
  type AuditRecordInput,
} from "@/lib/audit";
import type { DbTransaction } from "@/lib/crud/drizzle";

import { AuditLogTable, AuditLogFailedTable } from "@/features/core/auditLog/entities/drizzle";
import {
  AUDIT_MODE_DISABLED,
  DEFAULT_RETENTION_DAYS,
} from "@/features/core/auditLog/constants";

/**
 * 1 INSERT あたりの最大行数。
 *
 * PostgreSQL の prepared statement バインドパラメータ上限 (65535) に対し、
 * AuditLogTable は約 12 列のため理論上は 5,000 行強まで詰め込めるが、
 * - スキーマ拡張で列が増えた場合の安全余裕
 * - 単一 INSERT の wire payload が肥大化することによる Neon タイムアウト
 * - tx 内で 1 文だけ巨大化させるより細かく分割した方が中断時の特定が容易
 *
 * の 3 点から、保守的に 1000 行ずつへチャンクする。
 * 上限を超える recordMany 呼び出しは内部で複数 INSERT に分割される（同一 tx に乗る）。
 */
const BATCH_INSERT_CHUNK_SIZE = 1000;

/**
 * record() の追加オプション。基本入力は AuditRecordInput を踏襲。
 *
 * - tx: 同一トランザクションに含めたい場合に明示的に渡す
 * - defaultRetentionDays: ドメイン側で別の保持期間をデフォルト化したい場合に上書き
 */
type RecordOptions = AuditRecordInput & {
  tx?: DbTransaction;
  defaultRetentionDays?: number;
};

/**
 * recordDiff() の入力。trackedFields を絞れば差分検出対象を限定できる。
 * skipIfNoChanges 既定 true（変更なし → 記録スキップ）
 */
type RecordDiffOptions = Omit<RecordOptions, "before" | "after"> & {
  before: Record<string, unknown> | null | undefined;
  after: Record<string, unknown> | null | undefined;
  trackedFields?: readonly string[];
  skipIfNoChanges?: boolean;
};

/**
 * 同一リクエスト内で複数の audit が記録される場合に context を 1 度だけ解決する。
 * 明示的な context 上書きを優先し、無ければ ALS から取得する。
 */
function resolveContext(explicit?: AuditContext): AuditContext {
  if (explicit) return explicit;
  const ctx = getAuditContext();
  if (!ctx) {
    throw new Error(
      "[audit] AuditContext is not set. Wrap server-side entry points with runWithAuditContext or pass `context` explicitly.",
    );
  }
  return ctx;
}

/**
 * 記録ペイロードの整形。
 * - validation（action / targetId）
 * - denylist 除外
 * - サイズ過大値の切り詰め
 * - context の jsonb 化
 * - actorOverride を適用
 */
function buildPayload(input: RecordOptions, context: AuditContext) {
  validateActionName(input.action);
  validateTargetId(input.targetId);

  const beforeFiltered = stripDenylisted(input.before ?? null);
  const afterFiltered = stripDenylisted(input.after ?? null);

  // actorOverride を適用（未認証経路で本人操作を記録する場合等）
  const actorId = input.actorOverride?.actorId !== undefined
    ? input.actorOverride.actorId
    : context.actorId;
  const actorType = input.actorOverride?.actorType ?? context.actorType;

  return {
    targetType: input.targetType,
    targetId: input.targetId,
    actorId,
    actorType,
    action: input.action,
    beforeValue: truncateLargeValues(beforeFiltered),
    afterValue: truncateLargeValues(afterFiltered),
    context: {
      ip: context.ip,
      userAgent: context.userAgent,
      sessionId: context.sessionId,
      requestId: context.requestId,
    },
    metadata: input.metadata ?? null,
    reason: input.reason ?? null,
    retentionDays: input.retentionDays ?? input.defaultRetentionDays ?? DEFAULT_RETENTION_DAYS,
    batchId: input.batchId ?? null,
  };
}

/**
 * dead-letter テーブルへ退避する。
 * 親 tx と独立させるため必ず `db` を使う（tx は使わない）。
 * 退避自体に失敗した場合は console に吐き、recursion を避ける。
 */
async function writeDeadLetter(payload: unknown, error: unknown): Promise<void> {
  try {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack ?? null : null;
    await db.insert(AuditLogFailedTable).values({
      payload: payload as never,
      errorMessage,
      errorStack,
    });
  } catch (deadLetterError) {
    console.error("[audit] dead-letter write failed", { deadLetterError, originalError: error });
  }
}

/**
 * 複数 payload を dead-letter テーブルへ一括退避する（バッチ版）。
 *
 * recordMany の INSERT 失敗時に N 回逐次 await すると、依頼の発端となった
 * 「N ラウンドトリップによるタイムアウト」を dead-letter 側で再導入してしまうため、
 * 1 ステートメント INSERT に集約する。
 *
 * 単一 INSERT のパラメータ上限を回避するため、こちら側も `BATCH_INSERT_CHUNK_SIZE`
 * でチャンキングする（dead-letter は 3 列構造なので 21,000 行/chunk まで安全だが、
 * `audit_logs` 側と歩調を合わせる）。
 *
 * 退避自体に失敗した場合は console に吐き、recursion を避ける（writeDeadLetter と同じ方針）。
 */
async function writeDeadLetterMany(
  payloads: readonly unknown[],
  error: unknown,
): Promise<void> {
  if (payloads.length === 0) return;
  try {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack ?? null : null;
    const rows = payloads.map((payload) => ({
      payload: payload as never,
      errorMessage,
      errorStack,
    }));
    for (let i = 0; i < rows.length; i += BATCH_INSERT_CHUNK_SIZE) {
      const chunk = rows.slice(i, i + BATCH_INSERT_CHUNK_SIZE);
      await db.insert(AuditLogFailedTable).values(chunk);
    }
  } catch (deadLetterError) {
    console.error(
      "[audit] dead-letter batch write failed; some payloads may be unrecoverable",
      { deadLetterError, originalError: error, payloadCount: payloads.length },
    );
  }
}

/**
 * recordMany / recordManyDiff の前処理。
 *
 * - tx 一貫性検査: 入力配列内で tx が混在しているとロールバック境界が壊れるため throw
 * - bestEffort 一貫性検査: バッチ全体で同じモードを期待（混在は誤用）
 * - batchId 一貫性検査: 明示的に渡された batchId が複数の異なる値で混在していたら throw。
 *   未指定（undefined/null）の要素には共通 batchId を後段で割り当てる
 * - ALS context 解決: ループ内で複数回 ALS を読まず、必要なら 1 度だけ取得する
 *
 * 解決済み共有 context は呼び出し側で各 input.context のフォールバックとして使う。
 */
function preparseBatch(inputs: RecordOptions[]): {
  sharedTx: DbTransaction | undefined;
  bestEffort: boolean;
  alsContext: AuditContext | null;
  explicitBatchId: string | null;
} {
  const sharedTx = inputs[0].tx;
  for (let i = 1; i < inputs.length; i += 1) {
    if (inputs[i].tx !== sharedTx) {
      throw new Error(
        "[audit] recordMany: inputs[].tx must be identical across the batch (or all undefined). Mixed transactions are not supported because they cannot share a rollback boundary.",
      );
    }
  }

  const bestEffort = inputs[0].bestEffort ?? false;
  for (let i = 1; i < inputs.length; i += 1) {
    if ((inputs[i].bestEffort ?? false) !== bestEffort) {
      throw new Error(
        "[audit] recordMany: inputs[].bestEffort must be consistent across the batch.",
      );
    }
  }

  // 明示的に渡された batchId は全て同一値である必要がある（複数値の混在は誤用）。
  // 未指定の要素には後段で共通 batchId を自動付与するため、ここでは検査しない。
  let explicitBatchId: string | null = null;
  for (const input of inputs) {
    const value = input.batchId;
    if (value === undefined || value === null) continue;
    if (explicitBatchId === null) {
      explicitBatchId = value;
    } else if (explicitBatchId !== value) {
      throw new Error(
        "[audit] recordMany: inputs[].batchId must be identical across the batch when explicitly provided.",
      );
    }
  }

  // 1 件でも context override が無ければ ALS から共有 context を取得する。
  // 全件が個別 context を持つ場合は ALS 取得自体を省略できる（テスト経路など）。
  const needsAlsContext = inputs.some((input) => !input.context);
  const alsContext = needsAlsContext ? resolveContext() : null;

  return { sharedTx, bestEffort, alsContext, explicitBatchId };
}

/**
 * 配列をチャンクに分割する単純ユーティリティ。
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  if (size <= 0) return [array];
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * 監査ログ記録の公開 API。
 *
 * 利用方針:
 * - 通常は manual record（このオブジェクトの record / recordDiff）を呼び出す
 * - 同一トランザクション内で同一 action を多数記録する場合は recordMany / recordManyDiff を使い、
 *   N 回ラウンドトリップ（Neon HTTP では数十〜数百 ms/件）の累積によるタイムアウトを回避する
 * - context は ALS から自動取得されるため、wrapper のシグネチャに actor を伝染させない
 * - default は strict: 失敗時に throw → 呼び出し元の tx ごと rollback
 * - bestEffort: true → 失敗時 dead-letter に退避し、本処理は継続
 *
 * AUDIT_MODE=disabled の場合は全 call が no-op（インシデント対応用の最終手段）。
 */
export const auditLogger = {
  /**
   * 監査ログを 1 件記録する。
   *
   * @param input - 記録対象の情報。before/after は変更フィールドだけに絞ること。
   *   - bestEffort: true で失敗時 dead-letter 退避（既定: false = strict）
   *   - tx: 同一トランザクションで書きたい場合に明示
   */
  async record(input: RecordOptions): Promise<void> {
    if (AUDIT_MODE_DISABLED) return;

    let context: AuditContext;
    try {
      context = resolveContext(input.context);
    } catch (error) {
      // context 解決失敗は基本 throw だが、bestEffort なら dead-letter に流す
      if (input.bestEffort) {
        await writeDeadLetter(input, error);
        return;
      }
      throw error;
    }

    let payload: ReturnType<typeof buildPayload>;
    try {
      payload = buildPayload(input, context);
    } catch (error) {
      if (input.bestEffort) {
        await writeDeadLetter({ ...input, _contextSnapshot: context }, error);
        return;
      }
      throw error;
    }

    try {
      const executor = input.tx ?? db;
      await executor.insert(AuditLogTable).values(payload);
    } catch (error) {
      if (input.bestEffort) {
        await writeDeadLetter(payload, error);
        return;
      }
      throw error;
    }
  },

  /**
   * before / after から差分を自動計算して記録する。
   *
   * - trackedFields を渡せば対象フィールドを限定できる（推奨）
   * - skipIfNoChanges 既定 true: 差分なし → 記録スキップ（無駄な insert を避ける）
   * - before / after からは denylist 対象を自動除外
   */
  async recordDiff(input: RecordDiffOptions): Promise<void> {
    const { before, after, trackedFields, skipIfNoChanges = true, ...rest } = input;
    const diff = computeAuditDiff(before, after, trackedFields);
    if (!diff.hasChanges && skipIfNoChanges) return;
    await this.record({
      ...rest,
      before: diff.before,
      after: diff.after,
    });
  },

  /**
   * 監査ログを N 件まとめて記録する（バッチ INSERT）。
   *
   * 同一トランザクション内で同一 action を多数記録する用途を想定（例: バルク状態遷移）。
   * record() を N 回 await するとラウンドトリップが累積して Neon HTTP では axios タイムアウトに
   * 到達することがあるため、内部で 1 ステートメント INSERT に集約する。
   *
   * ## 制約
   * - 入力配列内で `tx` が混在しているとロールバック境界が壊れるため throw する
   * - 入力配列内で `bestEffort` が混在しているとモード判定が曖昧になるため throw する
   * - 入力配列内で異なる `batchId` が明示混在していたら throw する。
   *   全て未指定なら共通の UUID v4 を自動発番してバッチ全行に割り当てる
   * - context は同一リクエスト内のバッチ処理を想定し、ALS から 1 度だけ解決する。
   *   各 input が `context` を明示している場合のみその値を優先する
   *
   * ## チャンキングと atomic 性
   * - PostgreSQL の prepared statement バインドパラメータ上限 (65535) を回避するため、
   *   `BATCH_INSERT_CHUNK_SIZE` 単位で複数 INSERT に分割する
   * - caller が `tx` を渡している場合: 全 chunk が同一 tx 上で実行され、いずれかが失敗すると
   *   tx は abort 状態になり、後続 chunk は実行されず caller の commit が失敗して全 rollback
   * - caller が `tx` を渡していない場合: chunk が複数になる時のみ recordMany 内部で
   *   `db.transaction()` でラップして atomic 性を担保する。これにより「先頭 chunk は commit
   *   済み、末尾 chunk が失敗」によるスプリット状態を防止する
   *
   * ## トレース性 (`audit_logs.batch_id` 列)
   * バッチ全体に対して共通の UUID v4 を発番し、各行の `batch_id` 列に永続化する。
   * 部分インデックス `audit_logs_batch_id_idx` により以下のクエリが index scan で動作する:
   * ```sql
   * SELECT * FROM audit_logs WHERE batch_id = $1 ORDER BY created_at;
   * ```
   *
   * ## bestEffort = false（strict, 既定）
   * - 1 件でも buildPayload に失敗したら throw（呼び出し元 tx ごと rollback）
   * - INSERT 失敗時も throw（tx 提供時は caller 側で rollback、内部 tx 利用時は全 chunk rollback）
   *
   * ## bestEffort = true
   * - buildPayload 失敗: 該当 input のみ dead-letter に退避し、残りは続行
   * - INSERT 失敗: 構築済み全 payload を **batched INSERT で** dead-letter に退避する
   *   （N 回逐次 await による二次タイムアウトを避ける）。tx 利用時は全 chunk rollback されるため
   *   全件退避が正しく、内部 tx 利用時も同様。caller が tx 無しで巨大バッチを渡した場合のみ
   *   chunk 間 split 状態が理論上起きうるが、内部 tx ラップにより通常は発生しない
   * - context 解決失敗: 入力配列全体を 1 行で dead-letter に退避（context 不在では再投入不能）
   *
   * @param inputs - 記録対象の配列。空配列なら即 return。
   */
  async recordMany(inputs: RecordOptions[]): Promise<void> {
    if (AUDIT_MODE_DISABLED) return;
    if (inputs.length === 0) return;

    // tx / bestEffort / batchId 整合性検査 → throw（プログラマエラー扱い、bestEffort では握り潰さない）
    // ALS context 解決失敗のみ bestEffort で握り潰す（既存 record() と挙動を揃える）
    let prepared: ReturnType<typeof preparseBatch>;
    try {
      prepared = preparseBatch(inputs);
    } catch (error) {
      const isContextError =
        error instanceof Error &&
        error.message.includes("AuditContext is not set");
      const firstBestEffort = inputs[0]?.bestEffort ?? false;
      if (isContextError && firstBestEffort) {
        await writeDeadLetter(inputs, error);
        return;
      }
      throw error;
    }

    const { sharedTx, bestEffort, alsContext, explicitBatchId } = prepared;
    // 明示指定があればそれを採用、無ければ自動発番。バッチ全行で共通の値となる。
    const batchId = explicitBatchId ?? crypto.randomUUID();

    const payloads: ReturnType<typeof buildPayload>[] = [];
    for (const input of inputs) {
      // 個別 context > 共有 ALS context の順で解決
      const context = input.context ?? alsContext;
      if (!context) {
        // preparseBatch のロジック上ここには到達しないが、型ガードのため残す
        const err = new Error("[audit] recordMany: missing AuditContext for batch entry");
        if (bestEffort) {
          await writeDeadLetter(input, err);
          continue;
        }
        throw err;
      }

      try {
        const payload = buildPayload(input, context);
        // 共通 batchId を column に上書き付与（input.batchId は preparseBatch で検証済み）
        payload.batchId = batchId;
        payloads.push(payload);
      } catch (error) {
        if (bestEffort) {
          await writeDeadLetter({ ...input, _contextSnapshot: context }, error);
          continue;
        }
        throw error;
      }
    }

    if (payloads.length === 0) return;

    const chunks = chunkArray(payloads, BATCH_INSERT_CHUNK_SIZE);

    // chunk が 1 つなら従来通り単一 INSERT。複数 chunk で caller の tx が無い場合のみ、
    // atomic 性を確保するため内部で db.transaction() を開始する。
    const needsInternalTx = chunks.length > 1 && !sharedTx;

    const runInserts = async (executor: DbTransaction | typeof db): Promise<void> => {
      for (const chunk of chunks) {
        await executor.insert(AuditLogTable).values(chunk);
      }
    };

    try {
      if (sharedTx) {
        await runInserts(sharedTx);
      } else if (needsInternalTx) {
        await db.transaction(async (tx) => runInserts(tx));
      } else {
        await runInserts(db);
      }
    } catch (error) {
      if (bestEffort) {
        // INSERT 失敗時は全 payload を batched INSERT で退避する。
        // tx 利用時（caller / 内部）は全 chunk が rollback されるため全件退避が正しい。
        // tx 無し単一 chunk のケースでも、失敗 chunk = 全 payload なので等価。
        await writeDeadLetterMany(payloads, error);
        return;
      }
      throw error;
    }
  },

  /**
   * 監査ログを N 件まとめて差分計算しつつ記録する（バッチ INSERT）。
   *
   * recordDiff の N 件版。各 input について before / after から差分を計算し、
   * `skipIfNoChanges`（既定 true）が立っていて差分なしのものは記録対象から除外する。
   * 残った要素を recordMany に委譲して 1 ステートメント INSERT する。
   *
   * 差分計算により全 input が skip された場合は INSERT を発行しない。
   *
   * 制約・トレース性・失敗挙動は recordMany を参照。
   *
   * @param inputs - 記録対象の配列。各要素は recordDiff と同じ構造。
   */
  async recordManyDiff(inputs: RecordDiffOptions[]): Promise<void> {
    if (AUDIT_MODE_DISABLED) return;
    if (inputs.length === 0) return;

    const recordInputs: RecordOptions[] = [];
    for (const input of inputs) {
      const { before, after, trackedFields, skipIfNoChanges = true, ...rest } = input;
      const diff = computeAuditDiff(before, after, trackedFields);
      if (!diff.hasChanges && skipIfNoChanges) continue;
      recordInputs.push({
        ...rest,
        before: diff.before,
        after: diff.after,
      });
    }

    if (recordInputs.length === 0) return;
    await this.recordMany(recordInputs);
  },
};

export type AuditLogger = typeof auditLogger;
