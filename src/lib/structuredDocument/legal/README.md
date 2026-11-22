# legal - リーガルドキュメント

## Overview

- 利用規約、プライバシーポリシー、特商法表記など、階層構造を持つ法的文書の型と描画。入口 `@/lib/structuredDocument`(lib の入口は 1 つ)
- 型と描画だけを持つ。文書の中身(例文・プロジェクトの文面・差し込みの値)は法務のドメイン `src/domains/core/legal` が持つ

## Usage

- 画面は `getLegalDocument(kind)` の差し込み済みの文書と `enactedAtFormat={getLegalEnactedAtFormat()}` をこのレンダラーに渡す(`variables` は渡さない。形: `src/domains/core/legal/README.md`)
- 差し込み前の文書を直接描くとき(例):

```tsx
import {
  LegalDocumentRenderer,
  type LegalDocument,
} from "@/lib/structuredDocument";

<LegalDocumentRenderer
  document={termsConfig}
  variables={{ COMPANY_NAME: "株式会社Example" }}
/>
```

- `variables` は文書の `{{鍵}}` を置換する(書式: `../README.md` API「差し込み({{鍵}})」)

### Markdown 記法

content 内で以下の記法が使用可能(rich のみ。plain では除去):

- `**太字**`
- `*斜体*`
- `~~取り消し線~~`
- `[リンク](url)`

## API

### 構造定義

```typescript
type LegalSection = {
  id?: string;              // アンカーリンク用
  title?: string;           // セクションタイトル（省略可）
  content?: string[];       // 本文（段落の配列）
  children?: LegalSection[]; // 子セクション（再帰）
};

type LegalDocument = {
  title: string;            // 文書タイトル
  enactedAt?: string;       // 制定日
  lastUpdatedAt?: string;   // 最終更新日
  sections: LegalSection[];
  sectionNumbering?: "article" | "numeric" | "none";
};
```

### `LegalDocumentRenderer` のプロパティ

| プロパティ | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `document` | `LegalDocument` | 必須 | 描画する文書 |
| `variables` | `VariableMap` | `{}` | プレースホルダー置換用 |
| `mode` | `"rich" \| "plain"` | `"rich"` | 描画モード |
| `showTitle` | `boolean` | `true` | タイトル表示 |
| `showEnactedAt` | `boolean` | `true` | 制定日表示 |
| `enactedAtFormat` | `LegalEnactedAtFormat` | - | 制定日・最終改定日の行の文言。`{ both?, enactedOnly?, updatedOnly? }` の各テンプレートで `{enactedAt}` / `{lastUpdatedAt}` を置換（省略したキーは既定の文言）。文字列だけなのでサーバーの Screen から渡せる。日付そのものの書式は文書側（legal の上書き `src/config/domains/legal.config.ts` 等）の文字列で決める |
| `maxHeight` | `string` | - | スクロール領域の最大高さ |
| `className` | `string` | - | カスタムクラス |

### 描画モード

- **rich**: CSSカウンターで自動採番、Markdown記法をレンダリング
- **plain**: プレーンテキスト(Markdown 記法は除去、トップレベルの見出しに番号を文字で付ける)。スクロール領域での表示に適する

### セクション番号

| 値 | 出力 |
|-----|------|
| `"article"` | 第1条 適用 |
| `"numeric"` | 1. 適用 |
| `"none"` | 適用 |

※ rich はトップレベルの h2 に CSS カウンター（`.numbered-articles`, `.numbered-sections`、`src/styles/core/components.css`）で採番

## Related

- 文書の中身と取得: `src/domains/core/legal/README.md`
- 差し込み: `../README.md` API「差し込み」
