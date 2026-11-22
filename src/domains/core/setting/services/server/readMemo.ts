// src/domains/core/setting/services/server/readMemo.ts
// 設定の DB の読みのメモ(インスタンスのメモリ。期限 = config の readMemoMs、0 = 覚えない)。
// 読んでいる途中の読みも共有する(同時の読みを 1 本にまとめる)。失敗は覚えない(障害を隠さない)。保存したら clear

export type ReadMemo<T> = {
  /** 期限の中なら覚えた値、外なら読み直す */
  get: () => Promise<T>;
  /** 覚えた値を捨てる(保存の後。このインスタンスの分だけ) */
  clear: () => void;
};

export function createReadMemo<T>(load: () => Promise<T>, ttlMs: () => number, now: () => number = Date.now): ReadMemo<T> {
  let entry: { at: number; value: Promise<T> } | null = null;
  return {
    get: () => {
      const ttl = ttlMs();
      if (ttl <= 0) return load();
      if (entry && now() - entry.at < ttl) return entry.value;
      const value = load();
      const current = { at: now(), value };
      entry = current;
      value.catch(() => {
        if (entry === current) entry = null;
      });
      return value;
    },
    clear: () => {
      entry = null;
    },
  };
}
