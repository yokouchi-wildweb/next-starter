# Overlays/DetailModal

## Overview

- 詳細表示用モーダル。画像/動画 + テーブル形式のデータ表示に特化。入口は `@/components/Overlays/DetailModal`
- モーダルの外(画面の中・カード・印刷)で同じ「項目名: 値」の表を使うときは、同じ入口の `DetailTable`

## Usage

```tsx
import DetailModal from "@/components/Overlays/DetailModal";

<DetailModal
  open={isOpen}
  onOpenChange={setIsOpen}
  title="商品詳細"
  badge={{ text: "公開中", variant: "success" }}
  media={{ type: "image", url: "/product.jpg", alt: "商品画像" }}
  rows={[
    { label: "商品名", value: "サンプル商品" },
    { label: "価格", value: "¥1,000" },
  ]}
  footer={<Button>編集</Button>}
/>
```

### DetailTable(鍵と値の表を単独で)

```tsx
import { DetailTable } from "@/components/Overlays/DetailModal";

<DetailTable rows={[[{ label: "ID", value: user.id }, { label: "状態", value: statusLabel }], [{ label: "メモ", value: memo }]]} />
```

## API

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `open` | `boolean` | - | 表示状態 |
| `onOpenChange` | `(open: boolean) => void` | - | 状態変更コールバック |
| `title` | `string` | - | タイトル |
| `titleSrOnly` | `boolean` | - | タイトルをスクリーンリーダー専用にする |
| `badge` | `{ text: string; variant?: BadgeVariant }` | `variant: "success"` | タイトル横に表示するバッジ(`SolidBadge`) |
| `media` | `{ type?: "image" \| "video"; url: string; alt?: string; poster?: string }` | `type: "image"` | メディアプレビュー |
| `mediaNode` | `ReactNode` | - | メディア欄に描く任意の要素。渡すと `media` より優先 |
| `rows` | `DetailModalRow[]` | - | `{ label, value }` の配列、または `ReactNode[]` によるカスタム行 |
| `footer` | `ReactNode` | - | テーブル下に任意のフッターを配置 |
| `className` | `string` | - | 追加クラス |
| `onOpenAutoFocus` | `(event: Event) => void` | - | 開いた直後の自動フォーカス制御（Modal へ透過） |
| `onCloseAutoFocus` | `(event: Event) => void` | - | 閉じた後のフォーカス制御（Modal へ透過） |

- `rows` へ `ReactNode[]` を渡すと、列幅を柔軟に変えたカスタム行を作成できる
- `DetailTable` の `rows` は DetailModal と同じ(`{ label, value }` のセルの配列、または `ReactNode[]` の行。行ごとにセルの数が違ってよく、最後のセルが残りの列にまたがる)

## Internals

`media.url` / `media.poster` には `storage://` の ref をそのまま渡してよい（`toStorageDisplaySrc` で表示用 URL に直す）。

- 動画（`type: "video"`）は [Media/AppVideo](../../Media/AppVideo/README.md) が描く。非公開の動画は署名期限切れから復帰し、復帰も止まったら動画の下に失敗の文と「再開」を出す
