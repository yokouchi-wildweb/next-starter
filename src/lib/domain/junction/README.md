# domain/junction

## Overview

- 多対多（belongsToMany）の中間の表はいつも自分の登録 = 結びの登録（D354）。ここは結びの登録の読み方を 1 つだけ持つ（生成器・`pnpm check domain`・データの移しが同じ物を読む。名前を組み立てない）
- 関係の宣言の決まりの正は `src/domains/README.md` の「Relation」（`through` の行）

## Usage

- 置き場: 持つ側のドメインの `entities/<結びの登録名>/entity.json`。持つ側の関係は `through: <結びの登録名>` で名指すだけ（列・FK を書かない）。1 つの結びを名指す関係は 1 つ、反対側の belongsToMany は `through` を書かない読むだけの参照
- 結びの登録の形: 両側への結び 2 本（`belongsTo` で `required: true`、または手の表の形の 1 列の `foreignKeys`。FK の名前・onDelete も書ける）、その 2 列の合成の `primaryKey`、`registered: false`（汎用の口と登録表に出ない）。索引・足した列もここに書く
- 例: `src/domains/sample/entities/sampleToSampleTag/entity.json`（生成する結び、今動いている表の名前のまま）、`src/domains/core/user/entities/userToUserTag/entity.json`（手で持つ結び）
- 生成: `generate: true` の結びは `pnpm generate domain` が `entities/<結び>/drizzle.ts` だけを書く（サービス・画面・model / form / schema の型は持たない）。持つ側の base は結びの登録の表と列を読む
- `includeRelationTable` は廃止: 書くと `pnpm check domain` が止まり、書き直し方を出す

## API

- `links.mjs`（`@/lib/domain` と `./node` から）: `junctionLinksOf(junction, registrationOfTable)` = 結び 2 本の列と指す登録、`junctionColumnsOf(junction, owner, target, registrationOfTable)` = 持つ側・相手を指す列（揃わなければ null。自分自身への多対多は 1 本目が持つ側）、`registrationTableName(name, config)` = 登録の物理の表の名前
- `getTable.ts`（`@/lib/domain/server`）: `getJunctionTable(tables, tableName)` / `getJunctionTableOrThrow` = 表の一覧から物理の表の名前で引く（const 名を組み立てない）。結んだ版は `src/wiring/domainRegistry.ts` の `getJunctionTable(tableName)`

## Verification

- `scripts/structure/domain/tests/junctions.test.mjs`（検査と生成）、`src/lib/dataMigration/relations.test.ts`（書き出す結び）、`src/lib/dataMigration/dataMigrationMedia.test.ts`（表の引き方）
