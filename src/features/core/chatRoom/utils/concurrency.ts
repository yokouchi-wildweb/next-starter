// src/features/chatRoom/utils/concurrency.ts
//
// 同時実行数を制限しながら非同期タスクを並行処理するユーティリティ。
// 外部ライブラリ不要の軽量実装。

/**
 * 配列の各要素に対して非同期関数を並行実行する。
 *
 * 同時実行数を `concurrency` で制限し、Firestore 等の
 * レート制限に抵触しないようにする。
 *
 * @param items - 処理対象の配列
 * @param fn - 各要素に対して実行する非同期関数
 * @param concurrency - 同時実行数の上限（デフォルト: 5）
 * @returns 各要素の実行結果（入力と同じ順序）
 */
export async function pMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency = 5,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex++;
      results[currentIndex] = await fn(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return results;
}
