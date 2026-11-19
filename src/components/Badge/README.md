# Badge

## Overview

- バッジ系コンポーネント群。入口は `@/components/Badge`
- 使う時・足す時の決まりは札 .claude/rules/items/components/Badge.md にある。この README は使い方と仕組み

| コンポーネント | 見た目 | 用途 |
| --- | --- | --- |
| `SolidBadge` | 不透明背景 + foregroundテキスト、丸ピル | ステータス表示・カウント表示など標準のバッジ |
| `SoftBadge` | 薄い透過背景 + ボーダー + 色付きテキスト、丸ピル | 柔らかい印象のステータス表示 |
| `BookmarkTagBadge` | 角なし + ボーダー、タグ風 | タグ・カテゴリ表示。`selected` propで選択状態の切替が可能 |

## Usage

```tsx
import { SolidBadge, SoftBadge, BookmarkTagBadge } from "@/components/Badge";

<SolidBadge variant="success">有効</SolidBadge>
<SolidBadge variant="success" icon={Check}>有効</SolidBadge>
<SoftBadge variant="muted" size="sm">下書き</SoftBadge>
<BookmarkTagBadge selected={false}>未選択</BookmarkTagBadge>
```

### asChild(インタラクティブなバッジ)

- `asChild` を指定すると、バッジ自身は要素を出力せず、単一の子要素にバッジのスタイル・propsをマージする(Radix Slot)
- 子側は `variant="none" size="none"` で自身の装飾を無効化し、見た目はバッジ側に委ねる(クラス衝突は tw-merge でバッジ側が勝つ)

```tsx
// クリックでモーダルを開くカウントピル（Form/Button と合成）
<SolidBadge asChild variant="primary" size="sm">
  <Button variant="none" size="none" onClick={openModal}>
    5台
    <Rows3 className="size-3.5" />
  </Button>
</SolidBadge>

// ピル型リンク（LinkButton と合成）
<SolidBadge asChild variant="outline">
  <LinkButton variant="none" size="none" href="/campaigns">キャンペーン一覧</LinkButton>
</SolidBadge>

// icon prop は asChild でも動く（子要素の内側先頭に展開される）
<SoftBadge asChild variant="info" icon={Info}>
  <Button variant="none" size="none" onClick={showHelp}>ヘルプ</Button>
</SoftBadge>
```

## API

全バッジ共通(`badge-variants.ts` の型を共有):

- `variant`: `primary | secondary | destructive | success | info | warning | accent | muted | outline | ghost`(既定: `primary`)
- `size`: `sm | md | lg`(既定: `md`)
- `icon`: Lucideアイコンコンポーネントを渡すとテキスト先頭に表示(サイズは `size` に連動)
- `asChild`: 子要素にバッジスタイルをマージ(Usage「asChild」)
- その他 `span` の属性はそのまま透過
- `BookmarkTagBadge` だけ `selected` で選択状態を切り替える
- 入口は型 `BadgeVariant` / `BadgeSize` / `BadgeVariantStyles` と共通サイズ `badgeSizeStyles` も出す

## Extension

- 色: `src/styles/palette.css` のトークン(`--success` / `--success-foreground` / `--success-text` 等)で変える
- 形(角丸・余白・枠線): `src/config/lib/variantOverrides.config.ts` の `badge` キーで、このディレクトリを編集せずに差し替える

```ts
defineVariantOverrides({
  badge: {
    size: { md: "px-2 py-0.5" },                 // 3 種共通のサイズ
    solid: { base: "rounded-md", variant: { primary: "shadow-sm" } },
    soft: { base: "rounded-md" },
    bookmarkTag: { variant: { muted: "opacity-70" } },
  },
})
```

- 結合順は `BASE → variantStyles[variant] → badgeSizeStyles[size] → オーバーライド(base → variant → size) → className`。同じプロパティは後勝ち。詳細は `src/styles/Extension.md`「バリアントの上書き(variants.config.ts)」

## Internals

- `BadgeCore`(`@/components/Primitives/Badge`): asChild(Slot) と icon の描画を一元化する共通コア。icon と children の共存は Radix の `Slottable` で解決している。3 つのバッジはどれもここに委譲する
- `badge-variants.ts`: variant/size の型と共通サイズ定義、下流オーバーライドの取り出し(`badgeOverrideClasses(kind, variant, size)`)
- 意味色の文字は本文用トークン(`text-success-text` 等)、塗りの上の文字は `-foreground` を使っている(.claude/rules/core/style.md semantic_colors。下流が塗りを淡くしても読めるように)
- `SoftBadge` のみ二層構造: 透過色背景の下に不透明な下地 `span` を敷き、背後の色の透けを防ぐ。`ref` はラッパー `span` に付く。asChild 時もラッパー `span` が残り、スタイルと props は子要素にマージされる
