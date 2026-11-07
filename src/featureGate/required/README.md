# required

この fork が必ず使う機能の受け口(1 機能 1 ファイル `<機能名>.ts` の `export const required: RequiredFeature = { reason }`)。
依存の検査(`../README.md`「依存の検査」)は、ここに載る機能のフォルダを外から読むことを「依存を書いた」とみなして通す。`pnpm ops features list` は「必須」と reason を出し、`pnpm ops features set <名前> off` は何も書かずに止める(`../README.md`「pnpm ops features list / pnpm ops features set」)。上流の項目は 0。
