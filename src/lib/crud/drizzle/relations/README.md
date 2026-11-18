# crud/drizzle/relations

## Overview

- belongsToMany（M2M の自動同期とハイドレーション、本体は `../belongsToMany.ts`）と、withRelations / withCount の展開（このフォルダのハイドレーション）

## API

### BelongsToManyRelationConfig

```typescript
{
  fieldName: "sampleTagIds",          // エンティティ上のフィールド名
  throughTable: SampleToSampleTagTable, // 中間テーブル
  sourceColumn: table.sampleId,       // 中間テーブルの自ドメイン ID カラム
  targetColumn: table.sampleTagId,    // 中間テーブルの相手ドメイン ID カラム
  sourceProperty: "sampleId",         // INSERT 用プロパティ名
  targetProperty: "sampleTagId",      // INSERT 用プロパティ名
}
```

### withRelations の深さ

| 値 | 深さ | 動作 |
|----|------|------|
| `false` / `undefined` | 0 | ID 配列のみ（M2M hydrate は常時実行） |
| `true` / `1` | 1 | FK → オブジェクト、M2M → オブジェクト配列 |
| `2` | 2 | さらにリレーション先のリレーションも展開 |
| `3` 以上 | 3 | 上限 3 に丸める |

### BelongsToRelation（FK 展開）

```typescript
{
  field: "sample_category",           // 展開後のフィールド名
  foreignKey: "sample_category_id",   // FK カラム名
  table: SampleCategoryTable,         // リレーション先テーブル
  targetFields?: ["id", "name"],      // 取得カラム限定（省略時は全カラム）
  nested?: { belongsTo: [...] },      // 2 階層目の設定
}
```

### BelongsToManyObjectRelation（M2M オブジェクト展開）

```typescript
{
  field: "sample_tags",               // 展開後のフィールド名
  targetTable: SampleTagTable,        // リレーション先テーブル
  throughTable: SampleToSampleTagTable,
  sourceColumn: table.sampleId,
  targetColumn: table.sampleTagId,
  targetFields?: ["id", "name"],
  nested?: { belongsTo: [...] },
}
```

### CountableRelation（カウント取得）

```typescript
{
  field: "sample_tags",               // _count のキー名
  throughTable: SampleToSampleTagTable,
  foreignKey: "sampleId",            // 中間テーブルの FK プロパティ名
}
```

結果: `record._count = { sample_tags: 5 }`

## Internals

### belongsToMany の 3 段階のライフサイクル

```
1. Sync（書き込み時）
   create/update → separateBelongsToManyInput → INSERT本体 → syncBelongsToManyRelations

2. Hydrate IDs（読み取り時、常時）
   list/get/search → hydrateBelongsToManyRelations → ID配列をレコードに付与

3. Hydrate Objects（読み取り時、withRelations 有効時）
   → hydrateBelongsToManyObjects → 中間テーブル JOIN でオブジェクト配列を展開
```

### Sync の流れ

1. `separateBelongsToManyInput()` — 入力データからリレーション ID 配列を分離
2. メインレコードを INSERT/UPDATE
3. `syncBelongsToManyRelations()` — 中間テーブルの既存行を DELETE → 新しい行を INSERT
4. `assignLocalRelationValues()` — 戻り値に ID 配列を再付与

### ハイドレーション順序

```
1. hydrateBelongsToManyRelations()     ← ID 配列（常時、belongsToManyRelations 設定時）
2. hydrateBelongsTo()                  ← FK → オブジェクト（depth > 0）
3. hydrateBelongsToManyObjects()       ← M2M → オブジェクト配列（depth > 0）
4. hydrateCount()                      ← _count オブジェクト（withCount: true）
```
