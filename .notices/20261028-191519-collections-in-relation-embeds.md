# DOWNSTREAM NOTICE id:20261028-191519-collections-in-relation-embeds
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:-
date: 2026-10-28T19:15:19+09:00
severity: action-required
checkpoint: collections-in-relation-embeds
change: 主の集まり（createCrudService の collections）を、他のサービスの withRelations の埋め込み（belongsTo / hasMany / belongsToMany、深さ 2 まで）にも載せるようにした。集まりの宣言は表をキーに登録する（lib の defineTableCollections）。生成器は集まりを持つ主の entities/drizzle.ts に `defineTableCollections(<P>Table, () => import("@/features/<p>/services/server/collections").then((m) => m.collections));` の 1 行と import を出し、主のサービスも組み立て時に登録する。埋め込みの読み出しは主自身の読み出しと同じ部品（全件・同じ並び、集まり × 深さごとに 1 クエリ、主の id の IN）。集まりの無い表の埋め込みはクエリが増えない
why: 埋め込みで読んだ主の行に集まりの配列が無く、表示が黙って消える・埋め込みの主から作ったフォームが集まりを [] で送って従属の行を全部消す、を防ぐ（下流 oripa-do からの依頼 20261028-175503）
required_actions:
1. 上流を merge する
2. 集まりを持つ主のうち、entities/drizzle.ts を手書きしている（generateFiles.entities: false など）主があれば、その drizzle.ts の表の定義の後に上の `defineTableCollections(...)` の 1 行と `import { defineTableCollections } from "@/lib/crud/collections/tableCollections";`（生成物と同じ） を足す。生成している主は `pnpm dc:generate <Domain> --yes --only entities` で入る（集まりを持つ主が無ければ何もしない）
3. クライアントのコンポーネント（"use client"）が、集まりを持つ主の entities（index か drizzle.ts）から型ではない値を import していないか確かめる（`import type` なら問題ない）。値を import していると、バンドラが登録の遅延 import を辿り、サーバー用の services/server/collections.ts までクライアントに引き込む恐れがある。あれば型だけの import にするか、値を別のファイルへ分ける
4. `pnpm typecheck` `pnpm lint` を通す
verify: `pnpm typecheck` `pnpm lint` が通る | `pnpm test:collection-wiring` が通る（全ての主の表に、サービスを読み込まなくても届く登録があるかも確かめる）| 集まりを持つ主を埋め込んで読む画面で、集まりの配列（先頭の画像など）が出る
manual_steps: -
refs: src/lib/crud/README.md「ドメイン集約」→「読み出し」, src/lib/crud/collections/tableCollections.ts, src/lib/crud/collections/projectCollections.ts, src/lib/crud/drizzle/relations/hydrate*.ts, scripts/registry/collectionWiring/
notes:
- 生の drizzle の select（サービスを通さない読み出し）は対象外。先頭 1 件が要るなら firstInCollection を使う
- 埋め込みの配列は全件（先頭だけのモードは作らない）。主の集まりと同じものなので、埋め込みから作ったフォームが送っても従属の行は消えない
- 同じ深さで同じ主を 2 つの関連から埋め込むと、関連 × 集まりごとに 1 クエリ（行ごとではない）
- 最初の埋め込みで登録の遅延 import が 1 回走る（以後はキャッシュ）
- 削除・移動なし。追加: src/lib/crud/collections/tableCollections.ts, projectCollections.ts, collectionsEmbed.db.test.ts（test:crud-collections-db に含む）
- fork の状態: dc:parity で 10 リポ（88-base TriQ __voranowa boardgame-site next-vnx oripa-demo oripa-do-2 oripa-do pandora voranowa）の domain.json の生成物が不変であることを upstream 側で確かめた（集まりを持つ主はまだ無い）。手順 3 の値 import は not checked
