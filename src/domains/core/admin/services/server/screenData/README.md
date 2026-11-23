# admin screenData — 管理画面の取得本体

## Overview

- `pnpm generate domain` が出す管理画面ルート（`src/app/admin/(protected)/<domains>/{,new/,[id]/edit/,sort/}`）と、同じ形の手書きの core 管理画面が共有する取得の本体
- 認可と cache は持たない。各ルートの `_screen/loader.ts` が最寄りの guard.ts の `createLoader` に、`src/domains/core/admin/services/server/screenParts.ts` の共通部品の組を渡して使う
- service と関連先は外から受け取り、登録表（serviceRegistry）は読まない（結ぶのは wiring）
- 決まり（cache・認可を持たない、関連の判定の置き場）は札 `.claude/rules/items/domains/admin.md`

```
_screen/<Name>Screen.tsx ──▶ _screen/loader.ts = createLoader(adminXParts("sample", …))
                                 │  createLoader(admin/(protected)/guard.ts): 範囲の方針 + 組の access を取得前に評価、key で cache
                                 ▼
                            src/domains/core/admin/services/server/screenParts.ts の adminXParts: access(serviceRegistry の entry から操作ごと)・key・load
                                 ▼
                            screenData/adminX.ts: fetchAdminX(service, …)
```

## Usage

ルートの loader.ts（生成物・手書きとも同じ 1 行）:

```ts
import "server-only";

import type { Sample } from "@/domains/sample/entities/model";
import domainConfig from "@/domains/sample/domain.json"; // 全件取得する関連があるときだけ
import { createLoader } from "@/app/admin/(protected)/guard";
import { adminEditParts } from "@/domains/core/admin/services/server/screenParts";

export const loadAdminSampleEditScreen = createLoader(
  adminEditParts<Sample>("sample", { fallbackPath: "/admin/samples", relations: domainConfig }),
);
```

- 一覧の固定の検索条件は `options` で渡す。例: `adminListParts<Coupon>("coupon", { where: { field: "type", op: "eq", value: "official" } })`
- `extraWhere` 等の SQL が要る一覧は、そのルートの `_components/loader.ts` に同じ guard.ts の `createLoader` で専用の取得を書く
- 生成された管理画面を変えたい fork: `_screen/` の Screen と loader.ts を `_components/` にコピーし、page.tsx を向ける（`src/lib/screens/README.md` の Usage「上流の画面を変えたい」）

## API

共通部品の組（`src/domains/core/admin/services/server/screenParts.ts`。access は serviceRegistry の entry から resolveAccessRule）:

- `adminListParts<T>(domainKey, options?)`: 一覧。access `search`（read）。key `?page=`・`?searchQuery=`。返り値 `{ page, limit, searchQuery, results, total }`（`limit` = 設定 adminListPerPage）
- `adminEditParts<T>(domainKey, { fallbackPath, relations? })`: 編集。access `get`（read）。key `id`・`?returnTo=`。返り値 `{ id, record, redirectPath, relationFallback }`。レコード無し → 404
- `adminCreateParts(domainKey, { relations? })`: 追加。access `create`（write）。key なし。返り値 `{ relationFallback }`
- `adminSortParts<T>(domainKey, sortOrderColumn?)`: 並び替え。access `searchForSorting`（read）。key なし。返り値 `{ results }`（sortOrderColumn 昇順、NULL 末尾、先頭 100 件）

- `domainKey` は serviceRegistry のキー（camelCase）
- `options`（一覧の固定の検索条件）= `withRelations` / `hasManyLimit` / `orderBy` / `where` / `relationWhere`

取得本体（このフォルダ）:

- `fetchAdminList(service, page, searchQuery, options?)`: 設定の 1 ページ件数で `service.search`
- `fetchAdminEdit(service, id, returnTo, fallbackPath)`: `service.get`、無ければ `notFound()`、戻り先は `sanitizeRedirectPath`(`@/lib/url`)
- `fetchAdminSort(service, sortOrderColumn)`: `service.searchForSorting`
- `fetchAdminRelationOptions(domainConfig, { resolveTarget, allows })`: フォームの関連選択肢を SWRConfig の fallback の形で返す(`allows` は loader の文脈の非同期の `allows` をそのまま渡す)
- `service` の型は構造的（`search` / `get` / `searchForSorting` を持てばよい）
- どのファイルも `import "server-only"`

## Internals

access:

- 汎用 API（`createDomainRoute`）と同じ解き方。宣言の無い操作は fail-closed の既定（管理者カテゴリ）
- 範囲 `admin/(protected)` の方針（管理者カテゴリ）と AND で評価され、拒否なら取得しない
- `domainKey` が未登録なら loader.ts の読み込み時に throw、service が操作を持たなければ取得時に throw（配線のミスを黙って通さない）

関連選択肢（`fetchAdminRelationOptions`）:

- どの関連を読むか = `src/lib/domain/relations/relationOptions.mjs` の `getStaticRelations`（belongsTo と表側の belongsToMany のうち `asyncCombobox` / `asyncMultiSelect` / `custom` 以外）。クライアントの `useRelationOptions` と生成器が同じ判定を使う
- どのキーで渡すか = 同じ helper の `relationOptionsKey`。`useRelationOptions` が同じキーで `useSWR` するので、SSR の結果が初回描画の選択肢になる
- 関連先ごとの access = 関連先の serviceRegistry の `list`（read）を、取得の前に loader の文脈の `await allows(rule)`(非同期)で評価する。拒否された関連先は取得せず空配列（その関連の選択肢だけ空。画面は出る）
- 拒否で飛ばしたとき、開発環境（段階が development、`@/lib/appEnv`）だけサーバーログに 1 行（関連先のドメイン名だけ。利用者・取得データは出さない。ルートの地図 `src/app/route-map.jsonl`・lint には出さない）
- 関連先の service は wiring が serviceRegistry から遅延読み込みで引く（クライアントが叩く `GET /api/<domain>` と同じ解決経路）

## Verification

- テスト: `pnpm test src/domains/core/admin/services/server/screenParts.test.mts`（組の access・key、関連選択肢の拒否・ログ）
