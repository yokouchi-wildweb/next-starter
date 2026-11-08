# scripts/workflow/skills — スキルの書式の検査

`.claude/skills/` のスキル(SKILL.md と付属の指示の .md)が、決まり `.claude/rules/core/skills.md` の書式に沿っているかを確かめます。門 ship に乗ります。

```
pnpm check skills [-- --base <rev>]
```

## 何を見るか

形だけを見ます。文の意味(手順の中身)は見ません。

- frontmatter: `name:` がフォルダ名と同じ
- `description:`: 英語(日本語の文字が無い)、`<` `>` が無い、` | ` で区切った「何をするか | いつ使うか」の 2 項目以上、`requires:` は最後の項目で `KEY=value` を `,` で並べる
- `description` と `when_to_use` の字数の合計が 1536 字以内(スキルの一覧はここで切られる)
- 本文と付属の .md: 囲み(```)の中とインラインのコードを除いて日本語の文字が無い、1 行 400 字以内
- `requires:` の鍵: 決まりの `## REQUIRES` の節にある語彙だけ

見ない物: スクリプト(*.mjs)とその出す文字、`agents/*.yaml`、スキルのフォルダの中の README.md(文書なので behavior.md の言語のまま)、`argument-hint`。

## 上流と fork

- Tier1(このリポ)= 全部のスキルが上流。書式を破れば落ちる(exit 1)
- fork = 基準の版(台帳の最後の `upstream:<sha>`、`--base` で上書き)に SKILL.md があるスキルが上流、無いスキルは fork が足した物。fork が足したスキルの誤りと知らない `requires:` の鍵は警告だけ(exit 0)
- 基準の版が読めない fork は exit 2(確かめられない。通ったことにしない)

## 書き直し待ちの一覧(pending.txt)

まだ新しい書式に書き直していないスキルの名前を 1 行に 1 つ書きます。ここにあるスキルは「書き直し待ち」と件数だけ出し、落としません。

- 書き直したらその行を消す。書式を満たしているのに一覧に残っていると「外す」と案内する
- 無いスキルの名前が残っていると落とす
- 上流の持ち物。全部書き直し終えたら空になる

## ファイル

- `check.mjs` — 入口(門 ship・`pnpm workflow skills check`)
- `lib.skillFormat.mjs` — 書式を確かめる部品
- `pending.txt` — 書き直し待ちの一覧
- `skills.test.mjs` — テスト(`pnpm test scripts/workflow/skills/skills.test.mjs`)
