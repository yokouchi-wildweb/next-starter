# 枠の宣言(frame.ts)

ページごとの小さな宣言ファイル `frame.ts` で「そのルートで枠のどの部位を隠すか・本文が画面の高さを埋めるか(fill)」を書き、`pnpm extensions:generate` が親の鎖と override を解決した表を枠ごとに生成する。

> 今の段階では枠はまだ表を読まない(部位の出し入れは `Hide*` と `:has()` のまま)。枠が表を読む形への切り替えは後の段で入る。

## 置き場(このフォルダ)

| ファイル | 中身 |
|---|---|
| `parts.mjs` | 枠の部位の一覧(唯一の元、data-slot の名前 31 名)・隠せる部位・枠の根・端末 |
| `resolve.mjs` | 宣言の形の検査・重ね(親の鎖と override)・表の照合 `matchFrame`(純関数。生成器と実行時の読み手が共有) |
| `types.ts` | `FrameDeclaration`(利用者の枠)・`AdminFrameDeclaration`(管理の枠)・表の行の型 |
| `index.ts` | 入口(re-export だけ) |
| `parts.test.mjs` / `resolve.test.mjs` | `pnpm test:frame-declaration` |

生成器は `scripts/extensions/frames.mjs`(テスト `pnpm test:extensions`)。`.mjs` なのは、tsx を通さない生成器(node)からも TypeScript からも import するため。

## 書き方

```ts
// src/app/(user)/(protected)/game/frame.ts
import type { FrameDeclaration } from "@/app/_layout/frame";

export const frame = {
  hide: { bottomNav: { sp: true, pc: true }, footer: { sp: true } },
  fill: true,
} satisfies FrameDeclaration;
```

- 値はリテラルだけ(字面で読み、実行しない。変数・式・関数呼び出しは失敗)
- `hide` のキー = 部位の名前から枠の接頭辞を除いた camelCase。利用者の枠 `header`・`headerNav`・`footer`・`bottomNav`、管理の枠(`src/app/admin` の下、`AdminFrameDeclaration`)`header`・`sidebar`・`footer`
- 端末: `sp` = 40rem 未満 / `pc` = 40rem 以上。省略 = 親のまま、`false` = 親の指定の取り消し
- `fill`: 外枠を画面の高さに合わせ、本文が残りを埋める。省略 = 親のまま
- ページの中身(題など)は書かない(枠の部位の出し入れと fill だけ)

## どこに効くか

- 置ける場所: 枠の根(`src/app/(user)`・`src/app/admin`)の下で、隣に `layout.tsx` か `page.tsx` があるフォルダ
  - 隣に `layout.tsx` がある → そのフォルダの下全部(ページも子のルートも)
  - `page.tsx` だけ → そのページだけ
- 重ねる順: 浅い → 深い、各段で `frame.ts` → `frame.override.ts`。部位と端末ごとに上書き
- 枠の根の隣の `frame.ts` = 枠の全体の既定(領域全体の入り切り)
- 置けない: 枠の外(枠が全部要らないページはルートグループに分けて枠の layout の外に置く)・private フォルダ(`_x`)・`@slot`・intercepting(`(.)x`)の下

## fork

- 自分の page / layout の隣 → `frame.ts`
- 上流の page / layout の隣 → `frame.override.ts`(`export const override = { … }`、形は frame と同じ)。上流の宣言の上に部位と端末ごとに重なり fork が勝つ。上流がそこに `frame.ts` を持たなくても置ける
  - 上流の隣に fork が `frame.ts` を置く = `pnpm ownership:check` の `frame-beside-parent`(隣の持ち主は git の分岐点で決める。生成器は git を使わない)
  - 自分のページへの `frame.override.ts` = `ownership:check` の `override-own`
  - 隣に `frame.ts` も page / layout も無い `frame.override.ts` = 孤立で失敗(`extensions:check`)
  - 空(空白とコメントだけ)は不在と同じ。上流(Tier1)は `frame.override.ts` を出荷しない

## 生成する表

`<枠の根>/_layout/extensions/frameTable.ts`(生成物・編集不可。`extensions:check` がずれを止める):

```ts
export const frameTable = [
  { pattern: ["(protected)", "x", "[id]"], scope: "page", hide: ["footer-sp", "footer-pc"], fill: true },
  { pattern: ["(protected)", "x", "new"], scope: "page", hide: [], fill: false },
] as const satisfies FrameTable;
```

- `pattern` = 枠の layout の下の segment(ルートグループを含む、動的な段は `[id]` のまま)。読み手の `useSelectedLayoutSegments` と同じ形
- 各行は解決済みの最終の値(親の鎖と override を重ねた物)。照合 `matchFrame(segments, frameTable)` は当たる 1 行を選ぶだけで重ねない。当たらなければ何も隠さない
- 照合の順: 長い方 → 位置ごとに静的 > 動的 > catch-all > 任意の catch-all → page > layout。page は同じ長さ(末尾の `[[...x]]` は無くてよい)、layout は先頭の一致。catch-all は 1 つの segment(`"a/b"`)
- 行 = 宣言のあるルート + 照合がずれるページの行。宣言のある動的な段(`x/[id]`)は静的な兄弟(`x/new`)にも当たるので、生成器は全部のページを照合で試し、ずれるページに解決済みの値の行を足す(祖先の宣言が無ければ空の行)
- 隠す印 = `<部位>-<sp|pc>`(部位の名前 = data-slot の名前、利用者の枠は data-frame-part の語と同じ)
- 全部の部位を両方の端末で隠す宣言は warn でルートグループを案内する(書くことは止めない)

## 部位の一覧

`parts.mjs` の `FRAME_SLOTS`(名前 = data-slot の値):

- 利用者の枠: `app-container`・`app-banner`・`header`・`header-shell`・`header-left`・`header-center`・`header-right`・`header-brand`・`header-brand-logo`・`header-brand-text`・`header-nav`・`header-sp-nav-panel`・`footer`・`bottom-nav`・`bottom-nav-item`
- 管理の枠: `admin-app-container`・`admin-header`・`admin-header-title`・`admin-header-center`・`admin-header-right`・`admin-sidebar`・`admin-main`・`admin-footer`
- Main: `main`・`main-layout`・`main-container`
- 見出し(一覧に載せるだけ): `user-page-title`・`page-title`・`admin-page-title`・`sec-title`・`admin-sec-title`
- 隠せる部位(`hideable: true`): 利用者 `header`・`header-nav`・`footer`・`bottom-nav`、管理 `admin-header`・`admin-sidebar`・`admin-footer`
- テスト: 利用者の隠せる部位 = `frameParts.ts` の `FRAME_PARTS` のキー = `(user)/_layout` の `data-frame-part` の値、型のキーの union = 隠せる部位
