# scripts/workflow/repo-paths

## Overview

- リポの名(`repo.json` の `repo_id`)を名前に持つファイル・フォルダが、リポ自身の記録の決まった所の外に無いかを見る段階 `ship` の検査です(D308)
- 決まり: CLAUDE.md CHANGE_TYPES `design_check`(リポの名を付けた置き場は作らない)・`.claude/rules/core/ownership.md` `repo_records`(リポの名の記録は変更形式ではなく、置き場の手本にしない)
- Tier1 だけで回します。fork では業務の名とリポの名が紛れるので掛けません(1 行で飛ばす)

## Usage

```
pnpm check repo-paths
```

- exit 0 = 通る(fork は飛ばす)/ 1 = 記録の所の外にリポの名のパスがある(パスを並べる)
- 直し方: リポの名を付けない置き場にする(下のリポが書く所なら、どの変更形式か決めて宣言する: CLAUDE.md CHANGE_TYPES `design_check`)

## API

- `carriesRepoName(path, id)`(lib.mjs): パスのどれかの段が名そのもの・`<名>.…`・`….<名>.…`・`…--<名>--…`(名の一部だけの `my-next-starter` などは当てない)
- `repoNamedProblems(paths, ids)`(lib.mjs): 記録の所 `REPO_RECORD_PLACES`(`.notices/applied/<repo_id>.md`・`.fork-ownership/<repo_id>.permits.txt`・`docs/journal/<date>--<owner>--<slug>.md`)の外で名を持つパス

## Internals

- 見るのは `git ls-files`(追跡中のパス)。watch = Tier1 の名(`next-starter`)を含むパス・このフォルダ・`repo.json`・`forkIds.mjs`: リポの名のパスを足す・動かす変更でだけ回る(段階 ship の対象は全部 watch を持つ、`scripts/runner/phases/README.md`)。Tier1 の `repo_id` を変える時は watch の名も直す
- CATALOG の節の見出しと依頼の受け箱(`~/.local/state/next-starter/orders/<repo_id>/`)もリポの名の記録だが、前者はファイルの中身、後者はリポの外なので見ない

## Verification

- `pnpm test scripts/workflow/repo-paths/repoPaths.test.mjs`
