# libPackage

## Overview

- lib の package.json(宣言)の唯一の読み手と形の検査。Node 組み込みだけを読む(他の lib・features を読まない)ので、lint(`eslint-rules/import-boundaries.mjs`)・Node の道具(`scripts/structure/lib-package`)・テストのどこからでも読める
- 入口は 2 つ: `.`(`index.mjs`)= ファイルを読まない決まり(定数・`listLibsFrom`・`libOfPath`・`findEntry`)、client でも server でも読める / `./node`(`node.mjs`)= 今の木を node:fs で読む読み手と形の検査(Next の外のプログラム = lint・scripts・テストが読む)
- 宣言の形と lint の決まりは [../README.md](../README.md)「lib の package.json(宣言の形)」
- 使う時・直す時の決まりは札 .claude/rules/items/lib/libPackage.md にある

## API

### 関数

- 入口 `.` = `index.mjs`(`@/lib/libPackage/index.mjs`)、`./node` = `node.mjs`(`@/lib/libPackage/node.mjs`)。scripts・eslint-rules からは相対(`../src/lib/libPackage/node.mjs`)
- `.`: `listLibsFrom`・`libOfPath`・`findEntry`・定数。node の API を読まない(テストが字面で確かめる)
- `./node`: `listLibs`・`hasLibPackage`・`listDeclaredLibs`・`readLibPackage`・`checkLibPackage`・`checkAllLibPackages`・`clearLibPackageCache`
- `root` = repo の根(絶対パス)。パスは repo 相対の posix
- `listLibs(root)` … `src/lib` 直下の lib の名前(フォルダだけ、名前順)
- `listLibsFrom(listDir)` … 同じ一覧を、読み方を注入して返す(`listDir(rel)` = フォルダの直下の `{ name, isDir }[]`、無ければ `[]`。node:fs を使わない)。`listLibs` と地区の地図(`src/lib/districtMap`)が使う
- `hasLibPackage(root, lib)` / `listDeclaredLibs(root)` … package.json を持つか / 持つ lib の一覧
- `readLibPackage(root, lib)` … 無ければ `null`。有れば `{ lib, dir, file, exports, libs, peers, sideEffects, problems }`
  - `exports` = `{ key, target, keyPath, targetPath }[]`(問題の無い行だけ。`keyPath` = 拡張子と `/index` を落とした lib の中のパス、`"."` は `""`)
  - `libs` / `peers` = 問題の無い項目だけ。`sideEffects` = `false` | `string[]` | `undefined`
  - `problems` = `{ lib, code, message }[]`
- `checkLibPackage(root, lib)` … 形の問題の一覧(package.json が無ければ空)
- `checkAllLibPackages(root)` … `{ libs: [{ lib, problems }], declared, problemCount }`(宣言済みの lib ごと)
- `libOfPath(relPath)` … `src/lib/<name>/…` → `name`、lib の外は `null`
- `findEntry(pkg, resolvedRelPath)` … 解いたパス(`eslint-rules/resolve-import.mjs` の結果。拡張子・index は有無を問わない)が入口に当たればその行、無ければ `null`
- `clearLibPackageCache()` … 読んだ結果は root + lib ごとに 1 プロセスの間覚えるので、それを消す
- 定数: `LIB_DIR`(`"src/lib"`)・`PEER_DIRS`(`{ components: "src/components" }`)・`ALLOWED_KEYS`・`ENTRY_NAMES`(exports の鍵に使える入口の名前 `.`・`./server`・`./client`・`./node`)・`ENTRY_EXTENSIONS`

### 問題の名前(`code`)

`json` 読めない | `name` name を書いた | `unknownKey` 使えないキー | `exportsMissing` / `exportsShape` exports が無い・空・形違い | `pattern` `*` | `condition` 値が文字列でない | `keyForm` 鍵が `.` / `./<パス>` でない | `entryName` 鍵が入口の名前(`ENTRY_NAMES` = `.`・`./server`・`./client`・`./node`、D248)でない | `targetOutside` 値が lib の外 | `targetExt` 値がファイルでない | `keyMismatch` 鍵と値の実パスが違う | `targetMissing` 先が無い | `libsShape` / `libDuplicate` / `libSelf` / `libUnknown` | `peersShape` / `peerDuplicate` / `peerUnknown` | `sideEffectsShape` false か文字列の配列でない

## Verification

- `pnpm test src/lib/libPackage/libPackage.test.mjs`(fixture は一時フォルダに作る)
- lint は `pnpm test eslint-rules/entry.test.mjs`
