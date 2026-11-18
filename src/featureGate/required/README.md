# required

## Overview

- この fork が必ず使う機能の受け口。上流の項目は 0

## Extension

- 1 機能 1 ファイル `<機能名>.ts` の `export const required: RequiredFeature = { reason }`

## Internals

- 依存の検査(`../README.md`「依存の検査」)は、ここに載る機能のフォルダを外から読むことを「依存を書いた」とみなして通す
- `pnpm ops features list` は「必須」と reason を出す
- `FEATURE_GATE_CHECK=all` の全部閉じる検査は、ここに載る機能(とその dependsOn の先)を開いたまま扱う
- `pnpm ops features set <名前> off` は何も書かずに止める(`../README.md`「pnpm ops features list / pnpm ops features set」)
