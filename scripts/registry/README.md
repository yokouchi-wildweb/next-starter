# scripts/registry — スキーマ登録と push round-trip の検査

`src/registry/schemaRegistry.ts` は push の唯一のスキーマ入口。ここには、push 本体（`pnpm db:push`）と、その入口と実 DB の整合を機械的に確認する 2 つの検査、それに付随する運用方針・記述ルールをまとめる。

| コマンド | 何をするか | DB 接続 |
|---|---|---|
| `pnpm db:push` | schemaRegistry（スキーマゲート適用後）を実 DB に反映する（`scripts/registry/push.ts`） | 必要・書き込む |
| `pnpm test:schema-registry` | core ドメインの `entities/drizzle.ts` が全て schemaRegistry に登録されているか（登録漏れ = テーブルが作られない） | 不要 |
| `pnpm db:push:check` | schemaRegistry（スキーマゲート適用後）と実 DB を drizzle-kit の push モードで比較し、提案される SQL を表示する。1 文でもあれば exit 1 | 必要・読み取り専用 |

## スキーマ変更を DB に反映する（push）

このリポジトリはマイグレーションファイルを使わない。`pnpm db:push` が schemaRegistry と実 DB を直接比較し、差分の SQL をその場で実行する（`drizzle-kit generate` → SQL ファイル適用、という手順は取らない）。

`pnpm db:push` の本体は `scripts/registry/push.ts`（drizzle-kit CLI ではなく `drizzle-kit/api` の `pushSchema`）。理由は **スキーマゲート**: 機能フラグで無効な機能のテーブルを、push のコード側と DB 側の両方から外す（作らない・消さない）。CLI はスキーマファイルの export をそのまま拾うのでコード側から外せない。仕組みと決まりは `src/proxies/README.md`（Feature Gate）。

- 実行する SQL を必ず表示してから実行する（差分が無ければ何もしない）。
- テーブル / 列の rename 判定は drizzle-kit の対話プロンプトがそのまま出る。
- データ消失を伴う文（DROP / truncate / 型変更）を含むときは y/N で確認する。`--force` で省略。
- `drizzle-kit push` を直接叩くとスキーマゲートを通らない（無効な機能のテーブルも作られる）。使わない。

1. `entities/drizzle.ts` を変更する（business ドメインは `domain.json` → `pnpm dc:generate`。新しいドメインは schemaRegistry に自動登録される）
2. core ドメインに `entities/drizzle.ts` を新設した場合は schemaRegistry の CORE DOMAINS ブロックに `export *` を手で追加し、`pnpm test:schema-registry` を通す
3. `pnpm db:push` で開発 DB に反映する（`.env.development` 固定。DB に書き込む操作なので実行者が手で行う）
4. index を追加・変更した場合は `pnpm db:push:check` が差分ゼロになることを確認する（下記）

他環境への push は `pnpm db:push` ではなく `APP_ENV=<env ファイル> pnpm exec tsx scripts/registry/push.ts`（`db:push` スクリプトは `APP_ENV=.env.development` を固定で設定するため）。本番 push のタイミングは下記「運用方針」に従う。

## db:push:check（push の読み取り専用ドライラン）

```bash
pnpm db:push:check                          # .env.development（APP_ENV 未指定時の既定）
APP_ENV=.env.production pnpm db:push:check  # 任意の env ファイル（drizzle.config.ts と同じ規約）
pnpm db:push:check -- --allow-defaults      # SET/DROP DEFAULT 行だけ無視（fork 固有の default 事情向け退避口）
```

- DB には一切書き込まない。drizzle-kit `pushSchema` の差分計算だけを使い、`apply()` は呼ばない。
- `pnpm db:push` と同じスキーマゲートを掛ける（無効な機能のテーブルは比較対象外）。
- 出力は「push を実行すると実行される SQL」そのもの。差分ゼロなら exit 0。
- **push 直後に実行して差分ゼロになること**が、index / default の書き方が正しいことの定義。差分が残る index は、本番でも push のたびに DROP + CREATE される（下記「なぜ重要か」）。

### いつ実行するか

- **index を追加・変更したとき（必須）**: `pnpm db:push` → `pnpm db:push:check` が差分ゼロになることを確認してからコミットする。
- **本番 push の前（任意）**: `APP_ENV=.env.production pnpm db:push:check` で、実行される SQL を事前に見られる。
- 日常の列追加・テーブル追加では不要。

### なぜ重要か

drizzle-kit 0.31.x は、特定の書き方の index と一部の列 default を DB から正しく読み戻せず、**DB が既にスキーマどおりでも毎回「差分あり」と判定して DROP INDEX + CREATE INDEX / SET DEFAULT を実行する**。drizzle-kit CLI の push は `--verbose` を付けない限り実行した SQL を表示しないため、これは気づかれないまま続いていた（現在の `pnpm db:push` は毎回全文を表示する）。

- SET DEFAULT の再実行は無害。
- index の再構築は、本番の大規模テーブル（数十万〜数百万行）では **CREATE INDEX 中そのテーブルへの書き込みがロックされ、DROP から CREATE の間は index が存在しない**。pandora（play_batches 120 万行）で push のたびに 4 本が再構築されていたのが発見の契機（upstream-request 20261010-195330 / 20261013-221046）。

## 運用方針（DB push とロック）

**DB push はテーブルロックを伴いうる操作である。安全は「実行タイミングを選ぶ」ことで担保し、push のたびの個別判断は求めない。**

