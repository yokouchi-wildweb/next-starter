// src/features/core/messaging/scripts/migrations/lib.legacyCopy.ts
//
// 旧お知らせの写し(copy-legacy-notifications)の流れ。DB の読み書きは置き場(LegacyCopyStore)で受ける
// (本物は lib.legacyCopyStore.ts、テストはメモリの偽物)。列の対応は lib.legacyCopyMap.ts。
//
// 段: テンプレート → お知らせ(回 + お知らせの行)→ 既読 → 全部既読の watermark → 古い送る口の回の新しい列。
// - 各段は runBudgetedBatches で束ごとに写す(締切は 1 つを全段で共有)。締切で止まれば incomplete を返す(ランナーは鍵を取らない)
// - 続きから: 置き場の next は「まだ写していない行」だけを返す(写し先の主キーを NOT EXISTS で見る)。checkpoint の行は持たない
//   (新しい行の id は写し元の id から決まるので、写した行は写し先にあるかどうかで分かる)。1 回の中は keyset(after)で進む
// - 全段を終えたら照合(数の突き合わせ)。食い違いは TaskRerunnableError(failed・鍵を取らない = 直して打ち直せる)

import { createDeadline, runBudgetedBatches } from "@/lib/cron";
import { TaskRerunnableError, taskIncomplete } from "@/lib/task";

import {
  type DispatchFill,
  type DispatchInsert,
  type ItemInsert,
  type LegacyDispatchRow,
  type LegacyNotificationRow,
  type LegacyReadRow,
  type LegacyReadStateRow,
  type LegacyTemplateRow,
  type ReadInsert,
  type ReadStateUpsert,
  type TemplateInsert,
  type TemplateVersionInsert,
  isUuid,
  mapDispatchFill,
  mapNotification,
  mapRead,
  mapReadState,
  mapTemplate,
} from "./lib.legacyCopyMap";

/** 写しの段(この順に回す。テンプレートは回の template_id の FK より先) */
export const LEGACY_COPY_PHASES = ["templates", "notifications", "reads", "readStates", "dispatchFill"] as const;
export type LegacyCopyPhase = (typeof LEGACY_COPY_PHASES)[number];

/** 1 回の実行の既定の時間予算(pnpm task の 1 回。--budget-ms= で変える) */
export const LEGACY_COPY_DEFAULT_BUDGET_MS = 240_000;
/** 1 束の行数 */
export const LEGACY_COPY_CHUNK = 500;

/** 照合の 1 項目(expected = 写し元から見た写すべき数、copied = 写し先にある数) */
export type ReconcileLine = { source: number; expected: number; copied: number; skipped?: number };

export type LegacyCopyCounts = {
  templates: ReconcileLine;
  templateVersions: ReconcileLine;
  dispatches: ReconcileLine;
  /** 共有の行(全員・ロール)+ 個人宛ての今いる宛先。skipped = 消えた利用者・uuid の形でない宛先 */
  items: ReconcileLine;
  /** skipped = 行き先のお知らせの行が無い既読(個人宛ての宛先に入っていない人の既読) */
  reads: ReconcileLine;
  readStates: ReconcileLine;
  /** 古い送る口の回: expected = 埋める行、copied = 埋めた行(残り = expected − copied) */
  dispatchFill: ReconcileLine;
};

/** 写しの DB の読み書き。next は after(前の束の最後の鍵)より後ろで、まだ写していない行を鍵の順に limit まで */
export type LegacyCopyStore = {
  /** 古い表があるか(無ければ何もしない: 写しを済ませて S3 で消した後など) */
  legacyTablesExist(): Promise<boolean>;
  nextTemplates(after: string | null, limit: number): Promise<LegacyTemplateRow[]>;
  writeTemplates(rows: { template: TemplateInsert; version: TemplateVersionInsert }[]): Promise<void>;
  nextNotifications(after: string | null, limit: number): Promise<LegacyNotificationRow[]>;
  /** 今いる利用者の id(小文字) */
  existingUserIds(ids: readonly string[]): Promise<Set<string>>;
  /** 回とお知らせの行を 1 つの取引で(回があればお知らせの行もある = 続きの判定が回だけで済む) */
  writeNotifications(rows: { dispatch: DispatchInsert; items: ItemInsert[] }[]): Promise<void>;
  nextReads(after: { notificationId: string; userId: string } | null, limit: number): Promise<LegacyReadRow[]>;
  existingItemIds(ids: readonly string[]): Promise<Set<string>>;
  writeReads(rows: ReadInsert[]): Promise<void>;
  nextReadStates(after: string | null, limit: number): Promise<LegacyReadStateRow[]>;
  /** 写し先に新しい watermark があれば大きい方を残す */
  writeReadStates(rows: ReadStateUpsert[]): Promise<void>;
  nextDispatchFills(after: string | null, limit: number): Promise<LegacyDispatchRow[]>;
  writeDispatchFills(rows: DispatchFill[]): Promise<void>;
  /** 照合の数(写し元と写し先を数える) */
  counts(): Promise<LegacyCopyCounts>;
};

export type LegacyCopyOptions = {
  dryRun: boolean;
  budgetMs: number;
  chunk?: number;
  now?: () => Date;
};

export type LegacyCopyResult = Record<string, unknown>;

