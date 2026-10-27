# DOWNSTREAM NOTICE id:20261027-192133-sort-key-collation
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:-
date: 2026-10-27T19:21:33+09:00
severity: info
checkpoint: sort-key-collation
change: lib の並び替え（sortOrderColumn の fractional の鍵）で、text の並びの列を並べる・比べる所すべてに COLLATE "C" を付けた。対象は、create 時の採番、reorder（先頭・後ろへの移動と次の行の比較）、initializeSortOrder、fractionalSort/server.ts の関数、並びの列を名指しする search / searchWithDeleted / list / listWithDeleted / defaultOrderBy / searchForSorting の ORDER BY（並べ替え画面の読み出しを含む）。式は src/lib/crud/drizzle/fractionalSort/sortKeyOrder.ts の 1 か所にまとめた。保存されている鍵は書き換えない（読む順と比べ方だけ）。integer の並びの列は今までと同じ SQL
why: fractional の鍵は大文字・小文字の混ざる base62 で、バイト順で前後を決めて作られる。並びの列の照合順序が C（バイト順）でない DB（en_US など）では、37 件を超える一覧や大文字・小文字の混ざる鍵で、並びが鍵の順にならず、reorder や採番が既存と同じ鍵を作ったり別の位置に入れたりしていた。直した後は、DB の照合順序に依らず鍵の順で並ぶ。並びの列に fork が自分で張った普通の index は、COLLATE "C" の並べ方・比べ方に使われなくなる（DB の既定が C.UTF-8 でも同じ）
required_actions:
1. 上流を merge する。必須の作業は無い
2. 並びの列（sortOrderColumn に指定した text の列、既定 sort_order）に fork が自分で index を張っていないか確かめる（`grep -rn "sort_order\|sortOrder" src/features --include=drizzle.ts` で index の宣言を見る。DB では `pnpm db:query "select tablename, indexname, indexdef from pg_indexes where indexdef ilike '%sort_order%'"`）。張っていて表が大きい（数千行以上）なら、index を `(sort_order COLLATE "C")` で作り直す（drizzle の index を sql`${table.sort_order} COLLATE "C"` の式で宣言し直す → [user-run] pnpm db:push → pnpm db:push:check が 0 件）。張っていない、または表が小さければ何もしない
3. 任意: 照合順序が C でない DB で、この取り込みの前から並べ替えを使っていた一覧は、鍵の重複や位置のずれが残っていることがある。気になる一覧は並べ替え画面で 1 度並べ直すか、replaceByQuery({ sortOrderFromIndex: true }) で振り直す（しなくても壊れない。重複した鍵の行は id の順で並ぶ）
4. `pnpm typecheck` `pnpm lint` を通す
verify: `pnpm typecheck` `pnpm lint` が通る | DATABASE_URL があれば `pnpm test:crud-sort-collation-db` が通る（C 以外の照合順序が無い DB では、そのケースを飛ばしたと表示される） | 手順 2 で index を作り直したなら `pnpm db:push:check` が 0 件
manual_steps: -
refs: src/lib/crud/drizzle/fractionalSort/sortKeyOrder.ts, src/lib/crud/drizzle/query/buildOrderBy.ts（sortKeyColumn）, src/lib/crud/drizzle/service.ts, src/lib/crud/README.md「並びの鍵の照合順序（COLLATE "C"）」, src/lib/crud/drizzle/fractionalSort/sortCollation.db.test.ts
notes:
- DB の照合順序が C.UTF-8（Neon の既定と開発 DB）の fork では、見た目の並び順は変わらない（C.UTF-8 は base62 の鍵をバイト順で並べる）。それでも手順 2 の index の件は当てはまる
- db:push は不要（スキーマは変えていない）。手順 2 で index を作り直すときだけ要る
- 削除・移動なし。追加: src/lib/crud/drizzle/fractionalSort/sortKeyOrder.ts, src/lib/crud/drizzle/fractionalSort/sortCollation.db.test.ts, package.json の test:crud-sort-collation-db
- API の変化: buildOrderBy に省略できる第 3 引数 { sortKeyColumn } が増えた（既存の呼び出しはそのまま）
- 同じ出荷に、createCrudService の collections オプション（ドメイン集約の lib の段: 差分同期・読み出しの配列・先頭 1 件の SQL・2 段の複製と duplicateWithIdMap・CSV/ZIP の拒否）が入っている。使わなければ何も変わらないので notice は無い（使い方は src/lib/crud/README.md「ドメイン集約（collections オプション）」）。全サービスに duplicateWithIdMap が増えた（集まりの無いサービスでは duplicate と同じ複製をし、idMaps は空）
- fork の状態: not checked
