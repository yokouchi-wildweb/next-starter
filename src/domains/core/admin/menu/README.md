# 管理メニュー（src/domains/core/admin/menu）

## Overview

- 管理画面のサイドバーのメニューを、カテゴリーのファイル（点 `adminMenuCategories`、見出し 1 つ）と項目のファイル（点 `adminMenuItems`、項目 1 つ）から組み立てる仕組み。どちらも差す側のドメインの `<ドメイン>/plugs/adminMenuCategories/<名前>.ts`・`<ドメイン>/plugs/adminMenuItems/<名前>.ts`（その画面の概念のドメイン。例 クーポンの行は `src/domains/core/coupon/plugs/adminMenuItems/coupons.ts`）に置き、項目のドメインが閉じれば出ない（`useGate().plugs`）
- 上流の物も fork の物も同じ受け口に置き、同じ一覧に並ぶ
- 枠の部品（ホーム・サイトへのリンク・ログアウト）はメニューではなく管理の枠の側が持つ
- 受け口の宣言は `../extensionPoints.ts`（`menuCategories` / `menuItems`）。一覧は `pnpm generate extensions` が `../extensions/` に出す
- 組み立て器 `buildAdminMenu.ts`（純関数）。サイドバーと `pnpm check admin-menu -- show` が同じ物を呼ぶ
- 決まり（名前・並び・ロールの絞り・データ管理から外す方法）は札 `.claude/rules/items/domains/admin.md`

## Usage

- カテゴリー: `export const category: AdminMenuCategoryDefinition`
- 項目: `export const item: AdminMenuItemDefinition`。形は下の API の 3 形から選ぶ
- 並び: 整数の `order` の昇順、同じ値は名前の順。上流のカテゴリーは marketing 100・requests 200・data 300・users 400・community 500・system 900、項目はカテゴリーの中で 10 刻み

## API

項目の 3 形:

- link: `label` + `href`（1 行）
- domain: `domain: "<ドメインのフォルダ名>"`（`label` で題名だけ差し替え可。1 行）。題名と住所は生成の一覧 `@/registry/adminDomains`（管理一覧の画面を持つドメイン、`pnpm generate registry`）
- source: `source: "dataMenu"` / `"settingSections"`。その位置に複数行を展開する。行の中身は出どころで編集する: `dataMenu` = 登録の `entities/<登録名>/entity.json` が `addToAdminDataMenu: true` のドメイン、`settingSections` = 設定の節（点 `settingSections`、`<ドメイン>/plugs/settingSections/`）

- どの形も `category`（カテゴリーの名前）・`order`・`icon`・`allowRoles` を持つ
- 生成の出力（dataMenu・settingSections・domain）はどれも 1 項目なので、どのカテゴリーのどの位置にも置ける
- 型（定義・上書き・組み立て器の入出力）は `types.ts`

## Extension

- 足す: 自分のカテゴリー・項目のファイルを受け口に置いて `pnpm generate extensions`（受け口の外の `src/domains/core/` に足すと `pnpm workflow ownership check` が落ちる）
- 上流の物を変える・隠す: その隣に `<名前>.override.ts`（`export const override = { … }`）。カテゴリー = `hidden`・`label`・`icon`・`allowRoles`・`order`、項目 = それに `category` を足したもの。相手の無い上書き・挙げていない属性は `pnpm check extensions` が落とす
- ドメインをデータ管理に出さない: その登録の `entities/<登録名>/entity.json` の `addToAdminDataMenu: false`
- 上流は override を出荷しない（`scripts/structure/extensions/README.md`）

## Internals

- 見え方は門番（`src/featureGate`）で決める: 行の住所が閉じた規則に当たれば隠す（厳密: `redirectTo` 付きの閉も隠す）。行が 0 のカテゴリーは描かない
- `allowRoles` はカテゴリーにも項目にも（展開した行は出どころのロールも）書け、全部 AND
- 見え方は認可ではない。画面と API の守りは範囲の `guard.ts`・loader の `access`・API の Factory が持つ
- 重複（同じ出どころを 2 項目が展開・同じ住所の行が 2 つ）は止めない。組み立て器が `duplicates` に返し、`pnpm check admin-menu -- show` が表示する

## Verification

道具は `scripts/structure/admin-menu/`（検査の関段階 build・ship = pnpm build / /sluice の時に走る検査に乗る）:

- `pnpm check admin-menu -- show`: ロールごとにカテゴリーと行の木を出す。行ごとに当たる門番の規則（今の開閉）か `常時`、重複、描かない物と理由。`--role=<ロール>` で 1 ロール、`--closed=now`（既定・今の開閉）/ `all`（全部閉じた）/ `none`（全部開いた）。fork の取り込みの前後比較にも使う
- `pnpm check admin-menu`: 置き間違いを止める（段階 build・ship、`extensions` の後。`phase.json`）。止める物: 知らないカテゴリー（上書きで移した先も）・管理一覧に無いドメイン・相手の無い上書き・上流より `allowRoles` を広げる上書き（空も広げる扱い）・`/admin` の住所でページが `src/app/route-map.jsonl` に無いもの（動的セグメントも照らす）・`key` とファイル名の食い違い。管理ダッシュボードの点（`<ドメイン>/plugs/adminDashboardSections/`）も同じ段階で見る
- 中身は純関数 `scripts/structure/admin-menu/inspect.ts`、読むのは `collect.ts`（受け口は生成の一覧でなく素のファイルを読む: 上書きの前の上流の値と比べるため）
- テスト: `pnpm test src/domains/core/admin scripts/structure/admin-menu`（組み立て器・上流の中身・サイドバーの中身・点検）

## Related

- 管理ダッシュボードの受け口: `../dashboard/README.md`
