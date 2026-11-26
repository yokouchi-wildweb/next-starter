# crud/collections

## Overview

- 主の登録の 1 行に属する従属の登録の行の集まりを、主のレコード上の「列でない配列」として読み書きする（例: 商品の 1 行に属するギャラリー画像の行）。書き込みは主の保存と同じ TX で従属のサービスを通して差分同期し、読み出しでは並び順の配列を全件載せる。指定しないサービスの挙動は変わらない（Drizzle のみ）。
- 使う時・直す時の決まりは札 .claude/rules/items/lib/crud.md にある

### 呼び名と API 名

| 呼び名 | API |
|--------|-----|
| 主の登録 | `collections` を指定したサービス |
| 従属の登録 | `CrudCollectionConfig.service` が返すサービス（`createCrudService` の戻り値でよい） |
| 集まり（の項目） | `CrudCollectionConfig`（主のレコード上のフィールド名 = `fieldName`） |
| 集まりの値 | `CollectionValue`（`valueColumn` の値。`string \| number`） |
| 差分同期 | `syncCollection` / `createCrudService` の create・update・upsert |
| 先頭 1 件の SQL | `firstInCollection`（列の形）/ `firstInCollectionForAlias`（別名の形） |
| 2 段の複製 | `duplicateWithCollections` / `duplicate` / `duplicateWithIdMap` |
| 旧→新の従属 id の対応表 | `CollectionDuplicateResult.idMaps` |
| ファイルの複製の口 | `service.duplicateStorageValues`（storage オプション付きのサービス） |
| 集まりの項目名の一覧 | `service.collectionFields` |

### 基盤に無いもの

- データ移行の補助・書き込みの経路（既存の行を集まりへ移す等）は持たない。一度きりの移行は DB を直接操作する（同じフォルダの `Usage.md`）
- 論理削除の従属

## Usage

### 宣言

```ts
import { createCrudService } from "@/lib/crud/server";

// 従属: 並びの列を systemColumns に宣言する（並びは systemUpdate で書く）
export const galleryImageService = createCrudService(GalleryImageTable, {
  systemColumns: ["sort_order"],
  storage: storageBindingFor("gallery_image", [{ name: "image", purpose: "gallery_image.image" }]),
});

// 主
export const productService = createCrudService(ProductTable, {
  collections: [
    {
      fieldName: "galleryImages",                 // 主のレコード上の配列（列ではない）
      service: () => import("./galleryImageService").then((m) => m.galleryImageService), // 循環を避けて遅延で渡す
      parentColumn: GalleryImageTable.productId,  // 主への参照列（主の物理削除で cascade する FK）
      valueColumn: GalleryImageTable.image,       // 集まりの値の列（差分はこの値で取る）
      sortColumn: GalleryImageTable.sort_order,   // text（fractional の鍵。既定）か integer（0 始まりの添字）
      maxItems: 10,                               // 省略 = 上限なし。超える配列の保存は 400（切り詰めない）
      minItems: 1,                                // 省略 = 下限なし。下回る保存は 400（下の「最小件数」）
      duplicate: true,                            // 主の複製で従属も写すか（既定 true）
    },
  ],
});
```

- 集まりは 1 行 1 値: 従属の 1 行が集まりの 1 要素で、`valueColumn` の値で見分ける（同じ値の重複は持たない）
- `parentColumn` / `valueColumn` / `sortColumn` は同じ従属の表の列で、互いに別の列。従属の表は `id` 列を持つ
- 論理削除の従属（`deletedAt` 列を持つ表）は扱わない（宣言時に throw）
- 宣言の誤り（列の取り違え・`fieldName` が主の列や belongsToMany の項目と重なる・並びの列が text / integer でない・`maxItems` / `minItems` の値の誤り）はサービス生成時に throw する

### エントリ（従属の行 id 付き）と、集まりの 1 件を FK で参照する

主の get / search と埋め込みが載せるのは値の配列のまま（フォームはこの形で送る）。集まりの 1 件を選んで他の表から参照するときだけ、id 付きのエントリを読む。

