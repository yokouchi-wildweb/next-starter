# Overlays/Tooltip

## Overview

- `Tooltip`: シンプルなツールチップ。ホバーで短いテキストを表示
- `HelpTip`: ラベル + ?アイコン + ホバー説明。テーブルヘッダーやフォームラベルなど「名前だけでは意味が伝わらない項目」に説明を添える。デスクトップはホバー、タッチデバイスはタップで開閉
- クリックで開く操作性やリッチな長文は `InfoPopover`(`../Popover/README.md`)
- 入口は `@/components/Overlays/Tooltip`

## Usage

```tsx
import { Tooltip } from "@/components/Overlays/Tooltip";

<Tooltip content="設定を開く">
  <IconButton icon={Settings} />
</Tooltip>

// カスタマイズ
<Tooltip
  content="この操作は取り消せません"
  side="right"
  delayDuration={500}
>
  <Button variant="destructive">削除</Button>
</Tooltip>
```

```tsx
import { HelpTip } from "@/components/Overlays/Tooltip";

// DataTable のヘッダー
{
  header: <HelpTip label="詳細CTR" help="詳細クリック ÷ インプレッション。バナーが表示されたうち詳細が開かれた割合" />,
  render: ...
}
```

## API

### Tooltip の props

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `content` | `ReactNode` | - | ツールチップの内容 |
| `children` | `ReactNode` | - | トリガー要素 |
| `side` | `"top" \| "right" \| "bottom" \| "left"` | `"top"` | 表示位置 |
| `delayDuration` | `number` | `200` | 表示までの遅延（ms） |
| `skipDelayDuration` | `number` | -（共有Providerに従う） | 遅延スキップ時間の個別指定（後述） |
| `showArrow` | `boolean` | `true` | 矢印表示 |

### HelpTip の props

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `label` | `ReactNode` | - | 表示ラベル |
| `help` | `ReactNode` | - | ホバー/タップで表示する説明文 |
| `iconSize` | `"sm" \| "md" \| "lg"` | `"md"` | ヘルプアイコンのサイズ |
| `side` | `"top" \| "right" \| "bottom" \| "left"` | `"top"` | 表示位置 |
| `className` | `string` | - | ラッパーの追加クラス |
| `iconClassName` | `string` | - | アイコンの追加クラス |
| `contentClassName` | `string` | - | ツールチップコンテンツの追加クラス |

## Internals

### TooltipProvider(共有プロバイダー)

- `app/layout.tsx` にアプリ全体で1つ配置済み。隣接するツールチップ間を移動したとき、直前のツールチップが閉じてから `skipDelayDuration`(デフォルト300ms)以内なら表示遅延なしで次が即表示される(Radix の仕様上、この挙動は Provider 単位でしか機能しないため共有している)
- 各 `Tooltip` は自動で共有 Provider に参加する。**通常は何も意識しなくてよい**
- `Tooltip` に `skipDelayDuration` を明示指定した場合のみ、そのインスタンスは
  個別 Provider にフォールバックし指定値が適用される（後方互換）
- `delayDuration` の個別指定は共有 Provider 配下でもそのまま有効
