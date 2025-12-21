// scripts/db/seed/data/registry.ts

import type { SeedSampleCategories } from "./sampleCategories";
import type { SeedSampleTags } from "./sampleTags";

/**
 * 各シードが返すデータの型マップ
 * 新しいシードを追加する際はここに型を追加する
 */
export type SeedResultMap = {
  demoUser: void;
  sampleTags: SeedSampleTags;
  sampleCategories: SeedSampleCategories;
  samples: void;
};

export type SeedKey = keyof SeedResultMap;

/**
 * 依存関係から取得できるデータの型
 * 選択されていない場合はundefinedになる
 */
export type SeedDeps = {
  [K in SeedKey]?: SeedResultMap[K];
};

/**
 * シード設定
 */
export type SeedConfig = {
  /** 表示名 */
  name: string;
  /** シードのキー（SeedResultMapのキーと一致） */
  key: SeedKey;
  /** 依存するシードのキー（先に実行される必要がある） */
  deps: SeedKey[];
  /** シード実行関数 */
  fn: (deps: SeedDeps) => Promise<SeedResultMap[SeedConfig["key"]]>;
};

/**
 * シードレジストリ
 * 依存関係の順序を考慮して並べる（依存元が先）
 */
export const seedRegistry: SeedConfig[] = [
  {
    name: "デモユーザー",
    key: "demoUser",
    deps: [],
    fn: async () => {
      const { seedDemoUser } = await import("./demoUser");
      await seedDemoUser();
    },
  },
  {
    name: "サンプルタグ",
    key: "sampleTags",
    deps: [],
    fn: async () => {
      const { seedSampleTags } = await import("./sampleTags");
      return seedSampleTags();
    },
  },
  {
    name: "サンプルカテゴリ",
    key: "sampleCategories",
    deps: [],
    fn: async () => {
      const { seedSampleCategories } = await import("./sampleCategories");
      return seedSampleCategories();
    },
  },
  {
    name: "サンプル",
    key: "samples",
    deps: ["sampleTags", "sampleCategories"],
    fn: async (deps) => {
      const { seedSamples } = await import("./samples");
      return seedSamples({
        tags: deps.sampleTags,
        categories: deps.sampleCategories,
      });
    },
  },
];

/**
 * 依存関係を解決して実行順序を決定
 * トポロジカルソートで依存元が先に来るようにする
 */
export function resolveDependencyOrder(selectedKeys: SeedKey[]): SeedKey[] {
  const selected = new Set(selectedKeys);
  const result: SeedKey[] = [];
  const visited = new Set<SeedKey>();

  function visit(key: SeedKey) {
    if (visited.has(key)) return;
    if (!selected.has(key)) return;

    visited.add(key);

    // レジストリからこのキーの設定を取得
    const config = seedRegistry.find((s) => s.key === key);
    if (!config) return;

    // 依存関係を先に処理（選択されている場合のみ）
    for (const dep of config.deps) {
      if (selected.has(dep)) {
        visit(dep);
      }
    }

    result.push(key);
  }

  // 選択された全てのキーを処理
  for (const key of selectedKeys) {
    visit(key);
  }

  return result;
}
