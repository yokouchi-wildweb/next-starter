# crud/collections Usage

## Overview

- `collections/README.md` の Usage から分けた文書: 既存の mediaUploaderMulti 列から主の集まりへの移行の手順(README の書式と同じ)

## Usage

### 既存の mediaUploaderMulti 列からの移行

既存の複数メディアの列（`mediaUploaderMulti` = 主の表の `text[]` 列）の値を、主の集まり（従属ドメインの 1 枚 1 行）へ移す手順。読み手は移行を行う fork の担当。SQL は形を示す例で、`<…>` を自分の名前に置き換えて使う。

### 前提

- 基盤に移行の仕組み（移行ヘルパー・移行専用の書き込み口・台帳の付け替え関数）は無い。移行はそのドメインを持つリポが行う
- 一度きりのデータ移行では DB を直接クエリで操作してよい（領域ごとの規則より上位の原則）。サービスを通すと binding がファイルを消す経路に当たるので、値の移し替えは直接 SQL で行う（下の「やってはいけないこと」）
- 生成器の fieldType `mediaUploaderMulti` は廃止した。domain.json に残っていると pnpm generate domain が止まるので、生成し直す前にこの手順で集まりへ移す（lib の `multi: true` の binding は残っているので、生成済みのサービスと列は移行するまで動く）。新しく足す項目は集まりにする（[src/features/README.md](../../../features/README.md)「主の集まりの項目（mediaCollection）」）

使う名前（プレースホルダ）:

| 名前 | 意味 | 例（廃止前の sample） |
|---|---|---|
| `<parent_table>` / `<ParentKey>` | 主の表 / 主の登録表キー（camelCase。台帳の record_type） | `samples` / `sample` |
| `<field>` | 元の multi 列（domain.json の項目名 = 列名） | `gallery_images` |
| `<child_table>` / `<ChildKey>` | 従属の表 / 従属の登録表キー | `sample_images` / `sampleImage` |
| `<parent>_id` | 従属の主への参照列（生成の雛形の名前） | `sample_id` |
| `<old_purpose>` | 元の列の用途 ID（`<ParentKey>.<field>`、ref の中に入っている） | `sample.gallery_images` |
| `<migration_log>` | 移行で作った従属の行の記録の表（手順 3 で作り、手順 5 の前に消す。戻し方はこの行だけに絞る） | `sample_images_migration_log` |

### 中間の形（元の列を残して並べる）

- 主の domain.json に、元の multi の項目を残したまま集まりの項目を足し、`pnpm generate domain -- <Parent>` で従属を作る（従属の domain.json の書き出し・生成・配線まで。従属の表は `[user-run] pnpm db:push`）
- 前例: `src/features/sample/domain.json` の `gallery_images`（multi）と `images`（集まり、従属 `sampleImage`）
- 移行が終わるまで元の列と集まりは並んで在る。画面の切り替え（どちらを表示・入力するか）はドメインの事情で決める

### 手順

0. 移行の前、書き込みを止める前に数える（読み取りだけ。`pnpm ops db inspect query "<SQL>"` で流せる）
   - 書き込みを止める前に流すのは、見つかった重複の解消に管理画面が要るから
   - fork が足す事前の検査も同じ時点で流すので、後の `db:push` で作られる列（手順 4 の FK など）を読まない形にする

   ```sql
   -- 1 行の最大の要素数（62 を超えるなら下の「並びの鍵」の 63 件以上の方法を使う）
   SELECT max(cardinality(<field>)) FROM <parent_table>;
   -- 同じ値が 2 回入っている行（1 ファイルを 2 行に入れないよう、先に人が解消する）
   SELECT id FROM <parent_table>
   WHERE cardinality(<field>) <> (SELECT count(DISTINCT v) FROM unnest(<field>) AS v);
   -- 台帳で元の列を指している ready の件数（手順 6 で 0 になる）
   SELECT count(*) FROM storage_objects
   WHERE status = 'ready' AND record_type = '<ParentKey>' AND record_field = '<field>';
   -- 未紐付けの ready の件数（手順 6 で増えていないことを見る）
   SELECT count(*) FROM storage_objects WHERE status = 'ready' AND record_id IS NULL;
   ```

   - 書き込みを止めるまでの間にアップロードや保存があれば件数は動く。手順 3 で止めた直後に同じ SQL を流し直し、手順 6 の比較はその値を基準にする。新しい重複が見つかれば、止めるのを解いて解消してからやり直す

