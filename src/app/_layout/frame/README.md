# 枠の宣言(frame.default.ts / frame.ts)

ルートの隣の小さな宣言ファイルで「そのルートで枠のどの部位を隠すか・本文が画面の高さを埋めるか(fill)」を書き、`pnpm extensions:generate` が親の鎖を解決した表を枠ごとに生成する。利用者の枠(`(user)` の UserLayout)と管理の枠(`admin` の AdminLayout)が、共通の読み手 `useFrameAttributes(<自分の表>)` でそれぞれの表を読み、外枠の属性 `data-frame-hide` / `data-frame-fill` にする。

原則: 隣に置く宣言・差し替え・上書きは相手を名指す(ファイル名かキー)。隣に何があるかで意味を変えない。

## 置き場(このフォルダ)

| ファイル | 中身 |
|---|---|
| `parts.mjs` | 枠の部位の一覧(唯一の元、data-slot の名前 31 名)・隠せる部位・枠の根・端末 |
| `resolve.mjs` | 宣言の形の検査・重ね(親の鎖)・表の照合 `matchFrame`(純関数。生成器と実行時の読み手が共有) |
| `types.ts` | `FrameDeclaration` / `FrameValue`(利用者の枠)・`AdminFrameDeclaration` / `AdminFrameValue`(管理の枠)・表の行の型 |
| `useFrameAttributes.ts` | 表の共通の読み手("use client" の hook)。`matchFrame(useSelectedLayoutSegments(), table)` → 外枠の属性(型 `FrameAttributes`)。client なので `index.ts` から re-export せず、このパスから直に import する |
| `index.ts` | 入口(re-export だけ) |
| `parts.test.mjs` / `resolve.test.mjs` / `useFrameAttributes.test.tsx` | `pnpm test:frame-declaration` |

生成器は `scripts/extensions/frames.mjs`(テスト `pnpm test:extensions`)。`.mjs` なのは、tsx を通さない生成器(node)からも TypeScript からも import するため。

## 名前の対

- `frame.default.ts`(`export const frameDefault`)= ルートを作ったリポの既定。上流(Tier1)が出荷するのはこれだけ。中間 Tier も自分が作ったルートに下流向けの既定を出してよい
- `frame.ts`(`export const frame`)= その下のリポ(fork・中間 Tier)の宣言。上流のルートでも自分のルートでも隣に置く。いつも既定の上に重なる(既定が無ければ空の上)
- ほかの名前(`frame.override.ts`・`frame.<何か>.ts`・`frame.tsx`)は失敗。上流(Tier1)が `frame.ts` を持つのも失敗(`extensions:check`)
- 親の物の隣に `*.default.*` を足す・親の既定を書き換える = `pnpm ownership:check` の `default-add` / `default-edit`(git の分岐点で決める。生成器は git を使わない)。fork は隣の `frame.ts` に書く
- 空(空白とコメントだけ)のファイルは不在と同じ

## 書き方

```ts
// src/app/(user)/(protected)/game/frame.default.ts(ルートを作ったリポ。下のリポは同じ形で frame.ts の export const frame)
import type { FrameDeclaration } from "@/app/_layout/frame";

export const frameDefault = {
  layout: { hide: { bottomNav: { sp: true, pc: true } } },
  page: { hide: { footer: { sp: true } }, fill: true },
} satisfies FrameDeclaration;
```

- 範囲はキーで名指す: `layout` = 隣の `layout.tsx` の下全部(ページも子のルートも)/ `page` = 隣の `page.tsx` だけ(子のルートに継がない)
  - `layout:` は隣に `layout.tsx`、`page:` は隣に `page.tsx` があるフォルダだけ。キーが 1 つも無い・知らないキーは失敗
- 各範囲の値 `{ hide?, fill? }`
  - `hide` のキー = 部位の名前から枠の接頭辞を除いた camelCase。利用者の枠 `header`・`headerNav`・`footer`・`bottomNav`、管理の枠(`src/app/admin` の下、`AdminFrameDeclaration`)`header`・`sidebar`・`footer`
  - 端末: `sp` = 40rem 未満 / `pc` = 40rem 以上。省略 = 親のまま、`false` = 親の指定の取り消し
  - `fill`: 外枠を画面の高さに合わせ、本文が残りを埋める。省略 = 親のまま