- 本番 push はメンテナンスモード中（maintenanceProxy / maintenance.config.ts）または低トラフィック時に行う。
- 大規模テーブルへの CREATE INDEX は通常の push ではそのテーブルの書き込みを止める。許容できるタイミングで push すればよい。
- 無停止で index を追加したい fork 向けの任意テクニック: push 前に `pnpm db:query "CREATE INDEX CONCURRENTLY IF NOT EXISTS <同名> ON ..."` で先に作っておくと、drizzle-kit は既存 index として認識し push では何もしない（pandora の user_items 2300 万行で約 10 秒・書き込み停止なしを確認済み）。定義は `db:push:check` の出力をそのまま使い `CONCURRENTLY` を足す。
- データ消失を伴う文（DROP COLUMN / DROP TABLE / 型変更）は `pnpm db:push` が y/N で確認を求める。
- 実行する SQL は毎回全文表示される（drizzle-kit CLI の `--verbose` 相当が既定）。

## index / default の記述ルール（round-trip するために）

drizzle-kit push の index 比較キーは `名前; 列ごとに (式なら "" / 列名)--asc--nulls; unique; method; with` で、`where` と opclass は比較されない。DB 側の「式かどうか」は **index 単位**で判定される。このため次を守る。

| やりたいこと | 書き方 | 理由 |
|---|---|---|
| DESC index | `index("x").on(table.col.desc())` | `DESC NULLS LAST` で作成され、読み戻しも一致する。**`sql\`${table.col} DESC\`` は禁止**（式扱いになり asc/nulls が DB 側と一致せず毎回再構築） |
| `sql\`col DESC\`` で作られた既存の物理 index（`DESC` = NULLS FIRST）を無停止で引き取る | `table.col.desc().nullsFirst()` | 物理 index と同じ nulls 順にする。新規作成なら `.desc()` だけでよい |
| 式 index | `index("x").on(sql\`lower(btrim(${table.name}))\`)` | 純粋な式のみなら round-trip する（precedent: users_name_norm_idx） |
| 通常列と式の混在 | **全列を `sql\`${table.col}\`` で書く**か、混在をやめる | DB 側は index 単位で全列が式扱いになるため、通常列が 1 つでもあると一致しない |
| 部分 index の `where` | 書いてよいが、**`where` だけを変えても push は差分を検出しない**（既知のギャップ） | 変更時は手動で DROP / CREATE する |
| 空配列 default | `text("x").array().default([]).notNull()` のまま | drizzle-kit の誤正規化（`'{}'` → `'{""}'`）はパッチで修正済み |
| jsonb default | `jsonb("x").default({...})` のまま | キー順の不一致（PostgreSQL は jsonb のキーを長さ→バイト順で保存）はパッチで修正済み |

## drizzle-kit へのパッチ（patches/drizzle-kit@\<version\>.patch）

`pnpm.patchedDependencies` で drizzle-kit に 4 点の修正を当てている。`pnpm install` で自動適用されるので fork 側の作業は不要。

1. **`pushSchema`（api.js / api.mjs）のバインドパラメータ欠落**: 内部アダプタが `execute(sql.raw(query))` でパラメータを捨てるため、複合 PK を持つテーブルがあると introspection が失敗する（または誤った DROP CONSTRAINT を提案する）。`$client.unsafe(query, params)`（postgres-js）/ `$client.query(query, params)`（pg）に差し替え。`db:push` と `db:push:check` の前提。
2. **空配列 default の誤正規化（api.js / api.mjs / bin.cjs）**: DB 側 `'{}'::text[]` を `'{""}'` に変換していたのを `'{}'` に。
3. **jsonb default のキー順（api.js / api.mjs / bin.cjs）**: スキーマ側の `JSON.stringify` を PostgreSQL の jsonb 正規キー順（キー長 → UTF-8 バイト順、再帰）で出力。
4. **複合 PK の列順（api.js / api.mjs / bin.cjs）**: DB から複合 PK の列を読むクエリ（information_schema の結合）が順序を保証せず、PostgreSQL 18 ではアルファベット順で返る。スキーマ側の列順と食い違い、正しい PK を push のたびに DROP CONSTRAINT + ADD CONSTRAINT していた（PK = ユニーク index の再構築 = テーブルロック）。PK 名を取るクエリで `pg_constraint.conkey` の順に列名も取り、その順を使う。PostgreSQL 17 以前は定義順で返っていたため顕在化していなかった。

いずれも比較用の読み取り・正規化のみで、DB に書く default や PK の実効値は変わらない。`pnpm db:push` は api.js の `pushSchema` を使うので 1 の修正も前提になる。bin.cjs（drizzle-kit CLI）にも当てているため、CLI 経由でも無駄な SET DEFAULT は出ない。

### drizzle-kit を更新するとき

パッチは `drizzle-kit@0.31.8` に紐づく。バージョンを上げる場合:

1. `pnpm patch drizzle-kit@<new>` → 表示された編集ディレクトリの api.js / api.mjs / bin.cjs に同じ 4 修正を当て直す（`[next-starter patch]` コメントで検索）→ `pnpm patch-commit <dir>`。
2. package.json の `patchedDependencies` キーを新バージョンに差し替え、旧 patch ファイルを削除。
3. `pnpm db:push` → `pnpm db:push:check` で差分ゼロを確認。

上流で修正済みのバージョンなら該当項目のパッチを落とす。0.31.11 時点では 4 点とも未修正。4 は 1.0 系（1.0.0-rc.4 で確認）で読み取り処理が作り直され解消済み（conkey 順）。1.0 へ移るときは 4 を落とせる。
