# required

この fork が必ず使う機能の受け口(1 機能 1 ファイル `<機能名>.ts` の `export const required: RequiredFeature = { reason }`)。
依存の検査(`../README.md`「依存の検査」)は、ここに載る機能のフォルダを外から読むことを「依存を書いた」とみなして通す。features:set / list での働き(閉じようとすると止める・必須と出す)は次の区切り。上流の項目は 0。
