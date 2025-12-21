# シーダー (Seeds)

データベースに初期データを投入するためのスクリプト群です。

## コマンド

```bash
# インタラクティブモード（チェックボックスで選択）
npm run db:seed

# 全シードを実行（CI/CD用）
npm run db:seed:all

# DB作成 + 全シード実行
npm run db:setup
```

## ファイル構成

```
scripts/db/seed/
├── run.ts               # メインスクリプト（実行エントリーポイント）
├── README.md            # このファイル
└── data/
    ├── index.ts         # エクスポート集約
    ├── registry.ts      # シード登録と依存解決
    ├── demoUser.ts      # デモユーザー
    ├── sampleTags.ts    # サンプルタグ
    ├── sampleCategories.ts  # サンプルカテゴリ
    └── samples.ts       # サンプル（タグ・カテゴリに依存）
```

## 新しいシーダーの追加方法

### 1. シードファイルを作成

```typescript
// scripts/db/seed/data/newDomain.ts

import { db } from "@/lib/drizzle";
import { NewDomainTable } from "@/features/newDomain/entities/drizzle";

// 依存関係がある場合はオプショナルで受け取る
type SeedNewDomainParams = {
  parentData?: SeedParentData;  // 依存先のデータ型
};

export type SeedNewDomainResult = {
  itemA: typeof NewDomainTable.$inferSelect;
  itemB: typeof NewDomainTable.$inferSelect;
};

export async function seedNewDomain(
  { parentData }: SeedNewDomainParams = {}
): Promise<SeedNewDomainResult> {
  console.log("  → 新ドメインを作成中...");

  const result: Record<string, typeof NewDomainTable.$inferSelect> = {};

  const items = [
    { key: "itemA", name: "アイテムA", parentId: parentData?.parent1?.id ?? null },
    { key: "itemB", name: "アイテムB", parentId: parentData?.parent2?.id ?? null },
  ];

  for (const item of items) {
    const [created] = await db
      .insert(NewDomainTable)
      .values({ name: item.name, parent_id: item.parentId })
      .returning();

    result[item.key] = created;
    console.log(`    ✓ ${item.name}`);
  }

  return result as SeedNewDomainResult;
}
```

### 2. registry.ts に登録

```typescript
// scripts/db/seed/data/registry.ts

// 型マップに追加
export type SeedResultMap = {
  // ... 既存のエントリー
  newDomain: SeedNewDomainResult;
};

// レジストリに追加
export const seedRegistry: SeedConfig[] = [
  // ... 既存のシード
  {
    name: "新ドメイン",
    key: "newDomain",
    deps: ["parentDomain"],  // 依存するシードのキー（なければ空配列）
    fn: async (deps) => {
      const { seedNewDomain } = await import("./newDomain");
      return seedNewDomain({ parentData: deps.parentDomain });
    },
  },
];
```

### 3. index.ts にエクスポート追加

```typescript
// scripts/db/seed/data/index.ts

export { seedNewDomain } from "./newDomain";
export type { SeedNewDomainResult } from "./newDomain";
```

## 依存関係の解決

シードは `deps` で指定した順序で自動的に解決されます。

```
依存関係: samples → sampleTags, sampleCategories

実行順序: sampleTags → sampleCategories → samples
```

依存先が選択されていない場合、`deps.xxx` は `undefined` になります。
シード関数内で適切にハンドリングしてください：

```typescript
// 依存先が選択されていない場合は null を使用
const parentId = deps.parentDomain?.item?.id ?? null;
```

## 設計方針

| 項目 | 方針 |
|------|------|
| 重複チェック | 基本的に行わない（実行ごとにデータが追加される） |
| 1件のみ必要な場合 | `demoUser.ts` のように存在チェックを実装 |
| リレーション | belongsToMany は ServerService 経由で自動同期 |
| 依存データ | オプショナル引数で受け取り、未選択時は null/空配列 |