1. 旧用途を受け口 storageObject/purposes/ の項目へ写し、アップロードを閉じる
   - ドメインの `services/server/storagePurposes.ts` にある `"<old_purpose>": { … }` を、`src/features/core/storageObject/purposes/<名前>.ts` の `export const purposes` に移す（元の項目を domain.json から外すと生成物からは消える）
   - 理由: 移した後も従属の行の ref は `<old_purpose>` のまま（ref の purposeId は改名できない）。ファイルの読み取り・削除は台帳の行の purpose で登録表を引くので、元の項目を domain.json から外して AUTO から消えても fork の区画の登録が要る。新しいアップロードは従属の用途（`<ChildKey>.file`）で受けるので、旧用途は閉じる
2. 従属を作る（上の「中間の形」）。元の列は残す
3. 書き込みを止め、主 1 行ずつ同じ TX で従属の行を作り、台帳を付け替え、作った行を記録する
   - 止め方は運用で決める（メンテナンス表示など）。主と従属への保存・削除・replaceByQuery が走らない状態にする
   - 止めた直後に手順 0 の SQL を流し直す。手順 4 の `db:push` もこの停止の間に流せるよう、停止の長さを見積もっておく
   - 先に記録の表を作る。中間の形では画面が集まりを先に出すことがあり、移行の外で作られた従属の行（新しいアップロード）が在りうるので、戻すときに「移行で作った行」だけを選べるようにする

   ```sql
   -- parent_id の型は主の id の型に合わせる。登録表（schemaRegistry）に無い表なので、在る間に pnpm db:push を流すと
   -- この表の DROP を提案される（y/N で N にする。移行を終えて手順 5 の前に自分で消す）
   CREATE TABLE <migration_log> (child_id uuid PRIMARY KEY, parent_id uuid NOT NULL);
   ```

   - 主 1 行（`<parent_id>`）の例（62 件まで。並びの鍵は下の「並びの鍵」）:

   ```sql
   BEGIN;
   WITH src AS (
     SELECT e.value AS file, e.ord
     FROM <parent_table> AS p, unnest(p.<field>) WITH ORDINALITY AS e(value, ord)
     WHERE p.id = '<parent_id>'
   ), ins AS (
     INSERT INTO <child_table> (<parent>_id, file, sort_order)
     SELECT '<parent_id>', file,
            'a' || substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', ord::int, 1)
     FROM src
     RETURNING id, file
   ), logged AS (
     -- 作った行を記録する（WITH の中の INSERT は本体が読まなくても必ず実行される）
     INSERT INTO <migration_log> (child_id, parent_id)
     SELECT id, '<parent_id>' FROM ins
   )
   -- 台帳を付け替える（台帳にある ref だけ。旧 URL は当たらない）。条件に元の主・元の列を入れ、別の行を指す台帳には触れない
   UPDATE storage_objects AS so
   SET record_type = '<ChildKey>', record_id = ins.id::text, record_field = 'file'
   FROM ins
   WHERE ins.file LIKE 'storage://%'
     AND so.id = substring(ins.file FROM '/([0-9a-f-]{36})\.[A-Za-z0-9]+$')::uuid
     AND so.status = 'ready'
     AND so.record_type = '<ParentKey>'
     AND so.record_id = '<parent_id>'
     AND so.record_field = '<field>'
   RETURNING so.id;
   -- 確かめ: UPDATE の件数 = その行の配列のうち storage:// の要素の数。合わなければ ROLLBACK してその行の台帳を調べる
   COMMIT;
   ```

   - UPDATE の件数が INSERT のうち台帳にある値（`storage://` の要素）の件数と合わなければ、その TX を巻き戻し（`ROLLBACK`）、その主の行の台帳（status・record_type・record_id・record_field）を調べてから流し直す。合わないまま進めない
