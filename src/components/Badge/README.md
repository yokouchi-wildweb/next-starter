# Badge

バッジ系コンポーネント群。`_shadcn/badge` の直接importは禁止（PROHIBITED）。バッジが必要な場合は必ずここから選ぶ。

## コンポーネント一覧

| コンポーネント | 見た目 | 用途 |
| --- | --- | --- |
| `SolidBadge` | 不透明背景 + foregroundテキスト、丸ピル | ステータス表示・カウント表示など標準のバッジ |
| `SoftBadge` | 薄い透過背景 + ボーダー + 色付きテキスト、丸ピル | 柔らかい印象のステータス表示 |
| `BookmarkTagBadge` | 角なし + ボーダー、タグ風 | タグ・カテゴリ表示。`selected` propで選択状態の切替が可能 |

```tsx
import { SolidBadge, SoftBadge, BookmarkTagBadge } from "@/components/Badge";
```

## 共通 Props

全バッジ共通（`badge-variants.ts` の型を共有）:

- `variant`: `primary | secondary | destructive | success | info | warning | accent | muted | outline | ghost`（既定: `primary`）
- `size`: `sm | md | lg`（既定: `md`）
- `icon`: Lucideアイコンコンポーネントを渡すとテキスト先頭に表示（サイズは `size` に連動）
- `asChild`: 子要素にバッジスタイルをマージ（後述）
- その他 `span` の属性はそのまま透過

```tsx
<SolidBadge variant="success">有効</SolidBadge>
<SolidBadge variant="success" icon={Check}>有効</SolidBadge>
<SoftBadge variant="muted" size="sm">下書き</SoftBadge>
<BookmarkTagBadge selected={false}>未選択</BookmarkTagBadge>
```

## asChild（インタラクティブなバッジ）

`asChild` を指定すると、バッジ自身は要素を出力せず **単一の子要素** にバッジのスタイル・propsをマージする（Radix Slot）。クリックできるバッジやリンク型バッジは、生の `button`/`a` を作らず既存のインタラクティブコンポーネントと合成する。

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

ポイント:

- 子側は `variant="none" size="none"` で自身の装飾を無効化し、見た目はバッジ側に委ねる（クラス衝突は tw-merge でバッジ側が勝つ）
- `asChild` の子は **単一のReact要素** であること（テキストだけ・複数要素・Fragment は不可。Slotの仕様で実行時エラーになる）
- `SoftBadge` は二層構造（下記）のためラッパー `span` が asChild 時も残る。スタイルとpropsは子要素にマージされる

## 内部構造

- `BadgeCore.tsx`（内部用・バレル非公開）: asChild(Slot) と icon の描画を一元化する共通コア。icon と children の共存は Radix の `Slottable` で解決している。**新しいバッジを追加する場合は必ず BadgeCore に委譲し、Slot分岐を自前実装しないこと**（過去に3コンポーネントへ複製されたSlot分岐が全て同一バグを抱えた経緯がある）
- `badge-variants.ts`: variant/size の型と共通サイズ定義。新バッジは `BadgeVariantStyles` を実装する
- `SoftBadge` のみ二層構造: 透過色背景の下に不透明な下地 `span` を敷き、背後の色の透けを防ぐ。`ref` はラッパー `span` に付く
