# scripts/structure/lockfile — pnpm-lock.yaml の生成器の宣言

## Overview

- `pnpm-lock.yaml` を、ほかの生成物と同じ形の宣言(`phase.json` の `generate` と `outputs`)で持ちます。作り方は `pnpm install`(package.json から pnpm が作る)で、手で直しません。
- 可変域の一覧(`src/lib/forkOwnership/intake.txt`)の `generated pnpm-lock.yaml` の行は、この宣言から生成区画に書かれます(手書きの行は持ちません)。

## Usage

```
pnpm generate lockfile
```

- 段階 ship の生成(`pnpm generate --phase=ship`、/flux の区間の作り直しの `--range` 付きも)では、段階の一覧 `scripts/runner/phases/phases.json` の `first` により、ほかの生成器より先に回ります
- watch = package.json・pnpm-lock.yaml・pnpm-workspace.yaml(当たらなければ飛ぶ)。新しい lock なら何も変わりません

## Related

- 段階の仕組み: `scripts/runner/phases/README.md`
