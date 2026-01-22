# 汎用 CRUD の仕様と拡張方法について

このドキュメントは、プロジェクトにおける汎用 CRUD（createCrudService / API / Hooks 一式）の **現行仕様と拡張方法** を 1 つにまとめた必読資料です。  
実装担当者が不要な再実装に時間を費やさず、拡張が必要な場面を的確に判断できるようにすることが目的です。

---

## 1. 目的と適用範囲

- サーバー・クライアントにまたがる CRUD のデフォルト構成と責務を素早く把握する。
- 「標準実装で提供される機能」「未対応領域（制約）」を明確にし、拡張要否の判断を容易にする。
- domain-config の自動生成物と手動カスタマイズ部分の境界を共有し、ドメイン追加作業の再現性を高める。
- Neon（Drizzle）/ Firestore の仕様差を理解し、DB 選定・移行時の判断材料を提供する。

対象読者は、ドメインの CRUD 実装・拡張・レビューに携わるすべてのメンバーです。

---

## 2. アーキテクチャ概観

```
[React Hooks]
    ↓ useDomainList / useCreateDomain など
[クライアントサービス]  ← createApiClient で生成
    ↓ axios で API 呼び出し
[Next.js API ルート /api/[domain]]
    ↓ registry 経由でドメインサービスを呼び出し
[サーバーサービス]
    ↓ createCrudService (Drizzle or Firestore)
[データベース]
```

- UI からの操作は「Hook → クライアントサービス → API ルート → サーバーサービス → DB」の順で流れます。
- domain-config で生成されるファイル群（entities / services / hooks など）は、このフローを前提としています。
- ベースサービス (`createCrudService`) は CRUD 全操作を提供し、必要に応じて `services/server/wrappers/` で差分処理を挟みます。

---

## 3. 標準実装で提供される機能（できること）

### サーバーサービス（Drizzle / Firestore 共通）
- `create / list / get / update / remove / search / query / bulkDeleteByIds / bulkDeleteByQuery / upsert` を一括提供。
- `parseCreate / parseUpdate / parseUpsert` で Zod スキーマを通過させ、`omitUndefined` などの入力整形も自動化。
- `search` はページング、`searchQuery` + `searchFields`、`orderBy`、`where` を単一のインターフェースで扱える。
- `query` を使うと、自由な SELECT 文（JOIN 等）に対して共通のページング・件数カウント処理だけを流用できる。

### Drizzle（Neon）固有
- `belongsToManyRelations` を指定するだけで、中間テーブルの insert/delete を `create/update/upsert` で自動同期。
- `list/get/search/query` の結果には関連 ID 配列をハイドレーションして返却（UI 側でそのまま利用可能）。
- `searchPriorityFields` と `prioritizeSearchHits` で ILIKE 検索のヒット行を `CASE WHEN` 順位で持ち上げられる。
- **並び替え機能**: `sortOrderColumn` を設定すると `reorder` / `searchForSorting` が利用可能。Fractional Indexing による効率的な並び替えを提供。

### クライアント層
- `services/client/<domain>Client.ts` は `createApiClient` で REST API をラップし、`normalizeHttpError` を通した例外を返す。
- `lib/crud/hooks` の汎用 Hook（`useDomainList` など）へクライアントサービスを渡すだけで SWR ベースのデータ取得を再利用できる。
- `registerCrudEventHandler` で成功 / 失敗イベントを横断的に監視でき、`setApiErrorHandler` で axios 例外を一元処理できる。

---

## 4. 未対応領域と制約（できないこと）

| 分類 | 制約内容 | 典型例 | 対応策 |
| --- | --- | --- | --- |
| `buildWhere` | ベーステーブル以外のカラムは参照不可。中間テーブル列・JOIN 先で絞り込みできない。 | タグ ID で検索したい | `base.query()` で JOIN し、`where` は手動記述する |
| belongsToMany | ID 配列の同期/ハイドレーションのみ。関連レコードの属性取得・集計は行わない。 | タグ名で sort したい | JOIN + カスタム SELECT を実装 |
| Firestore search | `where.or`、複数列 orderBy、`searchPriorityFields` 未対応。前方一致は `searchFields` 先頭のみ。 | タイトル or 説明で検索 | UI 側で絞り込み、または Drizzle へ移行 |
| 副作用 | 監査ログ、外部 API 連携、ファイル削除などは自動化されない。 | 画像削除と同期 | `wrappers/` で `base.remove` 前後に処理を追加 |
| トランザクション | Drizzle 版でも、基盤が提供するのは単一テーブル + belongsToMany 同期のみ。複数テーブルの更新順制御は無い。 | 在庫テーブルと履歴テーブルを同時更新 | `db.transaction` を使うラッパーを作成 |

> Firestore 版は上記に加え、「多対多の自動同期がそもそも無い」「ページングが `page * limit` の疑似実装」の制約があります。