| 口 | 形 |
|---|---|
| `collectionEntries({ collection, parentId, parentTable? }, tx?)` | 1 つの主のエントリ `{ id, value, sort }[]` |
| `collectionEntriesForParents({ collection, parentIds, parentTable? }, tx?)` | 複数の主（1 クエリ、IN）。`Map<主の id, エントリ[]>`、従属の無い主は `[]` |
| `resolveCollectionEntryId({ collection, parentId, value }, tx?)` | その主の集まりの値 → 従属の行 id。無い値・他の主の値は `null` |
| `resolveCollectionEntryIds({ collection, parentId, values }, tx?)` | 複数の値（1 クエリ）。`Map<値, 従属の行 id>`（無い値は入らない） |
| 主のサービスの `collectionEntries(fieldName, parentId)` / `collectionEntriesForParents(fieldName, parentIds)` | collections を指定したサービスだけが持つ。主の表で論理削除された主を除く。知らない項目は 404 |
| `GET /api/<domain>/collection-entries?field=<項目名>&parentIds=<id,id>` | client からの読み出し（汎用ルート、主の id 100 件まで）。認可は主の **get** の規則（従属の汎用 API は閉じたまま）。応答 `{ [主の id]: エントリ[] }` |
| `fetchCollectionEntries(domain, field, parentIds)`/ `useCollectionEntries(domain, field, parentId または parentIds)`（どちらも `@/lib/crud`） | client service と SWR のフック。`entriesOf(parentId)` で 1 つの主の並び |

- 並びは読み出しと同じ（並びの列 ASC NULLS LAST → id ASC、text は `COLLATE "C"`）。1 回の呼び出しで 1 クエリ
- 従属が値・並びの列を秘匿列（`defineHiddenColumns`）にしていれば、その値は `null`。ファイルの読み取りの規則（storage）は変わらない
- `parentTable` を渡すと、論理削除された主のエントリを返さない（主の表と結合する。クエリは 1 本のまま）

集まりの 1 件を FK で参照するレシピ（例: 主の画像の中から 1 枚を「上書き画像」として他の表に持つ）:

1. 参照する表に従属の行 id の列を持つ（`<child>_id`、FK、`onDelete: "SET NULL"`）。値（ref）をコピーして持たない（ファイルの 1 行は 1 つの業務行だけを指す）
2. 選ぶ画面は `useCollectionEntries(<主>, <項目名>, <主の id>)` でエントリを出し、選んだエントリの `id` を送る
3. 書き込みで、その id がその主の集まりの要素かを確かめる（他の主の画像を指させない）。値で受けるなら `resolveCollectionEntryId(…, tx)` で id に引き、id で受けるなら `collectionEntries` の id に含まれるかを見る。どちらも呼び出し元の tx の中で使える
4. 表示は従属の行を結合して値を引く（参照する側のサービスの withRelations の belongsTo に従属の表を足す等）。主の集まりから外されると従属の行が消え、FK は NULL になる（既定の表示に戻す）

### 先頭 1 件の SQL

SQL の中で集まりの先頭 1 件（並び順の最初の従属の行）の値を使う。主の行ごとに 1 値のスカラー副問い合わせで、集まりが空なら NULL。select / where / orderBy にそのまま置け、`COALESCE` / `CASE` で包める。

```ts
import { firstInCollection, firstInCollectionForAlias } from "@/lib/crud/server";

// 列の形: 主の id を列（表・alias の列）か SQL で渡す
db.select({ id: ProductTable.id, cover: firstInCollection(galleryCollection, ProductTable.id) }).from(ProductTable);

// 別名の形: 主の表の別名を文字列で渡す（手書きの sql`` / extraWhere / extraOrderBy 用）
sql`select p.id, coalesce(${firstInCollectionForAlias(galleryCollection, "p")}, '') as cover from products p`;
```

- 既定は値の列を返す。`{ select: <従属の列> }` で別の列（例: caption）を返す。別名の形は `{ parentIdColumn }` で主の id 列の名前を変えられる（既定 `"id"`）
- どちらも drizzle の SQL の断片（識別子だけで値の bind は無い）
- lib が作る SQL の断片は列を `"表名"."列名"` で修飾する（drizzle は 1 表の select の項目に置いた SQL の列を表名なしで書くため、副問い合わせの中で主と従属の列が混ざる）

