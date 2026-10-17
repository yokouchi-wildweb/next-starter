# admin loaders — dc:generate が生成する管理画面の共有 loader

`dc:generate` が出す管理画面ルート（`src/app/admin/(protected)/<domains>/{,new/,[id]/edit/,sort/}`）は
page.tsx 1 行スイッチ + `_screen/Admin<Domain>{List,Create,Edit,Sort}Screen.tsx` の構造で生成されます（`src/lib/screens/README.md` §12）。
生成された `_screen/` はドメインごとの loader を持たず、ここにある **共有 loader** を service を渡して呼びます。
ドメインごとに loader を生成しない理由: ドメイン数 × 3 の生成物が増え、各ドメインの `loaders/README.md` 一覧と衝突するため。

## 一覧（公開契約）

| loader | 使う画面 | 引数 | 返り値 | redirect / notFound |
|---|---|---|---|---|
| `loadAdminListScreen(service, props)` | 一覧 | `service.search`、`props.searchParams`（`page` / `searchQuery`） | `{ page, limit, searchQuery, results, total }`（`limit` = 設定 adminListPerPage） | なし |
| `loadAdminEditScreen(service, props, fallbackPath)` | 編集 | `service.get`、`props.params.id`、`props.searchParams.returnTo` | `{ id, record, redirectPath }` | レコード無し → 404 |
| `loadAdminSortScreen(service, sortOrderColumn?)` | 並び替え | `service.searchForSorting` | `{ results }`（sort_order 昇順、NULL 末尾、先頭 100 件） | なし |
| `loadAdminRelationLists({ key: service, ... })` | 追加・編集（関連あり） | 各 `service.list` | `{ key: 配列, ... }`（`SWRConfig` の fallback 用） | なし |

`service` の型は構造的（`search` / `get` / `searchForSorting` / `list` を持てばよい）。`createCrudService` の service をそのまま渡せる。

## wallet の loader との違い

- **認可を行わない。** `admin/(protected)/layout.tsx` の `authGuard` が管理者ロールを検査済みなので、`requireCurrentUser` を重ねない（従来の page.tsx と同じ挙動）
- ドメイン横断で共有するため `load<Name>Screen` の `<Name>` は画面種別（List / Edit / Sort）。ドメイン固有の判定が必要になったら、そのドメインの `services/server/loaders/` に専用 loader を作り、`_screen/` を `_components/` に複製してそちらを呼ぶ（生成物は触らない）

## 規則

- `import "server-only"` / React `cache()`（キーは service の同一性 + プリミティブ）/ `redirect` と `notFound` は loader の責務 / Screen は try/catch しない
- 編集でレコードが無いときの `notFound()` は従来の page.tsx（`as Type` で null をそのまま渡していた）からの変更。意図的な改善

## 生成コードからの呼び方（抜粋）

```tsx
// 一覧
const { results: samples, page, limit, total } = await loadAdminListScreen(sampleService, props);
// 編集(関連あり)
const [{ record: sample, redirectPath }, { sampleCategories, sampleTags }] = await Promise.all([
  loadAdminEditScreen(sampleService, props, "/admin/samples"),
  loadAdminRelationLists({ sampleCategories: sampleCategoryService, sampleTags: sampleTagService }),
]);
// 並び替え
const { results: samples } = await loadAdminSortScreen(sampleService);
```
