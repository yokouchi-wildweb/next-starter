// src/lib/cron/runBudgetedBatches.ts
// 時間予算付き・再開可能なバッチランナー
//
// 目的:
// - serverless の maxDuration（Vercel 既定 300s 等）で途中 kill される前に、
//   チャンク境界で「きれいに」抜けるための共通ループ。
// - 進捗の永続化（チェックポイント前進など）は onChunkDone で呼び出し側が行う。
//   これにより、途中で抜けても次回実行が続きから再開できる。
// - DB 非依存の純粋なループ。ページングの中身（SQL・カーソル型）は呼び出し側が決める。
//
// 締切判定は「チャンクの開始前」にのみ行う。処理中のチャンクは必ず完走させる
// （半端な状態で抜けない）ため、1 チャンクの所要時間 + 安全マージンを差し引いた
// 予算を渡すこと（createDeadline 参照）。
//
// 使い方:
// ```ts
// const deadline = createDeadline(250_000); // maxDuration 300s なら 50s 程度の余裕を残す
// const result = await runBudgetedBatches({
//   deadline,
//   fetchNext: async (cursor) => {
//     const rows = await fetchPage(cursor);
//     if (rows.length === 0) return null;
//     return { items: rows, cursor: rows[rows.length - 1].id, done: rows.length < PAGE_SIZE };
//   },
//   processChunk: async (rows) => recompute(rows.map((r) => r.id)),
//   onChunkDone: async ({ cursor }) => advanceCheckpoint("my-task", cursor),
// });
// ```

/** ランナーの停止理由 */
export type BudgetedBatchesStopReason =
  /** fetchNext が null / 空 / done=true を返し、処理対象を使い切った */
  | "exhausted"
  /** 締切到達（チャンク境界で停止。次回実行で続きを処理する） */
  | "deadline"
  /** maxItems 到達 */
  | "maxItems"
  /** maxChunks 到達 */
  | "maxChunks";

/** 1 ページ分の取得結果 */
export type BudgetedBatchPage<TItem, TCursor> = {
  items: TItem[];
  /** このページを処理し終えた後の再開位置（onChunkDone にそのまま渡される） */
  cursor: TCursor;
  /**
   * これが最後のページであることが分かっている場合 true（例: items.length < pageSize）。
   * 指定すると空ページ取得のための余分な 1 往復を省ける。省略時は次の fetchNext が
   * null / 空を返すまで続行する。
   */
  done?: boolean;
};

/** onChunkDone に渡される進捗 */
export type BudgetedBatchProgress<TCursor> = {
  /** 0 始まりのチャンク番号 */
  chunkIndex: number;
  /** このチャンクの件数 */
  chunkSize: number;
  /** ここまでの累計処理件数（このチャンク含む） */
  processed: number;
  /** このチャンク完了後の再開位置 */
  cursor: TCursor;
};

export type RunBudgetedBatchesOptions<TItem, TCursor> = {
  /** この時刻を過ぎたら次のチャンクを開始しない（createDeadline で作る） */
  deadline: Date;
  /**
   * 次のページを取得する。cursor は前ページの cursor（初回は undefined）。
   * 処理対象が無ければ null（または items が空）を返す。
   */
  fetchNext: (cursor: TCursor | undefined) => Promise<BudgetedBatchPage<TItem, TCursor> | null>;
  /** 1 チャンク分の本処理。throw するとランナー全体が throw する（進捗は直前の onChunkDone まで確定済み） */
  processChunk: (items: TItem[], progress: Omit<BudgetedBatchProgress<TCursor>, "processed">) => Promise<void>;
  /**
   * チャンク処理完了ごとに呼ばれる。進捗の永続化（チェックポイント前進等）はここで行う。
   * 途中で kill されても「onChunkDone 済みのチャンクまでは完了」が保証される。
   */
  onChunkDone?: (progress: BudgetedBatchProgress<TCursor>) => Promise<void> | void;
  /** 1 回の実行で処理する件数上限（省略時は無制限。締切と併用可） */
  maxItems?: number;
  /** 1 回の実行で処理するチャンク数上限（省略時は無制限） */
  maxChunks?: number;
};

export type RunBudgetedBatchesResult = {
  /** 処理した件数 */
  processed: number;
  /** 処理したチャンク数 */
  chunks: number;
  /** 処理対象を使い切った（= 次回実行は新しい対象のみ） */
  exhausted: boolean;
  /** 締切で打ち切られた（= 次回実行に持ち越し） */
  budgetExhausted: boolean;
  stopReason: BudgetedBatchesStopReason;
};

/**
 * 「今から budgetMs 後」の締切を作る。
 *
 * serverless の maxDuration をそのまま渡さないこと。締切はチャンク開始前にしか
 * 判定されないため、「maxDuration − 1 チャンクの最大所要時間 − 起動/後片付けの余裕」
 * を渡す（例: maxDuration 300s → 240_000〜250_000）。
 */
export function createDeadline(budgetMs: number, startedAt: Date = new Date()): Date {
  if (!Number.isFinite(budgetMs) || budgetMs <= 0) {
    throw new Error(`budgetMs は正の数で指定してください: ${budgetMs}`);
  }
  return new Date(startedAt.getTime() + budgetMs);
}

/** 締切までの残り時間（ms）。負なら締切超過 */
export function remainingBudgetMs(deadline: Date, now: Date = new Date()): number {
  return deadline.getTime() - now.getTime();
}

/**
 * 締切までチャンク処理を繰り返す。
 *
 * ループ: 締切/上限チェック → fetchNext → processChunk → onChunkDone → 繰り返し。
 * - 締切は各チャンクの開始前に判定（処理中チャンクは完走）
 * - fetchNext が null / 空を返すか page.done=true なら exhausted
 * - processChunk / onChunkDone の例外はそのまま throw（呼び出し側 = cron ルートが 500 にする）
 */
export async function runBudgetedBatches<TItem, TCursor>(
  options: RunBudgetedBatchesOptions<TItem, TCursor>,
): Promise<RunBudgetedBatchesResult> {
  const { deadline, fetchNext, processChunk, onChunkDone, maxItems, maxChunks } = options;
  if (maxItems !== undefined && (!Number.isInteger(maxItems) || maxItems <= 0)) {
    throw new Error(`maxItems は正の整数で指定してください: ${maxItems}`);
  }
  if (maxChunks !== undefined && (!Number.isInteger(maxChunks) || maxChunks <= 0)) {
    throw new Error(`maxChunks は正の整数で指定してください: ${maxChunks}`);
  }

  let cursor: TCursor | undefined;
  let processed = 0;
  let chunks = 0;

  const finish = (stopReason: BudgetedBatchesStopReason): RunBudgetedBatchesResult => ({
    processed,
    chunks,
    exhausted: stopReason === "exhausted",
    budgetExhausted: stopReason === "deadline",
    stopReason,
  });

  while (true) {
    if (Date.now() >= deadline.getTime()) return finish("deadline");
    if (maxChunks !== undefined && chunks >= maxChunks) return finish("maxChunks");
    if (maxItems !== undefined && processed >= maxItems) return finish("maxItems");

    const page = await fetchNext(cursor);
    if (!page || page.items.length === 0) return finish("exhausted");

    const chunkIndex = chunks;
    await processChunk(page.items, { chunkIndex, chunkSize: page.items.length, cursor: page.cursor });

    processed += page.items.length;
    chunks += 1;
    cursor = page.cursor;

    if (onChunkDone) {
      await onChunkDone({ chunkIndex, chunkSize: page.items.length, processed, cursor: page.cursor });
    }

    if (page.done) return finish("exhausted");
  }
}
