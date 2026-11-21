# plainObject

## Overview

- 素のオブジェクト(object リテラル・`JSON.parse` の結果・`Object.create(null)`)かどうかの判定を 1 つだけ持つ。純粋関数で、どこからでも読める
- `.mjs` なのは、tsx を通さない Node の道具(生成器・検査)からも同じ物を読むため
- 使う時・直す時の決まりは札 .claude/rules/items/lib/plainObject.md にある

## API

- 入口 `index.mjs`。import は `@/lib/plainObject/index.mjs`(TS はフォルダの index.mjs を解かない)。Node が直接読むファイル(scripts の道具、`src/app/_layout/frame/resolve.mjs` など)は相対パスで `src/lib/plainObject/index.mjs` を読む
- `isPlainObject(value)` … null でない object で、prototype が `Object.prototype` か `null` なら真(型の絞り込み `value is Record<string, unknown>`)。配列・Date・Map・クラスのインスタンスは偽
- 自分のプロパティかの判定は組み込みの `Object.hasOwn` を使う(写しを作らない)
