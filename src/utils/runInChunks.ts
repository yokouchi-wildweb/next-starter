// src/utils/runInChunks.ts
// 長い並びを決まった大きさの束に分け、束ごとに順に(並列にせず)処理する純粋な道具。1 束でも失敗したらそこで止め、
// 済んだ束の結果と何束目まで済んだかを ChunkRunError に持たせて投げる(済んだ束は戻さない。呼び手が結果を見て打ち直す)。
// 例: 1 回の上限のある管理の一括 API を、上限を超える選択に対して呼ぶ hook(useBulkGrantWallet・useBulkChangeUserStatus)

/** 途中の束で止まった時の失敗。message は元の失敗の message に済んだ束の数を足した物 */
export class ChunkRunError<R> extends Error {
  /** 済んだ束の数(= results の長さ) */
  readonly doneChunks: number;
  /** 束の総数 */
  readonly totalChunks: number;
  /** 済んだ束の結果(束の順) */
  readonly results: R[];

  constructor(cause: unknown, doneChunks: number, totalChunks: number, results: R[]) {
    const base = cause instanceof Error ? cause.message : String(cause);
    super(`${base}(${totalChunks} 束のうち ${doneChunks} 束まで済み)`, { cause });
    this.name = "ChunkRunError";
    this.doneChunks = doneChunks;
    this.totalChunks = totalChunks;
    this.results = results;
  }
}

/** items を size 個ずつの束にする(最後の束は短い。空なら束 0) */
export function chunksOf<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size <= 0) throw new RangeError(`束の大きさは正の整数です: ${size}`);
  const chunks: T[][] = [];
  for (let at = 0; at < items.length; at += size) chunks.push(items.slice(at, at + size));
  return chunks;
}

/** 束ごとに run を順に呼び、結果を束の順に返す。1 束でも投げれば ChunkRunError(1 束だけの時も同じ) */
export async function runInChunks<T, R>(
  items: readonly T[],
  size: number,
  run: (chunk: T[], index: number) => Promise<R>,
): Promise<R[]> {
  const chunks = chunksOf(items, size);
  const results: R[] = [];
  for (const [index, chunk] of chunks.entries()) {
    try {
      results.push(await run(chunk, index));
    } catch (error) {
      throw new ChunkRunError(error, results.length, chunks.length, results);
    }
  }
  return results;
}
