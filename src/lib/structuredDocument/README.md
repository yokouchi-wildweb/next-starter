# structuredDocument

## Overview

- 構造化ドキュメントライブラリ。文書タイプごとにサブフォルダを持ち、構造定義(型)とレンダラーをセットで提供する
- 文書タイプ: `legal`(利用規約、プライバシーポリシー、特商法表記。`legal/README.md`)
- 閉じた lib: 入口は `@/lib/structuredDocument` だけ(文書タイプの構造の型・レンダラー・整形の関数)。読む lib は templateVariables、棚 `@/components`(peers)
- `{{鍵}}` の差し込みは lib templateVariables(`@/lib/templateVariables`)。レンダラーはそれで `variables` を差し込む

## Usage

- 法務の文書を描く: `legal/README.md` Usage(画面は差し込み済みの文書を渡す)

## API

- 入口 `.` が出す名前: `legal/index.ts` の型・`LegalDocumentRenderer`・整形の関数(`formatSectionTitle`・`getNumberingClassName`・`stripMarkdown`・`stripMarkdownLinks`)。中身: `legal/README.md` API
- 差し込み(`replaceVariables` など)は `src/lib/templateVariables/README.md` API

## Internals

- 文書タイプの形(`legal/` が手本): サブフォルダに `definition.ts`(構造の型)・`Renderer/`(レンダラー)・`index.ts`(型とレンダラーの export)・`README.md`。外から読めるのは入口 `.` だけなので、文書タイプの名前はルートの `index.ts` から全部出す

## Related

- リーガルドキュメント: `legal/README.md`
- 差し込みの 1 本: `src/lib/templateVariables/README.md`
- 連絡の差し込み: `src/lib/messaging/README.md`
