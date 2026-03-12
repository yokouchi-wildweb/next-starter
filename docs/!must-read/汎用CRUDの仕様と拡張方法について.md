# 汎用 CRUD の仕様と拡張方法について

> 最速で実装に入るためのガイド。コアスペックの詳細は `src/lib/crud/README.md` を参照。

---

## アーキテクチャ

```
Hook → クライアントサービス(axios) → API ルート → サーバーサービス(createCrudService) → DB
```

- `createCrudService` が CRUD 全操作を提供。カスタマイズは `services/server/wrappers/` で差分を挟む。
- domain-config (`dc:generate`) でエンティティ・サービス・フックを一括生成。生成ファイルは直接編集しない。

---

## 提供メソッド早見表

| 操作 | メソッド | フック名 | 備考 |
|------|----------|----------|------|
| 作成 | `create` | `useCreate<Domain>` | M2M 自動同期 |
| 取得 | `get` | `use<Domain>` | withRelations / withCount 対応 |
| 一覧 | `list` | `use<Domain>List` | 全件取得。フィルタ不要時のみ |
| 更新 | `update` | `useUpdate<Domain>` | M2M 差分同期 |
| 削除 | `remove` | `useDelete<Domain>` | useSoftDelete 時は論理削除 |
| 検索 | `search` | `useSearch<Domain>` | **メインの検索メソッド。関連フィルタ、ページング、テキスト検索すべて対応** |
| カスタムクエリ | `query` | なし（サーバー専用） | JOIN 等の自由な SELECT + ページング |
| upsert | `upsert` | `useUpsert<Domain>` | |
| バルク | `bulkUpsert`, `bulkUpdate`, `bulkDeleteByIds` 等 | 各対応フック | |
| 復元 | `restore` | `useRestore<Domain>` | useSoftDelete 時のみ |
| 並び替え | `reorder` | `useReorder<Domain>` | sortOrderColumn 時のみ |

> `list` は `search` のサブセット。リレーション、フィルタ、ページングが必要なら `search` を使う。

---

## search() で使えるフィルタリング手段

| 手段 | 用途 | 例 |
|------|------|-----|
| `where` (WhereExpr) | メインテーブルのカラム条件 | `{ field: "status", op: "eq", value: "active" }` |
| `relationWhere` | リレーション経由のフィルタ（M2M / belongsTo） | 下記参照 |
| `extraWhere` | Drizzle SQL 直接注入（上記で表現できない場合） | `sql\`EXISTS (...)\`` |
| `searchQuery` + `searchFields` | テキスト検索（ILIKE） | キーワード検索 |

**合成順序:** where → extraWhere → relationWhere → ソフトデリート → searchQuery（すべて AND）

### relationWhere

belongsToMany と belongsTo の両方に対応。`targetIds` の有無で自動判別。

```typescript
relationWhere: [
  // belongsToMany: ターゲット ID でフィルタ
  { relationField: "tagIds", targetIds: ["id1"], mode: "any" },
  // belongsTo: リレーション先テーブルのカラム条件でフィルタ
  { relationField: "user", where: { field: "role", op: "eq", value: "contributor" } },
]
```

**belongsToMany のモード:** `any`（いずれか一致、デフォルト）/ `all`（全一致）/ `none`（除外）

- `targetIds` が空配列 → スキップ（no-op）
- 未登録の `relationField` → エラー
- Drizzle 専用（Firestore では無視）
- 詳細: `src/lib/crud/README.md`

---

## 拡張判断フロー

```
やりたいことがある
  → base のメソッドで対応できる？ → YES → そのまま使う
  → NO → relationWhere で対応できる？ → YES → search() に relationWhere を渡す
  → NO → extraWhere で対応できる？ → YES → Drizzle SQL を注入
  → NO → base.query() で JOIN + ページング流用できる？ → YES → query() を使う
  → NO → wrappers/ で base メソッドを前後に拡張
  → NO → services/server/<domain>/ に独自メソッド作成
```

---

## サーバーサービスの配置ルール

- `<domain>Service.ts` には直接実装を追加しない。単体メソッドファイルを作成して読み込む
- 既存 CRUD メソッドの上書き → `services/server/<domain>/wrappers/` に配置
- ドメイン固有メソッド → `services/server/<domain>/` 配下に適切なファイルを作成

---

## できないこと（制約）

| 制約 | 対応策 |
|------|--------|
| メインテーブル以外のカラム属性でフィルタ（タグ名で絞り込み等） | `base.query()` で JOIN |
| M2M 関連レコードの属性取得・集計 | JOIN + カスタム SELECT |
| CRUD 前後の副作用（監査ログ、ファイル削除等） | `wrappers/` で追加 |
| 複数テーブルのトランザクション制御 | `db.transaction` でラッパー作成 |
| Firestore: or 条件、複数列ソート、belongsToMany | Drizzle へ移行 |

---

## DB 別の主要差異

| 機能 | Drizzle | Firestore |
|------|---------|-----------|
| belongsToMany / relationWhere | 対応 | 非対応 |
| or 条件 / 複数列ソート | 対応 | 非対応 |
| ページネーション | LIMIT/OFFSET + COUNT(*) | 疑似実装 |
| extraWhere | 対応 | 非対応 |

多対多・複雑検索が必要なら Drizzle を選択する。詳細: `docs/core-specs/DB種別の違いによる機能の差異.md`

---

## 並び替え（Fractional Indexing）

- `domain.json` で `sortOrderField` を有効化 → `reorder` / `searchForSorting` が利用可能
- 並び替え画面では `search` ではなく `searchForSorting` を使用（NULL の sort_order を自動初期化）
- 新規レコードはリストの先頭に自動配置
- デモ: `src/app/(user)/demo/sortable-list/`

---

## よくある失敗

- 中間テーブル操作を手動で書き、`belongsToManyRelations` と二重管理になった
- `base.query` を使わずページング処理を自前実装し、total 件数の仕様が不一致になった
- 生成ファイルを直接編集し、`dc:generate` 時に衝突した
- Firestore で `or` 条件を指定して例外が発生した

---

## 参照リンク

- コアスペック詳細: `src/lib/crud/README.md`
- DB 別差異: `docs/core-specs/DB種別の違いによる機能の差異.md`
- ドメイン生成: `docs/how-to/utility/ドメインファイル自動生成に関するコマンド使用方法.md`
- フック使用方法: `docs/how-to/implementation/汎用CRUDのフック使用方法.md`
