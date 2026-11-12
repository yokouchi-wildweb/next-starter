# scripts/workflow/repo-json(pnpm workflow repo-json)

リポ直下の `repo.json`(機械用の値: リポの名前・段・エージェントに任せる方針)を読む・書く命令。形と読み手は `src/lib/forkOwnership/forkIds.mjs`(説明: `src/lib/forkOwnership/README.md`「リポの名前と段(repo.json)」)。ここは書く側だけを持つ。

## コマンド

```bash
pnpm workflow repo-json show                    # 中身と、読み手の読んだ名前・段・下流の有無・誤り(誤りがあれば exit 2)
pnpm workflow repo-json get <鍵>                # 1 つの値(無い = 空行と exit 1)
pnpm workflow repo-json set <鍵> <値>           # 1 つの鍵を書く(true / false は真偽値、ほかは文字列)
pnpm workflow repo-json migrate [--tier root|middle|leaf] [--dry-run]   # 古い形(project.md の 2 行)から移す
```

## 決まり

- 形: 平らな鍵を 1 鍵 1 行(リポの外の sh も grep で読める)、値は文字列か真偽値だけ。鍵 = `repo_id`・`tier`・`agent.<種類>`
- `set` は読み手と同じ決まりで確かめてから、ファイル全体を 1 鍵 1 行の形に書き直す(鍵の並び = repo_id・tier・ほかは名前順)。誤り(知らない鍵・形違いの名前・知らない段・今のファイルが読めない)は何も書かず exit 2
- `migrate`: `.claude/rules/project.md` の `fork_id:` / `downstream:` の行を読み、`repo.json` に書いて、その 2 行を project.md から消す
  - 段: `downstream: none` = `leaf` / `yes` = 自分の名前が `src/lib/CATALOG.md` の先頭の節なら `root`、ほかは `middle`
  - `downstream:` が無い・読めない = 止める(exit 2)。段を人が決めて `--tier` を付けてもう一度
  - 今の `repo.json` のほかの鍵は残す
- 書くのはこの命令と、それを使う道具(`/fork-init`)だけ

## 終了コード

- 0 = 出した / 書いた | 1 = get の鍵が無い | 2 = 誤り(1 行で理由、何も書かない)

## ファイル

- `lib.mjs`(読む・書く・移す)・動作 `show.mjs`・`get.mjs`・`set.mjs`・`migrate.mjs`
- テスト: `pnpm test scripts/workflow/repo-json`(一時のフォルダだけに書く)
