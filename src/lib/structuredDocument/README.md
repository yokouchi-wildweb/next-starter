# structuredDocument

構造化ドキュメントライブラリ。文書タイプごとにサブディレクトリで管理し、構造定義とレンダラーをセットで提供する。

## ディレクトリ構成

```
structuredDocument/
├── index.ts          # 共通エクスポート + 後方互換エイリアス
├── shared/           # 共通ユーティリティ
│   ├── index.ts
│   └── variables.ts  # 変数置換
│
├── legal/            # リーガルドキュメント
│   ├── index.ts
│   ├── definition.ts # 構造定義（型）
│   ├── Renderer/     # レンダラー
│   └── README.md
│
└── qa/               # Q&A（将来）
    └── ...
```

## 文書タイプ一覧

| タイプ | 用途 | ステータス |
|--------|------|------------|
| `legal` | 利用規約、プライバシーポリシー、特商法表記 | ✅ 実装済み |
| `qa` | Q&A、FAQ | 🔜 将来 |
| `guide` | ガイド、チュートリアル | 🔜 将来 |

## 使い方

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

## 新しい文書タイプの追加方法

1. サブディレクトリを作成（例: `qa/`）
2. `definition.ts` で構造を定義
3. `Renderer/` でレンダラーを実装
4. `index.ts` で型とレンダラーをエクスポート
5. `README.md` に使い方を記載
6. ルートの `index.ts` に再エクスポートを追加（任意）

詳細は `legal/` を参考にしてください。
