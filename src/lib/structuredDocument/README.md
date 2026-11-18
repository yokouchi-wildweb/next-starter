# structuredDocument

## Overview

- 構造化ドキュメントライブラリ。文書タイプごとにサブフォルダを持ち、構造定義(型)とレンダラーをセットで提供する
- 文書タイプ: `legal`(利用規約、プライバシーポリシー、特商法表記。`legal/README.md`)
- 共通: `{{鍵}}` の差し込み(`shared/variables.ts`)

## Usage

```tsx
import {
  LegalDocumentRenderer,
  type LegalDocument,
} from "@/lib/structuredDocument/legal";

const termsConfig: LegalDocument = {
  title: "利用規約",
  sectionNumbering: "article",
  sections: [
    { content: ["前文..."] },
    { id: "article-1", title: "適用", content: ["1. 本規約は..."] },
  ],
};

<LegalDocumentRenderer
  document={termsConfig}
  variables={{ COMPANY_NAME: "株式会社Example" }}
/>
```

## API

### 差し込み({{鍵}})

- `{{鍵}}` の差し込みはこの lib の 1 本(`shared/variables.ts`)。連絡の欄(lib/messaging)もこれを使う
- `replaceVariables(text, map)`: 知っている鍵を差し込み、知らない鍵はそのまま残す
- `listVariables(text)`: 出てくる鍵を順に重複なしで返す(定義の検査が使う)
- 鍵は `\w+`(英数字と _)。点を含む鍵(`{{a.b}}`)は差し込まれない

## Extension

新しい文書タイプを足す(`legal/` が手本):

1. サブフォルダを作る(例: `qa/`)
2. `definition.ts` で構造を定義
3. `Renderer/` でレンダラーを実装
4. `index.ts` で型とレンダラーを export
5. `README.md` に使い方を書く
6. ルートの `index.ts` に再 export を足す(任意)

## Related

- リーガルドキュメント: `legal/README.md`
- 連絡の差し込み: `src/lib/messaging/README.md`