### 生成器からの配線

- 主の登録の entity.json の集まりの項目（`fieldType: "mediaCollection"`、[src/domains/README.md](../../../domains/README.md)「主の集まりの項目（mediaCollection）」）から、`pnpm generate domain` が従属の宣言（`domain.json` と `entities/<従属>/entity.json`、無いときだけ）・主の `services/server/<登録名>Collections.ts`（`collections: CrudCollectionConfig[]`、毎回上書き）・主のスキーマ / モデル / フォームを生成する
  - `fieldName` = 項目名（entity.json に書いたまま）、`service` = 従属の `<child>Service` の遅延 import、`parentColumn` / `valueColumn` / `sortColumn` = 従属の主への参照列 / `file` 列 / `sortOrderField`、`maxItems` = `collection.maxItems`、`minItems` = required なら 1、`duplicate` = `collection.duplicate`
- 生成の `<登録名>Base.ts` は `import { collections } from "./<登録名>Collections"` して `createCrudService` の options に `collections` を渡す
- `<登録名>Base.ts` を手書きする主（`generate: false` のドメイン）は、この 2 行を自分で足す（渡し忘れは `pnpm test scripts/structure/registry/collectionWiring/collectionWiring.test.mjs` が見つける）
- 突き合わせ: `pnpm test scripts/structure/registry/collectionWiring/collectionWiring.test.mjs` が、全登録の entity.json の集まりの項目と、serviceRegistry から読み込んだ主のサービスの `collectionFields` を比べる（渡し忘れ・余分を主と項目で出す。DB 未設定でも走る）
- 生成器を使わないドメインは、手書きのサービスで `createCrudService` に `collections` を渡す（宣言の形は同じ `CrudCollectionConfig`）

### 既存の mediaUploaderMulti 列からの移行

- 手順は同じフォルダの `Usage.md`

## API

### 書き込み

- create / update / upsert の入力の集まりの項目は、parse の前に外して検査する（DB に触れる前に 400）
  - 省略（または undefined）= 維持、`[]` = 全部消す
  - 配列でない・空の要素・重複・`maxItems` 超過・`minItems` 不足は 400。切り詰めない（`maxItems` を超えた既存の行も黙って消さない）
- 同期は主の行を `FOR UPDATE` でロックしてから従属を全件読み直し、値で差分を取る
  - 変わらない値の行は残す（従属の id を保つ）/ 消えた値の行は従属の `hardDelete` / 新しい値は従属の `create`
  - 並びは同期のたびに配列順に振り直す（text = fractional の鍵、integer = 添字）。値の変わった行だけ従属の `systemUpdate` で書く
  - 主の保存が後勝ち: 読んでいない行は消さない。従属の API からの直接の書き込みは、次の主の保存でその配列に揃う
- 戻り値には書いた値の配列を載せる
- `bulkUpsert` / `bulkUpdate` / `bulkUpdateByIds` / `bulkUpdateByQuery` / `replaceByQuery` は、集まりの値（`[]` を含む）が入っていれば DB を変える前に 400。無ければ今のまま
- 呼び出し元が tx を渡さなければ内部で TX を張る。従属の `hardDelete` が外したファイルは、従属の storage binding の動きのまま（外から tx を渡すので掃除 cron が片付ける）
- base を通らない書き込み（手書きのドメイン・fork の独自の保存）は単独関数 `syncCollection({ parentTable, parentId, collection, values }, tx?)` で同じ規則の同期ができる（主の行が無ければ 404）

### 最小件数（minItems）

`minItems`（非負の整数、省略 = 下限なし）を宣言した集まりは、下回る保存を 400（`<fieldName> は <minItems> 件以上必要です`）で断る。

