# scripts/workflow/repo-json(pnpm workflow repo-json)

## Overview

- リポ直下の `repo.json`(機械用の値: リポの名前・段・エージェントに任せる方針)を読む・書く命令。形と読み手は `src/lib/forkOwnership/forkIds.mjs`(説明: `src/lib/forkOwnership/README.md`「リポの名前と段(repo.json)」)。ここは書く側だけを持つ。

## Usage

```bash
pnpm workflow repo-json show                    # 中身と、読み手の読んだ名前・段・下流の有無・誤り(誤りがあれば exit 2)
pnpm workflow repo-json get <鍵>                # 1 つの値(鍵は点の道: agent.server・agent.entries.deploy・vercel.plan。無い = 空行と exit 1)
pnpm workflow repo-json set <鍵> <値>           # 1 つの鍵を書く(true / false は真偽値、ほかは文字列)
pnpm workflow repo-json unset <鍵>              # 1 つの鍵を消す(repo_id・tier は消せない、無い鍵は何もしない)
pnpm workflow repo-json migrate [--tier root|middle|leaf] [--dry-run]   # 古い形(平らな repo.json・project.md の 2 行)から移す。2 回目は何もしない
```

終了コード:

- 0 = 出した / 書いた | 1 = get の鍵が無い | 2 = 誤り(1 行で理由、何も書かない)

## API

repo.json の形:

- 形: 入れ子(D312)、1 鍵 1 行、値は文字列か真偽値だけ、配列なし。組は 1 段(`entries` だけ `agent` の中)。呼び方は点の道
  ```json
  {
    "repo_id": "next-starter",
    "tier": "root",
    "agent": { "server": "auto", "db_push": "manual", "entries": { "deploy": "pnpm live" } },
    "vercel": { "plan": "pro" }
  }
  ```
  (書き手は 1 鍵 1 行に開いて書く)
- 鍵: 一番上 = `repo_id`・`tier`(身元)/ `agent.<種類>`・`agent.enabled`・`agent.intervene`(エージェントに任せる方針)・`agent.entries.<db_push|env_production|deploy|deploy_db>`(危険な 3 つの入口の命令。一覧と既定は `scripts/workflow/devcheck/README.md`「方針」)/ `vercel.plan`(Vercel の契約のプラン `hobby` | `pro`。Vercel にデプロイするリポだけ持つ、`pnpm generate cron` が読む)
- 読み手(`forkIds.mjs` の `parseRepoJson`)は入れ子だけを読み、呼び手へは点の道の表(`agent.server` など)で返す。平らな形(一番上の点の入った鍵)は `pnpm workflow repo-json migrate` を案内して止める(過去の版の名前を読む所は身元だけ読む)
- 消せない鍵 = `repo_id`・`tier`(`unset` は `vercel.plan`・`agent.*` だけ)

## Internals

- 直接の書き換え(Edit / Write・シェルの書き込み)は許可のフックが止める。人が値を変える入口は `/repo-config`(repo.json 全体を組ごとに見せ、変える値と効き先を見せて確認の後にこの命令で書く)
- `set` は読み手と同じ決まりで確かめてから、ファイル全体を入れ子の 1 鍵 1 行に書き直す(並び = repo_id・tier・組 agent(鍵の名の順、entries は最後)・組 vercel)。誤り(知らない鍵・形違いの名前・知らない段・今のファイルが読めない)は何も書かず exit 2
- `unset` は 1 つの鍵を消して同じ形で書き直す(set の対。廃止した方針の鍵を fork が外す時など)。`repo_id`・`tier` と知らない形の鍵は何も書かず exit 2、無い鍵は何もせず exit 0
- `migrate`(1): 平らな `repo.json` を入れ子へ。入口の鍵 `agent.<種類>.entry` → `agent.entries.<種類>`、`agent.deploy.db_entry` → `agent.entries.deploy_db`、廃止した `agent.check`・`agent.test` は落とす(出力に名前を出す)、知らない鍵は何も書かずに止める。2 回目は何も書かない
- `migrate`(2): `.claude/rules/project.md` の `fork_id:` / `downstream:` の行を読み、`repo.json` に書いて、その 2 行を project.md から消す
  - 段: `downstream: none` = `leaf` / `yes` = 自分の名前が `src/lib/CATALOG.md` の先頭の節なら `root`、ほかは `middle`
  - `downstream:` が無い・読めない = 止める(exit 2)。段を人が決めて `--tier` を付けてもう一度
  - 今の `repo.json` のほかの鍵は残す
- 書くのはこの命令と、それを使う道具(`/fork-init`)だけ
- 部品 `lib.mjs`(読む・書く・消す・移す)と動作 `show.mjs`・`get.mjs`・`set.mjs`・`unset.mjs`・`migrate.mjs`

## Verification

- `pnpm test scripts/workflow/repo-json`(一時のフォルダだけに書く)
