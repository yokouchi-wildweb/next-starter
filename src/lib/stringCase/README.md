# stringCase

## Overview

- 名前の書き方の変換(camelCase / PascalCase / kebab-case / snake_case)。純粋関数だけで、どこからでも読める
- `.mjs` なのは、tsx を通さない Node の道具(ドメインの生成器・検査)からも同じ物を読むため
- 使う時・直す時の決まりは札 .claude/rules/items/lib/stringCase.md にある

## API

- 入口 `index.mjs`。import は `@/lib/stringCase/index.mjs`(TS はフォルダの index.mjs を解かない)。scripts の Node の道具は相対パスで `src/lib/stringCase/index.mjs` を読む
- `toCamelCase(str)` / `toPascalCase(str)` / `toKebabCase(str)` / `toSnakeCase(str)` … 単語に分けて(大文字の境目・`_`・`-`・空白)つなぎ直す。空・null・undefined は空文字
