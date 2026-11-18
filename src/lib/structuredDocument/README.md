# structuredDocument

## Overview

- 構造化ドキュメントライブラリ。文書タイプごとにサブフォルダを持ち、構造定義(型)とレンダラーをセットで提供する
- 文書タイプ: `legal`(利用規約、プライバシーポリシー、特商法表記。`legal/README.md`)
- 共通: `{{鍵}}` の差し込み(`shared/variables.ts`)

## Usage

- 法務の文書を描く: `legal/README.md` Usage(画面は差し込み済みの文書を渡す)

## API

### 差し込み({{鍵}})

- `{{鍵}}` の差し込みはこの lib の 1 本(`shared/variables.ts`)。連絡の欄(lib/messaging)もこれを使う
- `replaceVariables(text, map)`: 知っている鍵を差し込み、知らない鍵はそのまま残す
- `listVariables(text)`: 出てくる鍵を順に重複なしで返す(定義の検査が使う)
- `replaceVariablesInArray(texts, map)`: 配列の各要素に replaceVariables
- 鍵は文字(どの文字体系も。日本語の別名 `{{受信者名}}` も)・数字・_ の並び。空白や点を含む鍵(`{{a.b}}`)は差し込まれずに残る

## Internals

- 文書タイプの形(`legal/` が手本): サブフォルダに `definition.ts`(構造の型)・`Renderer/`(レンダラー)・`index.ts`(型とレンダラーの export)・`README.md`。ルートの `index.ts` への再 export は任意

## Related

- リーガルドキュメント: `legal/README.md`
- 連絡の差し込み: `src/lib/messaging/README.md`