/** 引数: --dry-run(数えるだけ)、--budget-ms=<ms> */
export function parseLegacyCopyArgs(args: readonly string[]): { dryRun: boolean; budgetMs: number } {
  const budgetArg = args.find((arg) => arg.startsWith("--budget-ms="));
  const budgetMs = budgetArg ? Number(budgetArg.slice("--budget-ms=".length)) : LEGACY_COPY_DEFAULT_BUDGET_MS;
  return { dryRun: args.includes("--dry-run"), budgetMs };
}

/** 照合: 項目ごとに expected と copied が等しいか */
export function reconcile(counts: LegacyCopyCounts): { ok: boolean; mismatched: string[] } {
  const mismatched = Object.entries(counts)
    .filter(([, line]) => line.expected !== line.copied)
    .map(([key]) => key);
  return { ok: mismatched.length === 0, mismatched };
}

/** 写しの本体(task の run から呼ぶ)。締切で止まれば taskIncomplete、照合の食い違いは TaskRerunnableError */
export async function runLegacyCopy(store: LegacyCopyStore, options: LegacyCopyOptions): Promise<LegacyCopyResult> {
  const now = options.now ?? (() => new Date());
  const chunk = options.chunk ?? LEGACY_COPY_CHUNK;
  if (!(await store.legacyTablesExist())) return { skipped: "legacy tables not found" };

  if (options.dryRun) {
    const counts = await store.counts();
    return { dryRun: true, counts, reconciliation: reconcile(counts) };
  }

  const deadline = createDeadline(options.budgetMs);
  const copied: Record<LegacyCopyPhase, number> = { templates: 0, notifications: 0, reads: 0, readStates: 0, dispatchFill: 0 };
  const skipped = { recipients: 0, reads: 0 };

  type Phase<TRow, TCursor> = {
    phase: LegacyCopyPhase;
    next: (after: TCursor | null, limit: number) => Promise<TRow[]>;
    cursorOf: (row: TRow) => TCursor;
    write: (rows: TRow[]) => Promise<void>;
  };
  const run = async <TRow, TCursor>(p: Phase<TRow, TCursor>): Promise<boolean> => {
    const result = await runBudgetedBatches<TRow, TCursor>({
      deadline,
      fetchNext: async (after) => {
        const rows = await p.next(after ?? null, chunk);
        if (rows.length === 0) return null;
        return { items: rows, cursor: p.cursorOf(rows[rows.length - 1]!), done: rows.length < chunk };
      },
      processChunk: async (rows) => {
        await p.write(rows);
        copied[p.phase] += rows.length;
      },
    });
    return result.exhausted;
  };

  const phases: (() => Promise<boolean>)[] = [
    () =>
      run<LegacyTemplateRow, string>({
        phase: "templates",
        next: (after, limit) => store.nextTemplates(after, limit),
        cursorOf: (row) => row.id,
        write: (rows) => store.writeTemplates(rows.map((row) => mapTemplate(row, now()))),
      }),
    () =>
      run<LegacyNotificationRow, string>({
        phase: "notifications",
        next: (after, limit) => store.nextNotifications(after, limit),
        cursorOf: (row) => row.id,
        write: async (rows) => {
          const ids = [...new Set(rows.flatMap((row) => (row.targetType === "individual" ? (row.targetUserIds ?? []) : [])))]
            .map((id) => id.toLowerCase())
            .filter(isUuid);
          const users = ids.length > 0 ? await store.existingUserIds(ids) : new Set<string>();
          const mapped = rows.map((row) => mapNotification(row, users, now()));
          skipped.recipients += mapped.reduce((sum, row) => sum + row.skippedRecipients, 0);
          await store.writeNotifications(mapped.map(({ dispatch, items }) => ({ dispatch, items })));
        },
      }),
    () =>
      run<LegacyReadRow, { notificationId: string; userId: string }>({
        phase: "reads",
        next: (after, limit) => store.nextReads(after, limit),
        cursorOf: (row) => ({ notificationId: row.notificationId, userId: row.userId }),
        write: async (rows) => {
          const mapped = rows.map(mapRead);
          const items = await store.existingItemIds([...new Set(mapped.map((row) => row.item_id))]);
          const writable = mapped.filter((row) => items.has(row.item_id));
          skipped.reads += mapped.length - writable.length;
          if (writable.length > 0) await store.writeReads(writable);
        },
      }),
    () =>
      run<LegacyReadStateRow, string>({
        phase: "readStates",
        next: (after, limit) => store.nextReadStates(after, limit),
        cursorOf: (row) => row.userId,
        write: (rows) => store.writeReadStates(rows.map((row) => mapReadState(row, now()))),
      }),
    () =>
      run<LegacyDispatchRow, string>({
        phase: "dispatchFill",
        next: (after, limit) => store.nextDispatchFills(after, limit),
        cursorOf: (row) => row.id,
        write: (rows) => store.writeDispatchFills(rows.map(mapDispatchFill)),
      }),
  ];

  for (const [index, phase] of phases.entries()) {
    if (!(await phase())) {
      return taskIncomplete({ stoppedAt: LEGACY_COPY_PHASES[index], copied, skipped });
    }
  }

  const counts = await store.counts();
  const reconciliation = reconcile(counts);
  const result = { copied, skipped, counts, reconciliation };
  if (!reconciliation.ok) {
    throw new TaskRerunnableError(`照合が合いません: ${reconciliation.mismatched.join(", ")}(もう一度打つと写し漏れを写します)`, result);
  }
  return result;
}
