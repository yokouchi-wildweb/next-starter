# scripts/workflow/terms — 語の表と誤りの言い換えの検査

## Overview

- 決まった語(日英 1 対 1、英語が正本)の正本 `terms.json` を 1 つ持ち、`pnpm check terms` がその表の「必ず誤りの言い換え」だけを Tier1 の文脈ファイルと Tier1 の道具の中で止めます。
- 表は Tier1 が配って持つ物です(fork は上流のフォルダの中を書きません)。語を足す・変える時はこの表を直します。
- fork の業務の語は見ません。fork では Tier1 の版にあるファイルだけを見ます(fork が足したファイルは対象の外)。
- 2 つの意味を持つ字面(門番の API の `gate`、画面の部品の `Overlays`、置き場の意味の `placement`)は誤りの行に載せません。誤りの行は字面だけで必ず誤りと言える形に限ります。
- 人と agent が読む語の表 `.claude/rules/core/terms.md` は、この正本から `pnpm generate terms` が作る生成物です(置き場と形は文脈の側の決定。文脈を書く時に読み込まれる)。手で直さず、表を直して作り直します。`term-aliases.md`(音声入力の読み替え)とは混ぜません。

## Usage

```
pnpm check terms              # 当たりを「パス:行 誤り → 正しい語(決定)」で出す(段階 ship でも回る)
pnpm check terms -- --json    # 機械向け({ scope, hits, termsMdStale })
pnpm generate terms           # 表から .claude/rules/core/terms.md を作り直す
```

- exit 0 = 当たり 0 / 1 = 当たりあり、または core/terms.md が表と食い違う / 2 = 確かめられない(fork で基準の版が読めない。通過ではない)

## API

- `terms.json` の `terms`: `{ en, ja, meaning, decisions }` の並び。`ja` が `null` の語は日本語が決まっていない(`plug`)か、日本語を持たない名前(`gate`)
- `terms.json` の `wrong`: 誤りの言い換えの行
  - `kind: "text"` = `pattern`(正規表現)を本文で探す / `kind: "identifier"` = `words` を道具のコード(`.mjs`・`.ts` など)の名前として語の境目で探す
  - `in` = `context`(文脈ファイルだけ)・`tools`(道具だけ)・`both`
  - `say` = 正しい語(当たりの出力に出す)・`decisions` = 決めた決定の番号

## Internals

### 見る所と見ない所

- 文脈ファイル: `CLAUDE.md`・`AGENTS.md`・`.claude/rules/**`・`.claude/skills/**`
- 道具: `scripts/**`・`eslint-rules/**`・`eslint.config.mjs`・`package.json`
- 見ない: このフォルダ(表とテストが誤りの字面を持つ)・表から描いた `.claude/rules/core/terms.md`(意味の中に旧い語を「旧: …」として持つ)・名前が `renames.json` のファイル(改名の記録)・バイナリ。出荷済みの notice・`docs/journal` は見る所の外

### 語の表の描き(core/terms.md)

- `lib.terms.mjs` の `renderTermsMd`: frontmatter paths(CLAUDE.md・AGENTS.md・.claude/rules/**・.claude/skills/**)・`# terms` と ROLE・Tier1-owned・生成物の印の行・1 語 1 行 `- <english>: <日本語> | <意味>`(日本語が無ければ `-`)。誤りの行の字面は書かない
- `phase.json` の `outputs` に宣言(生成物の決まり: `.claude/rules/core/generated.md` の paths と `intake.txt` の generated の行)

### 上流と fork

- `repo.json` の `tier` が `root`(Tier1)なら見る所の全部、そうでなければ台帳の最後の `upstream:<sha>` の版にあるパスだけ(`src/lib/forkOwnership/baseFiles.mjs` の `readBaseFiles`)

## Verification

- `scripts/workflow/terms/terms.test.mjs`(作り物のリポで当たる形・2 義の字面・見ない所・fork の絞り・語の表の描きと上流の terms.md の一致)
