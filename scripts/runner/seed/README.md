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
scripts/runner/seed/
├── run.ts               # メインスクリプト（実行エントリーポイント）
├── gate.ts              # 閉じた機能の項目を飛ばす・feature の検査（pnpm test:db-seed）
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
// scripts/runner/seed/data/newDomain.ts

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
// scripts/runner/seed/data/registry.ts

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
// scripts/runner/seed/data/index.ts

export { seedNewDomain } from "./newDomain";
export type { SeedNewDomainResult } from "./newDomain";
```

## 閉じた機能と seed

項目に `feature`（規則名 = `FeatureName`、1 つか配列）を書くと、その規則が 1 つでも閉じている間は項目を飛ばす（対話の選択肢にも `--all` にも出さず、`<項目>: 閉じた機能 <規則>` と出す）。判定は `gate.ts`（`@/featureGate/node` の `gate.enabled`）。

```typescript
{
  name: "サンプル",
  key: "samples",
  feature: "sampleDomain",
  deps: ["sampleTags", "sampleCategories"],
  fn: async (deps) => { /* ... */ },
},
```

- 閉じられるフォルダ（規則の `features`）を import する seed のファイルの項目には `feature` が要る。`pnpm test:db-seed` が registry.ts の各項目の `import("./x")` からファイルを引き、その値 import を見て、規則が `feature` に無ければ落とす（fork の項目も同じ registry なので入る）
- 限界: seed のファイルの直接の import だけを見る（別の seed のファイルを経由した到達は見ない）。項目の `fn` は `import("./<file>")` の形で書く
- `feature` の無い項目は今までどおり走る。書き込む表が DB に無い（PostgreSQL 42P01）と、項目名と直し方（閉じた機能の表なら `feature` を付ける）を出して止まる
- 飛ばした項目に頼る項目は、依存先を選ばなかったときと同じく `deps.xxx` が `undefined` で走る

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
