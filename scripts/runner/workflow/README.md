# scripts/runner/workflow — 開発の進め方の道具の入口(pnpm workflow)

```
pnpm workflow                         # 対象と動作の一覧
pnpm workflow <対象>                  # その対象の動作の一覧
pnpm workflow <対象> <動作> [<引数>...] # 動作を起動(引数はそのまま渡す)
```

- 対象 = `scripts/workflow/<対象>/`(fork が直下に足したフォルダも同じ規則で拾う)
- 動作 = そのフォルダの直下の `<動作>.mjs` / `.js` / `.ts`(`.ts` は tsx、ほかは node で起動)。`*.test.*` と `lib.*`(部品の置き場)は動作にならない
- 終了コードは動作のもの。省くと一覧(exit 0)、知らない対象・動作は止める(exit 2)
- 例: `pnpm workflow worktree new <branch>` / `pnpm workflow notices shippedIndex verify` / `pnpm workflow dev-tab run stop`
- 旧いコマンド名(`pnpm worktree:new`・`pnpm dev:tab`・`pnpm notices:pick-check` など)は package.json の整理まで残る
- 門に乗る検査(gate.json)は `pnpm check`(`scripts/runner/gates/README.md`)。この入口は検査を回す場所ではない
- テスト: `pnpm test:workflow`(`workflow.test.mjs`)