---

## 5. DB 別仕様差分（抜粋）

| 機能 | Drizzle (Neon) | Firestore |
| --- | --- | --- |
| ページング | SQL の `LIMIT/OFFSET`。`total` は COUNT(*)。 | `page * limit` 件取得 → `slice`。`total` は取得件数。 |
| ソート | 任意列・複数列 OK。 | 先頭 1 列のみ。 |
| 検索 (`searchQuery`) | 全フィールド OR 連結の `ILIKE`。優先度調整可。 | `searchFields` 先頭カラムの前方一致のみ。 |
| `where` | `and` / `or` ネスト、`like`、比較演算。 | `and` のみ。`or` は例外。 |
| belongsToMany | 自動同期 + ID 配列ハイドレーションあり。 | 非対応（domain-config でも選択不可）。 |

詳細は `docs/core-specs/DB種別の違いによる機能の差異.md` を参照してください。ドメインの要件を満たせない場合は Drizzle への移行、もしくは Firestore の個別実装（インデックス管理含む）を検討します。

---

## 6. 拡張方法カタログ

| ケース | 推奨アプローチ | 参考ファイル |
| --- | --- | --- |
| 複数テーブル JOIN + ページング | `base.query(customSelect, options)` で SQL を自前実装しつつページングだけ流用。 | `src/lib/crud/drizzle/service.ts` (`query`) |
| CRUD 前後に副作用を入れたい | `services/server/wrappers/` に `createWithNotification` などを定義し、`base.create` を呼ぶ前後で処理を追加。 | 各ドメインの `wrappers` |
| belongsToMany 以外の関連同期 | `db.transaction` を使ったカスタム実装を `wrappers` に記述し、`base` の `update` 等と差し替える。 | `createCrudService` の `update` 実装を参考にする |
| Firestore で条件を増やしたい | 必要な複合インデックスを `firestore.indexes.json` に追加し、SDK の `Filter` 等を直接利用。 | `docs/core-specs/DB種別の違いによる機能の差異.md` |
| API レスポンスの形を変えたい | API ルートでカスタムレスポンスを組む場合でも、サービス層の戻り値型を基準にする。必要なら `services/server/<domain>/` 配下に専用メソッドファイルを作成し、`<domain>Service.ts` から読み込む。 | `src/app/api/[domain]/route.ts` |

判断基準: **まず `base` に欲しい機能が無いか確認 → 無ければ `query/wrappers` → さらに無理なら個別サービス** の順に検討します。

---

## 6-2. サーバーサービスの実装ルール（重要）

- `src/features/<domain>/services/server/<domain>Service.ts` には直接実装を追加せず、単体のサービスメソッドファイルを作成して読み込む。
- 既存 CRUD メソッドの上書きは必ず `services/server/<domain>/wrappers/` に配置する。
- ドメイン独自で汎用ではないサービスが必要な場合は `wrappers` ではなく適切なフォルダへ分割する（必要に応じて `services/server/<domain>/` 直下でも可）。
- `wrappers` 以外のサブフォルダ構成はドメインごとに自由なので、用途が伝わる整理を行う。

---

## 6-3. 並び替え機能（Fractional Indexing）の使い方

ドラッグ＆ドロップによる並び替えを実現するため、Fractional Indexing を採用しています。レコードの並び順を文字列で管理し、2 つのレコード間に無限に新しい順序値を挿入できます。

### 有効化方法

1. `domain.json` で `sortOrderField` を設定（domain-config で生成時に指定）
2. drizzle.ts に `sort_order` カラムが追加される
3. `drizzleBase.ts` に `sortOrderColumn` が設定され、`reorder` / `searchForSorting` / `initializeSortOrder` が利用可能になる

### サーバー側での使用（ページコンポーネント）

並び替え画面では `search` ではなく `searchForSorting` を使用します。`searchForSorting` は検索結果に `sort_order` が NULL のレコードがあれば自動的に初期化してから返却するため、途中から並び替えを有効化したドメインでも安全に使用できます。

```typescript
// page.tsx
const { results } = await domainService.searchForSorting({
  page: 1,
  limit: 20,
  orderBy: [["sort_order", "ASC", "LAST"]], // LAST: NULLは最後に表示
});
```

`orderBy` の第 3 要素に `"FIRST"` または `"LAST"` を指定すると、NULL 値の表示位置を制御できます（PostgreSQL の `NULLS FIRST` / `NULLS LAST` に対応）。
- `searchForSorting` は `sort_order` が未設定の行を **defaultOrderBy（未指定時は `createdAt DESC`）の順で初期化** したうえで結果を返します。初回だけ副作用を伴うため API ルートは `POST /api/[domain]/search-for-sorting`（operationType: `write`）に分離されています。
- デモ: `src/app/(user)/demo/sortable-list`。`searchForSorting` で初期化した結果を `SortableList` に渡し、並び替え後は `reorder` を叩く実装例です。

