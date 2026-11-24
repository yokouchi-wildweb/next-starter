// src/lib/backends/override.ts
// 口の持ち主の差し替え口の作り手(D20)。storage の setStoragePortOverride / getStoragePort と同じ形を口ごとに作る

export type BackendOverride<A> = {
  /** 今の実装。差し替えていればそれ、無ければ既定(初回の呼び出しで作り、使い回す) */
  get(): A;
  /** テスト用の差し替え(fake など)。null で既定に戻す */
  set(adapter: A | null): void;
};

/**
 * 差し替え口を作る。口の持ち主は `const slot = createBackendOverride(() => 既定)` を持ち、
 * `get<口>()` = slot.get、`set<口>Override(adapter | null)` = slot.set を自分の入口から出す
 */
export function createBackendOverride<A>(createDefault: () => A): BackendOverride<A> {
  let override: A | null = null;
  let fallback: A | null = null;
  return {
    get() {
      if (override !== null) return override;
      fallback ??= createDefault();
      return fallback;
    },
    set(adapter) {
      override = adapter;
    },
  };
}
