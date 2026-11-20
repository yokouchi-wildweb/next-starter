# Admin

## Overview

- 管理画面の画面部品(一覧の上の段・検索・絞り込み・並べ替え・編集画面の項目の切り替え)。どれも props だけで、データは持たない
- 入口は部品ごと: `@/components/Admin/<Name>`(ItemNavigator だけフォルダ、他は default export の 1 ファイル。`Admin/index.ts` は無い)
- 使う時・直す時の決まりは札 `.claude/rules/items/components/Admin.md`。この README は使い方
- 管理の枠(ヘッダー・サイドバー・AdminPage)は部品ではなく `src/app/admin/_layout/` にある

| 部品 | 用途 |
|------|------|
| `ListTop` | 一覧の上の段: 題(SecTitle)と右側の操作(検索・ボタン)を 1 行に並べる。SP では縦に積む |
| `SecTitle` | 管理の節の見出し。`TextBlocks/SecTitle` の包みで、印 `data-slot="admin-sec-title"` を付ける |
| `SearchBox` | URL の検索語(既定 `searchQuery`)を書き換える検索欄。適用とリセットで `page` を消す |
| `SelectFilter` | URL の 1 つの値で絞る選択欄。「すべて」を選ぶとその値を消す |
| `SortSelect` | URL の並べ替え(既定 `sortBy`)を選ぶ選択欄。既定の値を選ぶとその値を消す |
| `ItemNavigator` | 編集画面で前後の項目へ移るだけの選択欄 |

## Usage

- URL を書き換える 3 つ(SearchBox・SelectFilter・SortSelect)は `makeHref(params)` で行き先を作る。今の URL の値を受け取り、ページの path に付けて返す
- 一覧の Header は ListTop の子に SearchBox などを置く(生成の `components/Admin<Domain>List/Header.tsx` がこの形)

```tsx
import ListTop from "@/components/Admin/ListTop";
import SearchBox from "@/components/Admin/SearchBox";

<ListTop title="記事一覧">
  <SearchBox makeHref={(p) => `/admin/posts?${p.toString()}`} />
</ListTop>
```

- ItemNavigator のデータは `src/lib/crud` の `useDomainItemNavigation` の戻り値をそのまま渡す。管理の編集画面では `src/app/admin/_layout/AdminEditItemNavigator` を `<AdminPage actions>` に置く(この組み合わせが済んでいる)

## Related

- 見出しの印の一覧: `src/app/_layout/frame/README.md`
- 管理の枠: `src/app/admin/_layout/README.md`
- 項目の切り替えのデータ: `src/lib/crud/hooks/README.md`