- create: 項目の省略（または undefined）は `[]` とみなして検査する。`minItems` が 1 以上なら DB に触れる前に 400
- update: `[]` / 下限未満の配列は 400（DB に触れる前）。項目の省略は今までどおり触らない（維持）
- upsert: 渡した配列は同じく DB に触れる前に検査する。項目を省くと、新規か更新かは書くまで分からないので、主の書き込みの後に同じ TX で従属の件数を数え、下限未満なら 400 で巻き戻す（新規の行は残らない。下限を満たす既存の行への upsert は通る）
  - 呼び出し元が tx を渡したときは、その TX の中で throw する（巻き戻しは呼び出し元の TX）
- 単独関数 `syncCollection` も渡した値を同じく検査する
- 検査しないもの
  - 複製の内側の主の create（従属は 2 段目で複製元の件数のまま写す。複製元が下回っていても断らない）
  - `bulkUpsert` / `bulkUpdate*` / `replaceByQuery`（集まりの値を受け付けない。`bulkUpsert` / `replaceByQuery` は集まりなしで主の新規行を作れるので、必須の集まりがあるドメインでは使い方に注意）
  - 従属の API からの直接の書き込み・主の削除（従属の件数は lib が見張らない。次の主の保存で検査する）
- 宣言の検査（サービス生成時に throw）: 非負の整数・`maxItems` 以下・1 以上と `duplicate: false` の併用は不可（複製すると必ず下回るため）
- `minItems` を宣言しない（または 0 の）サービスは今のまま（TX もクエリも増えない）

### 読み出し

- 配列を載せる口: `get` / `getWithDeleted` / `list` / `listWithDeleted` / `search` / `searchWithDeleted` / `searchForSorting` と、create / update / upsert の戻り値
  - `restore` / `reorder` / `systemUpdate` / bulk 系の戻り値には載せない（その行を保存しても、省略 = 維持なので失わない）
- `base.query()` も、行の直下に `id`（文字列か数値）がある行にだけ同じ配列を載せる。費用は他の口と同じく集まりごとに呼び出し 1 回で 1 クエリ。`id` の無い行には項目自体を付けない（`[]` にもしない）
  - `id` は主の id として読む。別の表の id を `id` として select すると、誤った主の子が載る → 別の名前で出す
  - 集まりの項目名と同じ出力キーは、`id` のある行では上書きされる
  - `select({ item: table })` のような入れ子の行は直下に `id` が無いので載らない。こうした select や、サービスを通らない生の select には `collectionEntriesForParents` を使う
- 件数で打ち切らない（`DEFAULT_HAS_MANY_LIMIT` や主のページの大きさに依らず全件）。従属が無ければ `[]`
- 並びは 並びの列 ASC NULLS LAST → id ASC。text の並びの列は `COLLATE "C"`（`../drizzle/fractionalSort/README.md` の「並びの鍵の照合順序」）
- 集まりごとに呼び出し 1 回で 1 クエリ（主の id の IN）。呼び出し元の tx の外（`db`）で読む。複製の 1 段目の読み出しも同じ
- TS 側の先頭 1 件は配列の `[0]`
- 他ドメインの withRelations で埋め込まれた主の行（belongsTo / hasMany / belongsToMany、深さ 2 まで）にも、主の読み出しと同じ規則（全件・並び順・従属が無ければ `[]`）で集まりの配列を載せる
  - 埋め込む側のサービスは主のサービスを読まないので、表に集まりを登録して引く: 主の `entities/drizzle.ts` の `defineTableCollections(<Domain>Table, () => import("@/domains/<domain>/services/server/collections").then((m) => m.collections))`（`pnpm generate domain` が出す。遅延 import = drizzle.ts ↔ collections.ts ↔ 従属の表の循環を避ける）。主のサービス（`createCrudService` の `collections`）を作ったときも同じ表に登録する
  - 埋め込んだ行の集まりは、リレーション 1 つ・深さ 1 つごとに、集まり 1 つにつき 1 クエリ（埋め込んだ主の id の IN）。登録の無い表の埋め込みはクエリも動きも変わらない
  - `entities/drizzle.ts` を手書きする主は、この 1 行を自分で足す（`pnpm test scripts/structure/registry/collectionWiring/collectionWiring.test.mjs` が、サービスを読まずに表の登録があるかを確かめる）。無いと、主のサービスを読まない画面の埋め込みで配列が欠ける
  - 埋め込みの配列は全件（先頭だけの省略はしない）なので、埋め込んだ行から作ったフォームを保存しても集まりは減らない
  - 直接の drizzle の select（`db.select()...`）は対象外。先頭 1 件を SQL で使うなら Usage の「先頭 1 件の SQL」