4. 他の表が同じ値をコピーで持っていれば、従属の行への参照（FK、`ON DELETE SET NULL`）に張り替える
   - ref を別の表へコピーして持つことは禁止の形（台帳の 1 行は 1 つの業務行を指す）。移行のついでに、コピーの列を従属の行 id を指す FK に置き換える。どの表がコピーを持つかはドメインごとに調べる
   - 大きい表の新しい FK 列には部分 index を付ける（`index("<name>").on(table.<col>).where(sql\`${table.<col>} IS NOT NULL\`)`）。無いと、従属の行を消すたびに `SET NULL` の相手を探して表全体を走査する
   - 部分 index の `where` は push の比較に入らない。`where` だけを後で変えても検出されないので手動で DROP / CREATE する（[scripts/structure/registry/README.md](../../../../scripts/structure/registry/README.md)「index / default の記述ルール」）。push の後は `pnpm db:push:check` が 0 文であることを確かめる
   - 列・FK・index を足す `db:push` は表を走査し、その間ロックを取る。手順 3 の書き込み停止の間に流す。このとき `<migration_log>` の DROP を提案されるので N にする
   - とても大きい表では次の順にする（`CREATE INDEX CONCURRENTLY` は列より先に流せない）
     1. 列だけを先に足す（`ALTER TABLE <table> ADD COLUMN <col> <型>;`。NULL 可・default なしなら走査しない）
     2. `CREATE INDEX CONCURRENTLY IF NOT EXISTS <宣言と同じ名前> ON <table> (<col>) WHERE <col> IS NOT NULL;`（失敗すると INVALID の index が残るので、DROP してから流し直す）
     3. `db:push` を流す。列と index は在るものとして飛ばされるが、FK の追加は表を走査するので、この push も書き込み停止の間か低トラフィック時に流す
5. 元の列を直接 SQL で空にするか、列ごと落とす（その前に記録の表を消す: `DROP TABLE <migration_log>;`。ここで戻せなくなるので、手順 6 を確かめてから）
   - 空にする: `UPDATE <parent_table> SET <field> = '{}';`（サービスの保存では空にしない）
   - 落とす: 主の domain.json から元の項目を外して `pnpm generate domain -- <Parent>`、`[user-run] pnpm db:push`（AUTO から旧用途の行が消えるが、手順 1 の fork の区画の登録が残る）
   - ここから先は戻せない。手順 6 の数え上げを、空にする・落とす前にも一度流す
6. 確かめる（読み取りの SQL の数え上げ）

   ```sql
   -- 移行で作った従属の行数 = 元の列の要素数の合計（空にする前に比べる。移行の外で作られた従属の行は数えない）
   SELECT (SELECT count(*) FROM <migration_log>) AS migrated_rows,
          (SELECT coalesce(sum(cardinality(<field>)), 0) FROM <parent_table>) AS source_items;
   -- 付け替えた台帳の件数（= 元の列の storage:// の要素数）
   SELECT count(*) FROM storage_objects
   WHERE status = 'ready' AND record_type = '<ChildKey>' AND record_field = 'file';
   -- 元の列を指したままの ready は 0
   SELECT count(*) FROM storage_objects
   WHERE status = 'ready' AND record_type = '<ParentKey>' AND record_field = '<field>';
   -- 未紐付けの ready は手順 0 から増えていない
   SELECT count(*) FROM storage_objects WHERE status = 'ready' AND record_id IS NULL;
   ```

   - 掃除（storage-sweep）に空実行は無い。
   - `pnpm task storage-sweep` は本実行なので確かめには使わない
   - 移行の後に掃除が走っても、台帳が従属の行を指していれば消さない（照合は record_type の登録表キーで従属の行の有無を見て、従属の行の値に ref が入っているかも見る）
   - 台帳が元の主の列を指したまま値だけ移した行は、値の照合（`storageObjectConfig.sweep.reconcile.valueCheck`）が「値に無い」として報告し、`"detach"` なら実物ごと消す
   - 上の「元の列を指したままの ready は 0」を確かめてから掃除を走らせる（[src/features/core/storageObject/README.md](../../../features/core/storageObject/README.md)「値の照合」）
   - 台帳の紐付けが外れた ready（record_id が NULL）は、掃除が既定 24 時間後に実物ごと消す

