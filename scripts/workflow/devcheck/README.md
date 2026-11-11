# scripts/workflow/devcheck(pnpm workflow devcheck)

開発中の確かめの入口の命令。今の版は読むだけ(事実と候補を出す)。実行(run)と片付けは次の版で足す。説明の全体は後の版で書く。

```bash
pnpm workflow devcheck plan [--json]     # 事実(方針・fork の項目・文脈・今の状態)と候補。最後はいつも片付け
pnpm workflow devcheck status [--json]   # 今の状態だけ
```

- 種類と打つコマンドの形 = `lib.ts` の `KINDS`(スキーマの push・本番は種類に無い)
- 方針 = `policy.default.json`(上流、全部 auto)+ `policy.override.json`(fork が足す。上流は出さない)。値 auto | manual | off
- fork の項目 = `items/<名前>.json`(`items/README.md`)
- 文脈 = 環境変数 `DEVCHECK_CONTEXT=<絶対パス>`(版つき key=value: `v=1`・`approval=each|auto`・`server=tab|background`・`dev_max=<n>`・`workdir=<絶対パス>` を繰り返し可)。無い = 単体、あるのに読めない・知らない版・知らない鍵 = 止める(exit 2)
- テスト: `pnpm test scripts/workflow/devcheck`
