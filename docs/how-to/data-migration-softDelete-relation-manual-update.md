# softDelete リレーション展開漏れ：手動更新ガイド

`dc:generate` が使えないプロジェクト（ドメイン数が多い・独自拡張多数）向けの、softDelete 関連バグ修正の手動適用手順。

## このガイドが対象とするバグ

ベーステンプレートで以下 2 件のバグが修正されました（コミット `e29163b1`）。ジェネレータと共通ライブラリの修正は upstream マージで取り込めますが、**生成済みファイル（`model.ts` / `drizzleBase.ts`）は再生成が必要**で、手動修正が必要なケースのためのガイドです。

### バグ① — `model.ts` に `deletedAt` が出力されない

`useSoftDelete: true` のドメインでも、`entities/model.ts` に `deletedAt: Date | null;` が無い。`schema.ts`/`drizzle.ts` には存在するため型不整合が発生する。

### バグ② — リレーション展開で削除済みレコードが混入

`drizzleBase.ts` の relation 設定（`belongsToRelations` / `belongsToManyObjectRelations` / `hasManyRelations` / `countableRelations`）に softDelete メタが付与されないため、`withRelations: true` / `withCount: true` 時に削除済みレコードが返ってくる・カウントされる。

## 前提条件

- ベーステンプレートのコミット `e29163b1` 以降を取り込み済み（`src/lib/crud/types.ts`、`src/lib/crud/drizzle/relations/*` が更新されていること）
- 1 つ以上のドメインで `useSoftDelete: true` が設定されている

## 手順 1: 影響を受けるドメインを特定する

### 1-A. softDelete を使用しているドメインを抽出

```bash
grep -l '"useSoftDelete": true' src/features/**/domain.json
```

ここで列挙されたドメインが「**バグ①の対象**（model.ts 修正対象）」であり、同時に「**他ドメインから参照された場合にバグ②を引き起こす側**」です。

### 1-B. softDelete 対象を参照しているドメインを抽出

`1-A` で得た各ドメイン名を `domain` フィールドで参照している全ドメインの `domain.json` を grep します。

```bash
# 例: sample が softDelete 対象のとき
grep -l '"domain": "sample"' src/features/**/domain.json
```

ここで列挙されたドメインの `services/server/drizzleBase.ts` が「**バグ②の対象**」です。さらに `domain.json` 内の relation エントリの `relationType` を見て、修正種別（belongsTo / belongsToMany / hasMany）を確認します。

> **Tip**: countableRelations は `belongsToMany` のリレーションごとに生成されているので、belongsToMany を持つ親ドメインの drizzleBase.ts を見ます。

## 手順 2: バグ① — model.ts に `deletedAt` を追加

対象: `1-A` で得た各ドメインの `src/features/{domain}/entities/model.ts`

`updatedAt` の直下に 1 行追加します。

```diff
 export type {Domain} = {
   id: string;
   // ... 各フィールド
   createdAt: Date | null;
   updatedAt: Date | null;
+  deletedAt: Date | null;
 };
```

## 手順 3: バグ② — drizzleBase.ts のリレーションメタを追加

対象: `1-B` で得た各ドメインの `src/features/{domain}/services/server/drizzleBase.ts`

各リレーション種別ごとに、**参照先テーブルが softDelete 対象の場合のみ** 2 行（または 4 行）を追加します。

参照先テーブルが softDelete 対象でない場合は何もしないでください。

### 3-A. `belongsToRelations`

```diff
 belongsToRelations: [
   {
     field: "sample_category",
     foreignKey: "sample_category_id",
     table: SampleCategoryTable,
+    useSoftDelete: true,
+    deletedAtColumn: SampleCategoryTable.deletedAt,
   }
 ],
```

### 3-B. `belongsToManyObjectRelations`

```diff
 belongsToManyObjectRelations: [
   {
     field: "sample_tags",
     targetTable: SampleTagTable,
     throughTable: SampleToSampleTagTable,
     sourceColumn: SampleToSampleTagTable.sampleId,
     targetColumn: SampleToSampleTagTable.sampleTagId,
+    useSoftDelete: true,
+    deletedAtColumn: SampleTagTable.deletedAt,
   }
 ],
```

### 3-C. `hasManyRelations`

```diff
 hasManyRelations: [
   {
     field: "samples",
     table: SampleTable,
     foreignKey: "sample_category_id",
+    useSoftDelete: true,
+    deletedAtColumn: SampleTable.deletedAt,
   }
 ],
```