### クライアント側での使用（SortableList）

`SortableList` コンポーネントと `reorder` API を組み合わせて使用します。

```typescript
// _components/DomainSortableList.tsx
const handleReorder = async (result: ReorderResult) => {
  // 楽観的更新: UIを即座に更新
  const previousItems = items;
  setItems((prev) => {
    const newItems = [...prev];
    const [movedItem] = newItems.splice(result.oldIndex, 1);
    newItems.splice(result.newIndex, 0, movedItem);
    return newItems;
  });

  // サーバーに並び替えを送信
  try {
    await domainClient.reorder?.(result.itemId, result.afterItemId);
  } catch (err) {
    // エラー時は元の状態に戻す
    setItems(previousItems);
  }
};
```

### 新規レコードの sort_order

新規レコード作成時は自動的に `sort_order` が設定され、**リストの先頭**に配置されます。

### 参考実装

デモ画面: `src/app/(user)/demo/sortable-list/`

---

## 7. domain-config との連携ポイント

- `domain.json` が単一のソースとなり、`entities/schema.ts` `entities/drizzle.ts` `services/server/drizzleBase.ts` などが再生成されます。
- 多対多を選択すると `belongsToManyRelations` の設定、中間テーブル import、フォームの `relation` フィールドなどが自動で挿入されます。
- `constants/` / `types/` / `components/common` のフォーム実装まで含めて雛形を作るため、手動で同様のファイルを増やす必要はありません。
- 設定変更後に再生成する際は、テンプレート未対応のロジック（手動で追加したコード）が上書きされないよう to-do を残し、差分を確認してからマージしてください。

---

## 8. 実装判断チェックリスト & よくある失敗

1. **同じ機能がベースに無いか？**  
   - 例: belongsToMany の中間テーブル操作を手動で書いていないか。
2. **where / search でやりたいことはベースで表現できるか？**  
   - 例: `or` が必要 → Drizzle 版なら可、Firestore 版なら不可。
3. **DB の選定は要件を満たしているか？**  
   - 多対多、複雑検索が必要なら Drizzle を必須とする。
4. **拡張箇所は `wrappers` で局所化されているか？**  
   - 直接 `src/lib/crud` を改造していないか確認。
5. **API/Hook/フォームの責務を混同していないか？**  
   - Hook で axios を直接呼ぶ、フォームで `fetch` を使う等は禁止。
6. **サーバーサービスの配置ルールを守れているか？**  
   - `xxxService.ts` に直接ロジックを追加していないか、CRUD 上書きが `wrappers` にあるか確認。

**よくある失敗例**
- 中間テーブル操作を複製し、`belongsToManyRelations` と二重管理になった。
- Firestore なのに `or` 条件を指定して例外が発生した。
- `base.query` を使わずにページング処理をゼロから書き、total 件数の仕様が不一致になった。
- domain-config で生成されるファイルを手動で編集し、再生成時に差分が衝突した。

---

## 9. FAQ と参照リンク

| 質問 | 回答 |
| --- | --- |
| **タグ配列でフィルタしたい** | Drizzle なら `base.query` で中間テーブルを JOIN し、`where` を手動で書く。Firestore では対応不可。 |
| **Firestore で多対多を使いたい** | 現行の汎用 CRUD では非対応。個別実装でコレクションやサブコレクションを設計するか、Drizzle へ移行する。 |
| **検索順位を調整したい** | Drizzle 版の `searchPriorityFields` / `prioritizeSearchHits` を利用。Firestore 版では UI 側で制御。 |
| **API レスポンスに追加情報を含めたい** | サービス層で必要なデータを返却するメソッドを追加し、API ルートでシリアライズする。共通 CRUD の戻り値型を崩さない。 |
| **ドラッグ＆ドロップで並び替えしたい** | `domain.json` で `sortOrderField` を有効化し、`searchForSorting` + `SortableList` + `reorder` API を組み合わせる。詳細は 6-3 節を参照。 |
| **既存ドメインに並び替えを追加したい** | `sortOrderField` を有効化して再生成後、`sort_order` カラムを DB に追加。既存レコードは `searchForSorting` が自動初期化するため、手動でのデータ移行は不要。 |

**追加ドキュメント**
- `docs/core-specs/DB種別の違いによる機能の差異.md`
- `docs/how-to/utility/ドメインファイル自動生成に関するコマンド使用方法.md`
- `docs/how-to/implementation/汎用CRUDのフック使用方法.md`

---

このドキュメントを起点に、拡張方針や懸念点をチームで共有し、仕様の再実装や認識齟齬を未然に防いでください。迷った場合は既存ドメインの `services/server/`・`wrappers/` を参照し、必ずコード例とあわせて確認しましょう。
