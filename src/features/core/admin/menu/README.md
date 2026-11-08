# 管理メニュー（src/features/core/admin/menu）

管理画面のサイドバーのメニューを、**カテゴリーのファイル**と**項目のファイル**の 2 つの受け口から組み立てる仕組み。上流の物も fork の物も同じ受け口に置き、同じ一覧に並ぶ。枠の部品（ホーム・サイトへのリンク・ログアウト）はメニューではなく管理の枠の側が持つ。

| 置き場 | 中身 |
|---|---|
| `categories/<名前>.ts` | `export const category: AdminMenuCategoryDefinition`（見出し 1 つ） |
| `items/<名前>.ts` | `export const item: AdminMenuItemDefinition`（項目 1 つ。3 形は下） |
| `../extensionPoints.ts` | 宣言（`menuCategories` / `menuItems`）。一覧は `pnpm generate extensions` が `../extensions/` に出す |
| `types.ts` | 定義・上書き・組み立て器の入出力の型 |
| `buildAdminMenu.ts` | 組み立て器（純関数。サイドバーと `pnpm check admin-menu -- show` が同じ物を呼ぶ） |

名前（ファイル名）は英字始まりの英数字（camelCase）で、定義の `key` と同じにする。上書きの対象もこの名前。

## 項目の 3 形

| 形 | 書くもの | 行 |
|---|---|---|
| link | `label` + `href` | 1 行 |
| domain | `domain: "<ドメインのフォルダ名>"`（`label` で題名だけ差し替え可） | 1 行。題名と住所は生成の一覧 `@/registry/adminDomains`（管理一覧の画面を持つドメイン、`pnpm generate registry`） |
| source | `source: "dataMenu"` / `"settingSections"` | その位置に複数行を展開。行の中身は出どころで編集する: `dataMenu` = `domain.json` の `addToAdminDataMenu: true` のドメイン、`settingSections` = 設定の節（`src/features/core/setting/sections/`） |

どの形も `category`（カテゴリーの名前）・`order`・`icon`・`allowRoles` を持つ。生成の出力（dataMenu・settingSections・domain）はどれも 1 項目なので、どのカテゴリーのどの位置にも置ける。

## 並び・見え方・ロール

- 並び: 整数の `order` の昇順、同じ値は名前の順。上流のカテゴリーは 100 刻み（marketing 100・requests 200・data 300・users 400・community 500・system 900）、項目はカテゴリーの中で 10 刻み。fork はその間に入れる
- 見え方は門番（`src/featureGate`）だけで決める: 行の住所が閉じた規則に当たれば隠す（厳密: `redirectTo` 付きの閉も隠す）。メニュー専用のスイッチや `feature:` は持たない。行が 0 のカテゴリーは描かない
- `allowRoles` はカテゴリーにも項目にも（展開した行は出どころのロールも）書け、全部 AND。上流の既定の絞りは項目にだけ書き、上流のカテゴリーには付けない
- 見え方は認可ではない。画面と API の守りは範囲の `guard.ts`・loader の `access`・API の Factory が持つ
- 重複（同じ出どころを 2 項目が展開・同じ住所の行が 2 つ）は止めない。組み立て器が `duplicates` に返し、`pnpm check admin-menu -- show` が表示する

## fork がすること

- 足す: 自分のカテゴリー・項目のファイルを受け口に置いて `pnpm generate extensions`（受け口の外の `src/features/core/` に足すと `pnpm workflow ownership check` が落ちる）
- 上流の物を変える・隠す: その隣に `<名前>.override.ts`（`export const override = { … }`）。カテゴリー = `hidden`・`label`・`icon`・`allowRoles`・`order`、項目 = それに `category` を足したもの。相手の無い上書き・挙げていない属性は `pnpm check extensions` が落とす。`allowRoles` は絞るだけ（広げない）
- ドメインをデータ管理に出さない: その `domain.json` の `addToAdminDataMenu: false`（行は出どころで消す。メニュー側で行を消さない）
- 上流は override を出荷しない（`scripts/structure/extensions/README.md`）

## 道具（`scripts/structure/admin-menu/`、門 build・ship に乗る）

| コマンド | すること |
|---|---|
| `pnpm check admin-menu -- show` | ロールごとにカテゴリーと行の木を出す。行ごとに当たる門番の規則（今の開閉）か `常時`、重複、描かない物と理由。`--role=<ロール>` で 1 ロール、`--closed=now`（既定・今の開閉）/ `all`（全部閉じた）/ `none`（全部開いた）。fork の取り込みの前後比較にも使う |
| `pnpm check admin-menu` | 置き間違いを止める（門 build・ship、`extensions` の後。`gate.json`）: 知らないカテゴリー（上書きで移した先も）・管理一覧に無いドメイン・相手の無い上書き・上流より `allowRoles` を広げる上書き（空も広げる扱い）・`/admin` の住所でページが `src/app/route-map.jsonl` に無いもの（動的セグメントも照らす）・`key` とファイル名の食い違い |

テスト: `pnpm test src/features/core/admin scripts/structure/admin-menu`（組み立て器・上流の中身・サイドバーの中身・点検）。中身は純関数 `scripts/structure/admin-menu/inspect.ts`、読むのは `collect.ts`（受け口は生成の一覧でなく素のファイルを読む: 上書きの前の上流の値と比べるため）
