# Neonのマイグレーション実行手順

Neon（PostgreSQL）でテーブル構造を管理する際のマイグレーション手順をまとめました。ドメインを初めて追加する方や Drizzle を触ったことがない方でも迷わないよう、背景から順番に説明しています。

## 🌱 Neonのマイグレーションの特徴

- **TypeScript を唯一の情報源にできる**：`drizzle.config.ts` で `schemaRegistry.ts` を参照し、そこからエクスポートされている各ドメインの `drizzle.ts` がスキーマ定義として読み込まれます。TypeScript ファイルを更新すると、その差分を元に SQL が生成される仕組みです。
- **マイグレーションファイルは自動生成**：`npx drizzle-kit generate` を実行すると `drizzle/` ディレクトリに SQL ファイルが作られます。ファイル名にはタイムスタンプが付与され、生成順が分かりやすくなっています。
- **DB への適用もコマンド一発**：生成した SQL は `npx drizzle-kit push` で Neon に反映されます。都度ダンプを作成したり手動で SQL を実行する必要はありません。
- **レビューしやすいテキスト差分**：マイグレーションファイルも TypeScript の変更も Git 管理できるので、レビュー時に「何がどう変わるのか」を確認しやすいのが特徴です。

## 🗂 マイグレーションが参照する主なファイル

| 役割 | ファイル | 補足 |
| ---- | -------- | ---- |
| Drizzle CLI の設定 | `drizzle.config.ts` | スキーマの読み込み先（`schemaRegistry.ts`）と生成先（`drizzle/`）を指定しています。
| スキーマの集約ポイント | `src/registry/schemaRegistry.ts` | 各ドメインの `drizzle.ts` を `export * from ...` で集約。ここに登録されているものだけがマイグレーション対象になります。
| ドメイン個別のスキーマ | `src/features/<domain>/entities/drizzle.ts` | テーブル・カラム定義の実体。`pgTable` などの関数で列を宣言します。
| 生成される SQL | `drizzle/*.sql` | `drizzle-kit generate` 実行時に作成されます。レビューや手動確認に利用できます。

> ✅ `schemaRegistry.ts` にドメインのエクスポートを追加し忘れるとマイグレーションに反映されません。自動生成スクリプトを使っていない場合は手動で追記してください。

## 🔧 実行前の準備

1. **接続情報を確認**：`.env.development` や `.env.production` に `DATABASE_URL` を設定し、Neon の接続先が正しいかをチェックします。`npx drizzle-kit ...` を実行する際は `APP_ENV` 環境変数で読み込むファイルを切り替えられます（例：`APP_ENV=.env.production`）。
2. **TypeScript のスキーマを更新**：テーブル変更が目的なら該当ドメインの `drizzle.ts`（必要に応じて `index.ts` や `schema.ts` も）を修正します。
3. **`schemaRegistry.ts` を確認**：新しいドメインを追加した場合は `export * from "@/features/<domain>/entities/drizzle";` が差し込まれているか確認します。

## 🚀 `npx` を使ったマイグレーション実行フロー

以下は `npx` を用いた最もシンプルな流れです。`npm run db:generate` / `npm run db:push` という npm スクリプトも同じコマンドを呼び出しているので、お好みで置き換えて構いません。

1. **SQL を生成する**
   ```bash
   npx drizzle-kit generate
   ```
   - `drizzle/` 配下に `YYYYMMDDHHMMSS_migration.sql` の形式でファイルが出力されます。
   - 生成された SQL を一度確認し、意図しないテーブル削除やデータ破壊が含まれていないかチェックしましょう。

2. **Neon に反映する**
   ```bash
   APP_ENV=.env.development npx drizzle-kit push
   ```
   - `APP_ENV` を変更すると、`.env.production` など任意の環境変数ファイルから `DATABASE_URL` を読み込めます。未指定の場合は既定の `.env` が利用されます。
   - 直前に生成した SQL が順番に実行されます。
   - エラーが出た場合は、Neon 側の権限設定や既存データとの整合性を確認してください。

3. **動作確認をする**
   - 必要に応じてアプリを起動し、追加したカラムやテーブルが正しく利用できるかを確認します。
   - 問題がなければ生成された SQL と TypeScript ファイルをコミットします。

> 💡 既存のマイグレーションファイルを修正するのではなく、新しい変更ごとに `generate` を実行して差分を積み重ねるのが安全です。

## 🤖 `scripts/domain-config/generator` を使ってドメインを自動生成した場合

CLI からドメインを自動生成した場合も、最終的なマイグレーション手順は変わりません。ただし生成されたファイルが正しく参照されているかを念のため確認しましょう。

1. **ドメイン設定を作成**
   ```bash
   npx domain-config --init
   ```
   - 質問に沿って `dbEngine` に `Neon` を選ぶと、`src/features/<domain>/domain.json` に設定が保存されます。

2. **関連ファイルを一括生成**
   ```bash
   npx domain-config --generate <Domain名のパスカルケース>
   ```
   - `generate-drizzle-entity.mjs` などのスクリプトが呼び出され、`drizzle.ts` を含む各種ファイルが自動で作成されます。
   - 同時に `updateSchemaRegistry.mjs` が走り、`schemaRegistry.ts` にドメインのエクスポートが追加されます。

3. **マイグレーションを実行**
   - 生成直後の状態でも DB にはテーブルが存在しないため、必ず前述の `npx drizzle-kit generate` → `npx drizzle-kit push` を実行して Neon に反映します。
   - 追加でフィールドを編集した場合も同じ流れで SQL を再生成してください。

4. **生成物の確認ポイント**
   - `src/features/<domain>/entities/drizzle.ts` に期待したカラム・リレーションが定義されているか。
   - `src/registry/schemaRegistry.ts` に当該ドメインの `export * from ...` が入っているか。
   - `drizzle/` に生成された SQL の内容が問題ないか。

## 📝 まとめ

- TypeScript のスキーマ定義がそのまま Neon へのマイグレーションに繋がるため、ソースコードの更新とコマンド実行の二段構えで運用します。
- `schemaRegistry.ts` に登録されているものだけが対象になる点に注意してください。
- 自動生成スクリプトを使った場合も、最後は必ず `npx drizzle-kit generate` と `npx drizzle-kit push` を実行して Neon のテーブルを最新化しましょう。
