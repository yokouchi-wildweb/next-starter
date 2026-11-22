# scripts/runner/entries — 道具の入口(pnpm workflow / pnpm ops)

## Overview

- `pnpm workflow`(開発の進め方の道具、`scripts/workflow/`)と `pnpm ops`(手で使う操作・閲覧の道具、`scripts/operations/`)の入口
- 段階に乗る検査(phase.json)は `pnpm check`(`scripts/runner/phases/README.md`)。この入口は検査を回す場所ではない

## Usage

```
pnpm workflow | pnpm ops                         # 対象と動作の一覧
pnpm workflow <対象> | pnpm ops <対象>           # その対象の動作の一覧
pnpm workflow <対象> <動作> [<引数>...]           # 開発の進め方の道具(scripts/workflow/)
pnpm ops <対象> <動作> [<引数>...]                # 手で使う操作・閲覧の道具(scripts/operations/)
```

- 例: `pnpm workflow worktree new <branch>` / `pnpm workflow notices pickCheck <commit>` / `pnpm ops db inspect tables` / `pnpm ops features list`
- 終了コードは動作のもの。対象・動作を省くと一覧(exit 0)、知らない種類・対象・動作は止める(exit 2)

## Internals

- 対象 = `scripts/workflow/<対象>/` / `scripts/operations/<対象>/`(fork が直下に足したフォルダも同じ規則で拾う)
- 動作 = そのフォルダの直下の `<動作>.mjs` / `.js` / `.ts`(`.ts` は tsx + server-only の下駄、ほかは node で起動)
- 動作にならない物 = `*.test.*`・`lib.*`・そのフォルダの `phase.json` が名指す段階の入口(`check` / `generate`。`pnpm check` / `pnpm generate` で呼ぶ)・下のフォルダの中。動作の間で共有する部品はここに置く(例 `operations/db/clear/plan.ts`・`operations/storage/iam/`)

## Verification

- `pnpm test scripts/runner/entries/entries.test.mjs`

## Related

- 置き場の決まり: `.claude/rules/core/scripts.md` placement
- 段階と検査: `scripts/runner/phases/README.md`
