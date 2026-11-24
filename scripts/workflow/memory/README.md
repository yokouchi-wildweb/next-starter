# scripts/workflow/memory(pnpm workflow memory)

## Overview

- Claude Code の auto-memory(このリポの memo の置き場)を `/meditate` のために扱う命令。メモリーの定義は CLAUDE.md DOCS `memory`(作業途中の引き継ぎだけ)
- `facts` は memo ごとの事実を 1 件 1 行で出す(読むだけ、判断しない)。`header` は MEMORY.md の先頭の固定の区画を正本と比べ、指定したときだけ正本に戻す

## Usage

```bash
pnpm workflow memory facts [--dir <path>]            # 事実を 1 件 1 行(何も書かない)
pnpm workflow memory header [--dir <path>]           # 先頭の区画の状態と、正本との差分を見せる(何も書かない)
pnpm workflow memory header --apply [--dir <path>]   # 区画の中だけを正本に戻す(無ければ先頭に足す)
```

- `--dir` = 置き場を直に指す(Claude Code の設定 autoMemoryDirectory で置き場を変えているとき)
- 終了コード: 0 = 出した・書いた(置き場が無い時は `none` を出して何もしない)| 2 = 引数の誤り・正本が読めない・区画の印が壊れている(何も書かない)

## API

`facts` の出力:

- 1 行目 `dir: <置き場>`、2 行目 `header: ok|missing|differs|broken|no-index`、3 行目 `memos: <件数>`
- memo 1 件 1 行: `<ファイル名> | type:<type か -> | handoff:<state,next,end,date の有無、無い所は -> | date:<YYYY-MM-DD>(meta|body|mtime) | refs:<在る数>/<全数>[ gone:<無い物>] | same:<数>[ <path:line>] | index:yes|no`
- 最後に `index-only: <名>`(MEMORY.md にリンクがあり、ファイルが無い物)
- 一覧は 3 件まで出し、それより多いと `…` を付ける

各項目の意味:

- type: frontmatter の `metadata.type`(古い形の最上位 `type` も)
- handoff: 本文か frontmatter の `state:` `next:` `end:` `date:` の行が在るか(満たされているかは見ない。終わりの条件の確かめは `/meditate` の側)
- date: frontmatter の `modified` → 本文の `date:` → ファイルの更新時刻の順
- refs: 本文のパスらしい語(`/` を含み、拡張子か `~/` `/` `./` `../` の始まりか `/` の終わり)とコミットらしい語(7〜40 桁の 16 進で数字と a-f の両方を含む)の実在。相対のパスはこのリポの作業木の根から解く(ほかのリポの相対のパスは無いと出る)
- same: 本文の 20 字以上の行と同じ文字列を持つ、このリポの追跡ファイルの行(字面の一致だけ。言い換えは拾わない)
- index: MEMORY.md に `](<ファイル名>)` のリンクが在るか

区画:

- 正本 = `.claude/skills/meditate/header.md`。`<!-- meditate:header` で始まる行から `<!-- /meditate:header -->` の行まで
- 状態: ok = 字面が同じ | missing = 印が無い | differs = 中身が違う | broken = 印が片方だけか 2 つ以上 | no-index = MEMORY.md が無い

## Internals

- 置き場 = `<CLAUDE_CONFIG_DIR か ~/.claude>/projects/<本体のチェックアウトの道の英数字以外を - にした名>/memory`。本体の道 = `git rev-parse --git-common-dir` の親なので、ワークツリーから走らせても本体と同じ置き場(Claude Code はメモリーを git の本体ごとに持ち、ワークツリーと共有する)
- `header --apply` は区画の外を変えない。MEMORY.md が無ければ区画だけで作る。区画の印が壊れているときは書かずに止める
- 道・frontmatter・参照の実在・同じ行の部品は `scripts/workflow/context/lib.lines.mjs`(`pnpm workflow context facts` と共有)
- 書くのは `header --apply` の MEMORY.md だけ。memo の移動・書き出しは `/meditate` が承認の後に行う

## Verification

- `pnpm test scripts/workflow/memory/memory.test.mjs`(/sluice の検査が回す)

## Related

- `/meditate`(`.claude/skills/meditate/SKILL.md`): この命令の出力で片付ける
- メモリーと個人の置き場の定義: CLAUDE.md DOCS `memory` / `personal`
- `scripts/workflow/context/README.md`: 文脈の行の事実(部品を共有)