- 一覧の表示: `formatCollectionThumbnails(value)`（`@/lib/crud`。先頭 1 件のサムネイルと、残りがあれば `+N`。解決できない値は数えず、0 件は null）。生成の presenters は主の集まりの項目（`mediaCollection`）にこれを使う。旧来の複数メディア列（mediaUploaderMulti）は `formatMediaThumbnails`（先頭 3 件を重ねて `+N`）のまま

### 複製（2 段）

`duplicate` は集まりの従属ごと 2 段で複製する。

1. TX の外: 複製元の主を読み、主と従属のファイルの列を各サービスの `duplicateStorageValues`（= storage binding の `duplicateValues`）で新しい ref に写す。1 件でも失敗すれば throw し、DB には何も書かない
2. 1 つの TX（呼び出し元の tx があればそれ）: 集まりの項目を外して主を作り（get が載せた配列を主の create に流さない）、従属を複製元の並び順に従属の `create` で作る（id・主への参照・並び・作成/更新日時以外の列と、写したファイルの値）。並びは同期と同じく振り直す

- 切り替えは宣言の `duplicate` だけ（呼び出しごとの切り替えは無い）。`false` の集まりは写さず、複製した主の集まりは空
- `duplicate()` の戻り値は今までどおり新しい主の行（集まりの配列つき）。旧→新の従属 id の対応表は `duplicateWithIdMap(id, options?, tx?)` → `{ record, idMaps: { [fieldName]: Map<旧 id, 新 id> } }`（集まりの無いサービスでは `idMaps` は `{}`）
- 単独関数 `duplicateWithCollections({ service, collections, id, options }, tx?)` は base の duplicate を通らない呼び出し（手書きのドメイン・fork）でも使える。`service` は `get` / `create`（と任意の `duplicateStorageValues`）を持てばよい
- 2 段目が巻き戻ると、1 段目で写したファイルは未紐付けのまま残り、掃除 cron（storage-sweep）が回収する
- ドメインの wrapper で `duplicate` を差し替えるなら、その中で `duplicateWithCollections` を呼ぶ（呼ばなければ集まりは写らない）。`duplicateWithIdMap` はドメインが差し替えた `duplicate` を通らない
- `duplicateStorageValues` は実際にファイルを写す（読み取り専用の宣言ではない）。複製以外の目的で呼ばない
- 従属の create の入力スキーマ（parseCreate）に無い列は写らない
- 仕組み: 集まりのあるサービスだけ、storage binding の外側で `duplicate` / `duplicateWithIdMap` を包む（主のファイルは主の binding で写して紐付き、主の create は storage binding → 集まりの層を通る）。storage だけのサービス・オプションの無いサービスの複製は変わらない

### 主の削除

- 主の論理削除: 従属はそのまま残る（掃除 cron の照合では「行がある」と数える）。restore で戻る
- 主の物理削除: 従属は DB の FK cascade で消える。従属のサービスは呼ばない（従属のファイルの紐付けは掃除 cron の照合が外す）

### CSV / ZIP（dataMigration）

- 集まりの項目は CSV / ZIP のデータ移行に対応しない。どれが集まりの項目かは `service.collectionFields` が正本
- 取り込み: CSV の見出し・行のキー・申告された項目のどれかに集まりの項目があれば、DB を変える前（メディアの写し・アップロードより前）に DomainError 400
  - チャンクの取り込み（画面）は各チャンクの先頭で調べる（チャンクは同じ見出しを持つので最初のチャンクで止まる）。ZIP 一括の取り込み（`importData`）は全チャンクを先に調べてから書く
- 書き出し: 選ばれていても集まりの項目は出さない（CSV の列・manifest の fields から外す。関連・hasMany のドメインも）