- 値はリテラルだけ(字面で読み、実行しない。変数・式・関数呼び出しは失敗)
- ページの中身(題など)は書かない(枠の部位の出し入れと fill だけ)

## 重ねる順

- 浅い段から各段の `layout`(`frame.default.ts` → `frame.ts`)、葉の段で最後に `page`(`frame.default.ts` → `frame.ts`)。部位と端末ごとに後が勝つ
- 枠の根の隣の宣言の `layout` = 枠の全体の既定(領域全体の入り切り)、`page` = トップページだけ(例 `/` の fill)
- 置けない: 枠の外(枠が全部要らないページはルートグループに分けて枠の layout の外に置く)・private フォルダ(`_x`)・`@slot`・intercepting(`(.)x`)の下・隣に `layout.tsx` も `page.tsx` も無いフォルダ
- テスト: `scripts/extensions/frames.test.mjs` が全部の組み合わせで順を固定する

## 生成する表

`<枠の根>/_layout/extensions/frameTable.ts`(生成物・編集不可。`extensions:check` がずれを止める):

```ts
export const frameTable = [
  { pattern: ["(protected)", "x", "[id]"], scope: "page", hide: ["footer-sp", "footer-pc"], fill: true },
  { pattern: ["(protected)", "x", "new"], scope: "page", hide: [], fill: false },
] as const satisfies FrameTable;
```

- `pattern` = 枠の layout の下の segment(ルートグループを含む、動的な段は `[id]` のまま)。読み手の `useSelectedLayoutSegments` と同じ形
- 各行は解決済みの最終の値(親の鎖を重ねた物)。照合 `matchFrame(segments, frameTable)` は当たる 1 行を選ぶだけで重ねない。当たらなければ何も隠さない
- 照合の順: 長い方 → 位置ごとに静的 > 動的 > catch-all > 任意の catch-all → page > layout。page は同じ長さ(末尾の `[[...x]]` は無くてよい)、layout は先頭の一致。catch-all は 1 つの segment(`"a/b"`)
- 行 = 宣言の範囲ごと(`layout:` は layout の行、`page:` は page の行)+ 照合がずれるページの行。宣言のある動的な段(`x/[id]`)は静的な兄弟(`x/new`)にも当たるので、生成器は全部のページを照合で試し、ずれるページに解決済みの値の行を足す(祖先の宣言が無ければ空の行)
- 隠す印 = `<部位>-<sp|pc>`(部位の名前 = data-slot の名前、利用者の枠は data-frame-part の語と同じ)
- 全部の部位を両方の端末で隠す宣言は warn でルートグループを案内する(書くことは止めない)

## 部位の一覧

`parts.mjs` の `FRAME_SLOTS`(名前 = data-slot の値):

- 利用者の枠: `app-container`・`app-banner`・`header`・`header-shell`・`header-left`・`header-center`・`header-right`・`header-brand`・`header-brand-logo`・`header-brand-text`・`header-nav`・`header-sp-nav-panel`・`footer`・`bottom-nav`・`bottom-nav-item`
- 管理の枠: `admin-app-container`・`admin-header`・`admin-header-title`・`admin-header-center`・`admin-header-right`・`admin-sidebar`・`admin-main`・`admin-footer`
- Main: `main`・`main-layout`・`main-container`
- 見出し(一覧に載せるだけ): `user-page-title`・`page-title`・`admin-page-title`・`sec-title`・`admin-sec-title`
- 隠せる部位(`hideable: true`): 利用者 `header`・`header-nav`・`footer`・`bottom-nav`、管理 `admin-header`・`admin-sidebar`・`admin-footer`
- テスト: 一覧の名前と隠せる部位、型のキーの union = 隠せる部位(`parts.test.mjs`)。枠の部品と frame.css の規則との照合は `(user)/_layout/UserFrame.test.tsx`(利用者)・`admin/_layout/AdminFrame.test.tsx`(管理)