### 3-D. `countableRelations`（追加でインポートも必要）

countableRelations は元々中間テーブルしか参照していないため、softDelete 対応のために **target テーブル参照を追加** します。`targetTable` のインポートが新たに必要になる場合があります。

```diff
+import { SampleTagTable } from "@/features/sampleTag/entities/drizzle";
 // ...
 countableRelations: [
   {
     field: "sample_tags",
     throughTable: SampleToSampleTagTable,
     foreignKey: "sampleId",
+    targetTable: SampleTagTable,
+    targetColumn: SampleToSampleTagTable.sampleTagId,
+    useSoftDelete: true,
+    deletedAtColumn: SampleTagTable.deletedAt,
   }
 ],
```

> **注意**: `targetColumn` は中間テーブル側の target 列です（例: `SampleToSampleTagTable.sampleTagId`）。`targetTable.id` ではないので注意。

### 3-E. nested の中身も忘れずに

`belongsToRelations` / `belongsToManyObjectRelations` / `hasManyRelations` の各エントリに `nested: { belongsTo: [...], belongsToMany: [...] }` がある場合、その中の各エントリも同じルールで修正します（参照先が softDelete 対象なら 2 行追加）。

```diff
 hasManyRelations: [
   {
     field: "samples",
     table: SampleTable,
     foreignKey: "sample_category_id",
     useSoftDelete: true,
     deletedAtColumn: SampleTable.deletedAt,
     nested: {
       belongsToMany: [
         {
           field: "sample_tags",
           targetTable: SampleTagTable,
           throughTable: SampleToSampleTagTable,
           sourceColumn: SampleToSampleTagTable.sampleId,
           targetColumn: SampleToSampleTagTable.sampleTagId,
+          useSoftDelete: true,
+          deletedAtColumn: SampleTagTable.deletedAt,
         }
       ],
     },
   }
 ],
```

## 動作確認

### 型チェック

```bash
pnpm typecheck
```

`model.ts` 修正で型が一致することと、`drizzleBase.ts` のメタが新型 (`useSoftDelete?: boolean` / `deletedAtColumn?: any`) と整合することを確認します。

### 実データでの確認

softDelete 対象ドメインのレコードを 1 件論理削除した状態で:

1. **withRelations**: そのレコードを belongsTo/belongsToMany/hasMany で参照している親ドメインに対して `useSearch{Parent}({ withRelations: true })` 等を呼び、削除済みレコードが含まれないことを確認
2. **withCount**: `useSearch{Parent}({ withCount: true })` で `_count` が削除済みを除いた数になっていることを確認
3. **トップレベル**: 念のため `useSearch{TargetDomain}()` 単体でも削除済みが除外されていることを確認（こちらは元々 OK のはずだが回帰チェック）

## よくある落とし穴

- **修正対象ドメインの取りこぼし**: 「自ドメインが softDelete を使っていない」場合でも、参照先が softDelete を使っていれば drizzleBase.ts の修正が必要。手順 1-B での grep を必ず実施する。
- **nested の中の二重ネスト**: 2 階層展開を使っている場合、外側だけでなく `nested` 内のエントリも個別に修正する必要がある。
- **countableRelations のインポート追加忘れ**: target テーブルが他ドメインの場合、`@/features/{otherDomain}/entities/drizzle` からのインポートを追加する必要がある。
- **softDelete 対象でない参照先に誤って追加**: `useSoftDelete: true` を持たないテーブルに `deletedAtColumn` を指定するとランタイムエラー（カラム不在）になる。必ず参照先 `domain.json` の `useSoftDelete` を確認してから追加する。
- **`.deletedAt` プロパティ名**: drizzle テーブル定義で別名を使っている場合は実際のカラム参照名に合わせる（例: `Table.deletedAt` がデフォルトだが独自命名している場合は要調整）。

## 関連ファイル（参考）

- ジェネレータ実装: `scripts/domain-config/generator/generate-server-service.mjs`
- ランタイム実装: `src/lib/crud/drizzle/relations/hydrate{BelongsTo,HasMany,BelongsToManyObjects,Count}.ts`
- 型定義: `src/lib/crud/types.ts` の `BelongsToRelation` / `HasManyRelation` / `BelongsToManyObjectRelation` / `CountableRelation`
