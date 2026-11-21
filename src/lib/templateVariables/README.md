# src/lib/templateVariables — テキストの差し込み {{鍵}}

## Overview

- テキストの `{{鍵}}` の差し込みの 1 本(書式はここだけ)。閉じた lib で、入口は `.`(`@/lib/templateVariables`)だけ。依存なし(`package.json` の `libs` は無い)の純関数
- 読み手: リーガルドキュメントの描画(lib structuredDocument)・連絡の文面と定義の検査(lib messaging・messaging ドメイン)・法務の文書の値(legal ドメイン)
- 使う時・直す時の決まりは札 `.claude/rules/items/lib/templateVariables.md`

## Usage

```ts
import { listVariables, replaceVariables, type VariableMap } from "@/lib/templateVariables";

replaceVariables("{{COMPANY_NAME}}が提供する", { COMPANY_NAME: "株式会社Example" }); // => "株式会社Exampleが提供する"
listVariables("{{A}} と {{B}} と {{A}}"); // => ["A", "B"]
```

## API

- `replaceVariables(text, map)`: 知っている鍵を差し込み、知らない鍵はそのまま残す
- `listVariables(text)`: 出てくる鍵を順に重複なしで返す(定義の検査が使う)
- `replaceVariablesInArray(texts, map)`: 配列の各要素に replaceVariables
- `VariableMap`: 鍵 → 差し込む文字列
- 鍵は文字(どの文字体系も。日本語の別名 `{{受信者名}}` も)・数字・_ の並び。空白や点を含む鍵(`{{a.b}}`)は差し込まれずに残る

## Verification

- `pnpm test src/lib/templateVariables`(`variables.test.ts`)

## Related

- リーガルドキュメント: `src/lib/structuredDocument/README.md`
- 連絡の差し込み: `src/lib/messaging/README.md`
