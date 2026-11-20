# folderCatalog

## Overview

- フォルダ目録(`CATALOG.md`)の読み込み・検査・所有判定。目録 = そのフォルダ直下のディレクトリ(ライブラリ等)を、どのリポジトリが作ったかの一覧
- 目録は 4 つ: `src/lib/CATALOG.md`(直下のディレクトリ = lib)・`src/components/CATALOG.md`(分類の直下の単位 `src/components/<分類>/<単位>`)・`src/hooks/CATALOG.md` と `src/utils/CATALOG.md`(直下の 1 ファイル = 1 単位)。どれも各リポが自分の節を末尾に足すだけの置き場(`extensionPoints.ts` の `catalogSections`・`componentsCatalogSections`・`hooksCatalogSections`・`utilsCatalogSections`、受け口の一覧の `append` の行)
- Node 組み込みだけで動く純粋な `.mjs`(`eslint.config.mjs` の読み込み時にも実行される)
- フォルダに依存しないので、別のフォルダに目録を作るときもそのまま使える
- 使い手: テスト(`catalog.test.mjs`)、`eslint.config.mjs`(所有に応じた error / warn の振り分け)、`src/lib/screens/screens.test.mjs`(Tier1 かどうか = `isRoot`)
- 決まりは `.claude/rules/items/lib/folderCatalog.md`

## API

`catalog.mjs`:

- `parseCatalog(text)`: 目録を `{ sections: [{ owner, line, entries: [{ path, description, line }] }], errors }` に読む。最初の `## ` 見出しより前は説明文として読み飛ばす
- `checkCatalog({ sections, folder, dirs, depth? })`: 実在する項目との不一致(行の無い項目・実在しない行)・重複・その深さでないパス・節の重複を、日本語のメッセージ配列で返す(空 = 問題なし)。`depth` 1(既定)= `<folder>/<名前>`、2 = `<folder>/<分類>/<単位>`(index だけの分類は分類の行で通す)
- `listDirs(repoRoot, folder)`: フォルダ直下のディレクトリ名(隠しディレクトリを除く)
- `listFileUnits(repoRoot, folder)`: 1 ファイル = 1 単位のフォルダ(src/hooks・src/utils)の単位の名前。直下のコードのファイル(`*.test.*` を除く、最後の拡張子を除いた名前)と直下のフォルダ。`.gitkeep`・Markdown は単位でない
- `listUnits(repoRoot, folder)`: 部品の棚の単位を `<分類>/<単位>` で返す。単位 = 分類の直下のフォルダ(隠し・`__fixtures__` を除く)とコードのファイル(`*.test.*` を除く、最後の拡張子を除いた名前)。分類の直下の `index.*` は分類そのものが 1 つの単位(forkOwnership の単位名と同じ数え方)
- `loadCatalogOwnership({ repoRoot, folder, catalogFile?, ownerId? })`: `{ ownerId, isRoot, ownPaths, upstreamPaths }`。所有者 ID の既定 = 自分のリポの名前(repo.json の `repo_id`、読み手は `forkOwnership/forkIds.mjs` の `readForkIdentity`)。先頭の節が自分なら `isRoot`。目録が読めない・名前が分からないときは自分の所有なし

## Verification

- `pnpm test src/lib/folderCatalog/catalog.test.mjs` = 実リポジトリの 4 つの目録(`src/lib`・`src/components`・`src/hooks`・`src/utils` の `CATALOG.md`)の検査 + 部品の単体テスト(`fixtures/CATALOG.sample.md`、単位の数え方は一時の木)

## Related

- 目録の考え方と書き方: [`src/lib/README.md`](../README.md)・[`src/components/CATALOG.md`](../../components/CATALOG.md) の頭
