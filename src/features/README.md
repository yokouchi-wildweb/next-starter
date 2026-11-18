# features/

## Overview

- ドメイン別の機能を格納するディレクトリ。各ドメインは `domain.json` を持ち、コード生成の設定を定義する。
- ドメイン = `src/features/` と `src/features/core/` の直下の `_` で始まらないフォルダで、地区(district)の 1 種(ほかは lib・枠・proxies)。名前はフォルダ名、core と業務で同名は失敗。一覧(domain.json の有無・generate を含む)は地区の地図 `src/registry/district-map.jsonl`(`pnpm generate district-map`、地区の定義と欄: [src/lib/districtMap/README.md](../lib/districtMap/README.md))。
- domain.json の書き方(スキーマ)は [API.md](./API.md)、メディア・インデックス・汎用 API の権限のキーは [Extension.md](./Extension.md)

## Usage

### 関連コマンド

domain.json を手で書いて `pnpm forge`（検査 → 生成 → 事後検査）。個別には `pnpm generate domain -- <Domain> [--only <categories>]` / `pnpm generate domain` / `pnpm generate domain -- --delete <Domain> --confirm <snake_name>`（既定は対話なし、`-i` で対話）。generate の旗・生成物と上書きの扱い・典型的な流れは [`scripts/structure/domain/README.md`](../../scripts/structure/domain/README.md)。

### サンプル

最小構成:

```json
{
  "domainConfigVersion": "1.3",
  "singular": "category",
  "plural": "categories",
  "label": "カテゴリ",
  "dbEngine": "Neon",
  "idType": "uuid",
  "relations": [],
  "useCreatedAt": true,
  "useUpdatedAt": true,
  "fields": [
    {
      "name": "name",
      "label": "名前",
      "fieldType": "string",
      "formInput": "textInput",
      "required": true
    }
  ],
  "apiAccess": {
    "read": { "roleCategories": ["admin"] },
    "write": { "roleCategories": ["admin"] }
  }
}
```

全機能の実装例は `src/features/sample/domain.json` を参照。

### ドメインの運用コマンド・移行・シード

ドメインはデータと画面だけでなく、そのドメインを動かす道具も持つ。scripts/ には置かない(scripts/ は全ドメイン共通の道具だけ。`scripts/README.md`)。ランナーがドメインを走査して見つけるので、一覧に足す必要は無い。

| 置き場 | 何か | 呼び方 |
|---|---|---|
| `<domain>/scripts/tasks/<名前>.ts` | 運用コマンド(繰り返しの運用・機能を有効にするたびの導入) | `pnpm task <domain>:<名前>` |
| `<domain>/scripts/migrations/<名前>.ts` | notice が名指す 1 回きりの移行(notice と同じ commit で出し、済んだら消してよい) | `pnpm task <domain>:<名前>`(notice の `uses:`) |
| `<domain>/scripts/migrations/<名前>.local.ts` | git に入れない緊急のデータ修正(下流に流さない。同じ中身の dry-run の後に本実行) | `pnpm task <domain>:<名前>` |
| `<domain>/seed.ts` | シード(`defineSeed`、データだけ。そのドメインのサービスで入れる) | `pnpm ops db seed [--all]` |

- 書き方: タスク・移行 = `src/lib/task/README.md`、シード = `src/lib/seed/README.md`。名前は `<domain>:<ファイル名>`(kebab-case)
- 中身はそのドメインのサービスを呼ぶだけ(DB を直接書く部品は読まない、lint `tools-no-db-write`。直接の SQL が要る物は移行)。実行は毎回 `task_runs` に記録され、二度流すと困る物は止める鍵を宣言する
- core の運用コマンドの例: `pnpm task wallet:reverse-history`(取引の取り消し)・`pnpm task wallet:bulk-grant`(一括付与と補填)・`pnpm task user:bulk-change-status`(ステータスの一括変更)。詳細は各ドメインの README
- どのドメインにも同じ形で使う操作(書き出し・取り込み・一括更新・一括削除)はドメインに置かず `pnpm ops data <command> <domain>`(`scripts/operations/data/README.md`)。許可は domain.json の `apiAccess`(と `commands`。Extension.md)
- fork が core のドメインにタスク・シードを足す受け口は無い。fork の物は fork 自身のドメインに置く
- 新しいドメインには `pnpm generate domain` が `seed.ts` の雛形を一度だけ書く(write-once)

### エンティティとフォームスキーマ

- `entities/schema.ts`: サーバー処理の正規形（`XxxBaseSchema` / `XxxCreateSchema` / `XxxUpdateSchema`）。フォーム固有の都合を持ち込まない
- `entities/form.ts`: `schema.ts` を `z.infer` した型だけを公開する。追加のスキーマは書かない。フォーム側で足したい項目は、空の型との交差で広げる（`XxxCreateFields = z.infer<typeof XxxCreateSchema> & XxxCreateAdditional`）
- フォーム固有の入力（確認用パスワード、一時的に分けた入力欄など）は、そのフォームの隣の `formEntities.ts` に置く。使う範囲が限られるので短い名前でよい: `FormSchema`（resolver に渡す Zod スキーマ。`schema.ts` を拡張して作るのが基本）/ `FormValues`（`useForm` の型）/ `DefaultValues`
- 同じ構造のフォームが複数要るときは、スキーマではなくフォームコンポーネントを再利用する

business ドメインの `entities/` は `pnpm generate domain` が生成するので手で編集しない。上の規約は主に core ドメインと `formEntities.ts` を書くときに使う。

## API

- domain.json スキーマ定義(トップレベルプロパティ・Relation・Field・FieldGroup・compositeUniques): [API.md](./API.md)

## Extension

- 主の集まりの項目(mediaCollection)・MediaUploader とファイルの保存(storage)・indexes・ApiAccess: [Extension.md](./Extension.md)

## Internals

### 生成カテゴリ（generate: true のとき作るもの）

`generate`（既定 true）のドメインは、下の全カテゴリを毎回作り直す（集まりの従属は entities / serverServices / registry / fieldConstants / presenters だけ）。`generate: false` は何も書かない（domainEntry.ts の書き直しも無い。serviceRegistry.ts は domainEntry.ts から作るので載り続ける）。`generate: false` のドメインはどんな実行でも生成器を通さない（`--only`・`-i` でも書かず、生成前の検査もしない）。今回だけ一部のカテゴリに絞るときは `--only`（`scripts/structure/domain/README.md`）。

| カテゴリ | - | 説明 |
|-----------|-----|------|
| entities | - | エンティティ（schema, form, model, drizzle/firestore） |
| components | - | 管理画面コンポーネント |
| hooks | - | CRUD フック |
| clientServices | - | axios クライアント |
| serverServices | - | サーバーサービス（`drizzleBase.ts` / `firestoreBase.ts` は毎回生成、`<domain>Service.ts` とシードの雛形 `seed.ts`（Drizzle のドメインだけ。書き方 `src/lib/seed/README.md`）は無いときだけ生成） |
| adminRoutes | - | 管理画面ルート（page.tsx 1 行スイッチ + `_screen/`（Screen と loader.ts）の構造で生成。page.tsx は初回のみ生成、`_screen/` は毎回再生成。詳細: `src/lib/screens/Internals.md` の生成される管理画面） |
| registry | - | レジストリへの登録（`services/server/domainEntry.ts` の生成を含む。`apiAccess` / `useImportExport` を access に展開し、最後に `pnpm generate registry` が serviceRegistry.ts を作り直す） |
| fieldConstants | - | options を持つフィールドの定数/型 |
| presenters | - | テーブル表示用フォーマッタ |