### 並びの鍵（sort_order）

- 従属の並び列は lib の fractional の鍵（`generateInitialSortKeys(n)`、`src/lib/crud/drizzle/fractionalSort`）。先頭から `"a0"`, `"a1"`, …, `"a9"`, `"aA"`, …, `"aZ"`, `"aa"`, …, `"az"`（62 件）で、読み出しは `COLLATE "C"` の昇順
- 62 件までは上の SQL の `'a' || substr('0-9A-Za-z の 62 文字', ord, 1)` で lib と同じ鍵になる。NULL で入れると並びが id 順（uuid = 不定）になるので入れない
- 63 件以上の主があるとき（手順 0 の最大の要素数で分かる）: 63 件目からは鍵の桁が変わる（`"b00"` …）ので SQL で組まない。Node のワンショットで `generateInitialSortKeys(<最大の要素数>)` を呼んで鍵の列を作り、その配列を添字で引く形で INSERT に渡す（例: 鍵の列を一時表に入れて `ord` で結合する）

### やってはいけないこと

1. 台帳を付け替える前に、通常の保存（サービス経由）で元の列を空にする → storage binding が外れた ref の台帳を外し、実物をすぐに消す
2. 移行の間に主の replaceByQuery・物理削除をする → 新しい行に残らない ref の台帳を外し、旧 URL（自分の旧バケットのもの）は実物ごと消す
3. 従属のサービスの create で元の ref を書く → ref の purposeId（`<old_purpose>`）が従属の用途と違うので 400（旧 URL も 400）。従属の行は直接 INSERT で作る
4. 台帳の purpose を書き換える → ref の中の purposeId は改名できず、ファイルの読み取り・削除は台帳の purpose で登録表を引く。purpose は変えず、record_type / record_id / record_field だけを付け替える
5. 旧用途の登録を消す（fork の区画に写さずに元の項目を外す）→ 移した行のファイルが読めず、消せなくなる
6. 書き込みを止めずに流す → 移行の途中の保存が元の列や台帳を変え、件数が合わなくなる・台帳が外れる
7. 1 つのファイルを 2 行に入れる（同じ値を 2 回 INSERT する）→ 台帳の 1 行は 1 つの業務行だけを指す。先に手順 0 で重複を数えて解消する

### 旧 URL（台帳に無い http の値）

- `http(s)://…` の値（凍結した旧 URL）は台帳に行が無いので、付け替えの対象外。従属の `file` にそのまま INSERT する（上の SQL は `storage://` の値だけ台帳を UPDATE する）
- 移した後、従属の行をサービスで物理削除すると、自分の旧バケットの旧 URL は実物ごと消える（主の物理削除のときと同じ扱い）

### 移行の後の注意

- 従属の行の ref は旧用途（`<old_purpose>`）のまま。値を残す保存・外す保存・複製は通る（複製は従属の用途で新しい ref を作る）
- 従属の replaceByQuery の付け直し（rebind）は purpose の一致を条件にするので、旧用途の ref では 400。従属は主の集まり経由で保存する

### 戻し方

- 手順 5（元の列を空にする・落とす）の前なら戻せる。戻すのは記録の表にある「移行で作った行」だけ（移行の外で作られた従属の行と、その台帳には触れない）。台帳を先に元へ戻し、その後に従属の行を直接 SQL で消す（逆の順だと、掃除が「業務行の無い台帳」として外して実物を消す）

  ```sql
  BEGIN;
  UPDATE storage_objects AS so
  SET record_type = '<ParentKey>', record_id = m.parent_id::text, record_field = '<field>'
  FROM <migration_log> AS m
  WHERE so.status = 'ready' AND so.record_type = '<ChildKey>' AND so.record_field = 'file'
    AND so.record_id = m.child_id::text;
  DELETE FROM <child_table> WHERE id IN (SELECT child_id FROM <migration_log>);
  DELETE FROM <migration_log>;
  COMMIT;
  ```

- 一部の主だけ戻すときは、記録の表を `parent_id` で絞って同じ形で流す

- 従属の行はサービスで消さない（binding が台帳を外して実物を消す）
- 手順 5 の後は戻せない。空にする・落とす前に手順 6 を確かめる
