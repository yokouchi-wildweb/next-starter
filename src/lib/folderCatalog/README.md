# folderCatalog

フォルダ目録（`CATALOG.md`）の読み込み・検査・所有判定。目録の考え方と書き方は [`src/lib/README.md`](../README.md)。

Node 組み込みだけで動く純粋な `.mjs`（`eslint.config.mjs` の読み込み時にも実行されるため）。フォルダに依存しないので、別のフォルダに目録を作るときもそのまま使える。

## API（`catalog.mjs`）

| 関数 | 用途 |
| --- | --- |
| `parseCatalog(text)` | 目録を `{ sections: [{ owner, line, entries: [{ path, description, line }] }], errors }` に読む。最初の `## ` 見出しより前は説明文として読み飛ばす |
| `checkCatalog({ sections, folder, dirs })` | 実在するディレクトリとの不一致・重複・別フォルダのパス・節の重複を、日本語のメッセージ配列で返す（空 = 問題なし） |
| `listDirs(repoRoot, folder)` | フォルダ直下のディレクトリ名（隠しディレクトリを除く） |
| `loadCatalogOwnership({ repoRoot, folder, catalogFile?, ownerId? })` | `{ ownerId, isRoot, ownPaths, upstreamPaths }`。所有者 ID の既定 = 自分の fork の名前（`forkOwnership/forkIds.mjs` の `readForkIdentity`、project.md の `fork_id:`。origin の URL からは導かない）。先頭の節が自分なら `isRoot`。目録が読めない・名前が分からないときは自分の所有なし |

## テスト

`pnpm test:lib-catalog`（`catalog.test.mjs`）= 実リポジトリの `src/lib/CATALOG.md` の検査 + 部品の単体テスト（`fixtures/CATALOG.sample.md`）。
