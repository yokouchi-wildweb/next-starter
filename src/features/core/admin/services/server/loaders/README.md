# admin loaders — dc:generate が生成する管理画面の共有 loader

`dc:generate` が出す管理画面ルート（`src/app/admin/(protected)/<domains>/{,new/,[id]/edit/,sort/}`）は
page.tsx 1 行スイッチ + `_screen/Admin<Domain>{List,Create,Edit,Sort}Screen.tsx` の構造で生成されます（`src/lib/screens/README.md` §12）。
生成された `_screen/` はルートごとの `loader.ts` を持たず、ここにある **共有 loader** を service を渡して呼びます。
ルートごとに loader を生成しない理由: ドメイン数 × 3 の生成物が増えるだけで中身が同じになるため。
ユーザー向けページの loader は各ルートの `_screen/loader.ts` に置くのが規則（`src/lib/screens/README.md` §4）で、
`features/` に loader を置くのは、このように多数のルートが丸ごと同じ処理を使う場合だけです。

## 一覧（公開契約）

| loader | 使う画面 | 引数 | 返り値 | redirect / notFound |
|---|---|---|---|---|
| `loadAdminListScreen(service, props, options?)` | 一覧 | `service.search`、`props.searchParams`（`page` / `searchQuery`）、`options`（後述） | `{ page, limit, searchQuery, results, total }`（`limit` = 設定 adminListPerPage） | なし |
| `loadAdminEditScreen(service, props, fallbackPath)` | 編集 | `service.get`、`props.params.id`、`props.searchParams.returnTo` | `{ id, record, redirectPath }` | レコード無し → 404 |
| `loadAdminSortScreen(service, sortOrderColumn?)` | 並び替え | `service.searchForSorting` | `{ results }`（sort_order 昇順、NULL 末尾、先頭 100 件） | なし |
| `loadAdminRelationOptions(domainConfig)` | 追加・編集（全件取得する関連があるとき） | domain.json（`relations` を読む） | `{ [SWR キー]: { [関連先ドメイン]: 全件配列 } }`（`SWRConfig` の fallback にそのまま渡す。対象が無ければ `{}`） | なし |
| `loadAdminRelationLists({ key: service, ... })` | **非推奨**（旧。fallback のキーがフォームと一致せず使われていなかった） | — | — | checkpoint admin-relation-options-prefetch の次で削除 |

`service` の型は構造的（`search` / `get` / `searchForSorting` を持てばよい）。`createCrudService` の service をそのまま渡せる。

### `loadAdminListScreen` の `options`

一覧に関連を結合したい・並び順や絞り込みを足したいときは第 3 引数で渡す（差し替えた `_components/<X>Screen.tsx` から）。
型は `AdminListSearchOptions` = `withRelations` / `hasManyLimit` / `orderBy` / `where` / `relationWhere`。

```tsx
const { results, page, limit, total } = await loadAdminListScreen(directSaleService, props, { withRelations: 2 });
```

JSON にできるものだけを受けるのは、`cache()` のキーに `JSON.stringify(options)` を使うため。`extraWhere`（Drizzle の SQL オブジェクト）は
渡せない。それが要る一覧は、そのルートの `_components/loader.ts` に専用 loader を書き、`_screen/` を `_components/` に複製してそちらを呼ぶ。
`{ search: (p) => service.search({ ...p, withRelations: 2 }) }` のようなラッパー service を渡す方法は、構造的型付けで動くが公式の手段ではない（`options` を使う）。

### `loadAdminRelationOptions` の仕組み

- **どの関連を読むか** = `src/lib/domain/relations/relationOptions.mjs` の `getStaticRelations`（belongsTo と表側の belongsToMany のうち、`asyncCombobox` / `asyncMultiSelect` / `custom` 以外）。クライアントの `useRelationOptions` と同じ判定なので、フォームが取りに行く関連だけを先読みする。`async`（入力側が自分で検索する）、`custom`（UI を自作する）、`includeRelationTable: false` の belongsToMany（逆側、フォームに出ない）、hasMany / hasOne は読まない
- **どのキーで渡すか** = 同じ helper の `relationOptionsKey`（`relationOptions:<domain,…>`）。`useRelationOptions` が同じキーで `useSWR` するので、SSR の結果が初回描画の選択肢になる（スケルトンを出さない）。クライアントはマウント時に 1 回再検証する（鮮度のため。別タブで足した選択肢が出ないままにならない）
- **service の解決** = `serviceRegistry[toCamelCase(domain)].service.list()`。クライアントが叩く `GET /api/<domain>` と同じ解決経路。registry に無いドメインや `list()` を持たない service は例外（設定ミスを黙って通さない）
- `cache()` のキーは SWR キー文字列。同一リクエスト内で同じ関連集合なら 1 回だけ読む
- 生成器（`scripts/domain-config/generator/admin-routes/helpers.mjs`）も同じ helper で「先読みする関連があるか」を判定し、無ければ `SWRConfig` も loader 呼び出しも出さない

## ユーザー向けページの loader（`_screen/loader.ts`）との違い

- **認可を行わない。** `admin/(protected)/layout.tsx` の `authGuard` が管理者ロールを検査済みなので、`requireCurrentUser` を重ねない（従来の page.tsx と同じ挙動）
- ドメイン横断で共有するため `load<Name>Screen` の `<Name>` は画面種別（List / Edit / Sort）。ドメイン固有の判定が必要になったら、そのルートの `_components/loader.ts` に専用 loader を書き、`_screen/` を `_components/` に複製してそちらを呼ぶ（生成物は触らない）

## 規則

- `import "server-only"` / React `cache()`（キーは service の同一性 + プリミティブ）/ `redirect` と `notFound` は loader の責務 / Screen は try/catch しない
- 編集でレコードが無いときの `notFound()` は従来の page.tsx（`as Type` で null をそのまま渡していた）からの変更。意図的な改善
- 「どの関連を読むか」「SWR キー」の判定をここや生成器に書き足さない。`relationOptions.mjs` だけを直す（hook・loader・生成器がずれない）

## 生成コードからの呼び方（抜粋）

```tsx
// 一覧
const { results: samples, page, limit, total } = await loadAdminListScreen(sampleService, props);
// 追加(全件取得する関連あり)
const relationFallback = await loadAdminRelationOptions(domainConfig);
return <SWRConfig value={{ fallback: relationFallback }}>…</SWRConfig>;
// 編集(全件取得する関連あり)
const [{ record: sample, redirectPath }, relationFallback] = await Promise.all([
  loadAdminEditScreen(sampleService, props, "/admin/samples"),
  loadAdminRelationOptions(domainConfig),
]);
// 並び替え
const { results: samples } = await loadAdminSortScreen(sampleService);
```
