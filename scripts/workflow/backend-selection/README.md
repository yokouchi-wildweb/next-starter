# backend-selection — バックエンドの選択表を埋める・選ぶ・見る

## Overview

- 根の `backend-selection.json`(口 → 実装の名前、型 5 self、どのリポも必ず持つ。Tier1 の版は `{}`)を書く唯一の入口
- 口・選べる名前・任意か(`none` を選べるか)・今の設定の読み方(`compat`)は選ぶ点の宣言から読む(`scripts/structure/extensions/README.md`「選ぶ点」)
- 止める判定は持たない: 表を書いてから生成器の検査(`planExtensions`)を回し、書く前に無かった問題が出たら表を元に戻して止める。書く前からある問題は警告として出す(命令のせいにしない)
- env は手元の `.env`・`.env.development`・`.env.production` だけを読み、Vercel は読まない。env の値はどこにも出さない(名前だけ)

## Usage

```bash
pnpm workflow backend-selection fill            # 足りない鍵だけ今の設定から書いて生成する(何度流しても同じ)
pnpm workflow backend-selection set <口> <名前>  # 1 つの口の実装を選んで書き、生成する
pnpm workflow backend-selection show            # 表・口ごとの選べる名前・選んだ実装の足りない env の名前
```

- 取り込みの notice が `fill` を求めたら、その区切りを取った後に 1 回流す。決められない口が残ったら、出た文を人に聞いて `set` で選ぶ
- 選ぶ実装を変える時は `set`。表は手で書かない

## API

### fill

1. 前提(Tier1 は見ない): 台帳 `.notices/applied/<repo_id>.md` に改名の区切りの notice `20261122-180722-district-stage1`(行 `- id:<id> | …`)と `20261124-033209-flux-rebuild` が要る。足りない最初の物の区切り(`district-stage1` → `flux-rebuild`)を先に取るよう出して止める。木の形は見ない
2. 表が無ければ `{}` から始める
3. 表に無い口だけ、選ぶ点の `compat` で名前を読む
   - `{ from: "fixed", value }` → その値
   - `{ from: "env", name, map, default }` → 在るファイルごとに env の値を `map` で名前にする。空・無い → `default`。値が `map` の鍵のどれでもない → その口は書かない(`default` に落とさない)。ファイルの間で名前が違う → その口は書かない
   - 書かなかった口は、理由・選べる名前・`set` の命令の文を出す(終了コード 2)
4. 書いた鍵が 1 つでもあれば(または表を作ったら)表を書き、`pnpm generate extensions` を回し、差分が選択表と生成物だけかを出す
5. env から読んだ口ごとに「本番(Vercel)の `<env 名>` が `<map の鍵 か 未設定>` か確かめる(違えば build が止まる)」の行を出す。値は宣言の `map` の鍵で、手元の env の値ではない
6. 足りない鍵が無ければ何も書かず、生成も回さない

### set <口> <名前>

- 表の 1 つの鍵を書いて生成する。知らない口・知らない名前・`fake`・任意でない口の `none` は生成器の検査が止め、表は元のまま(表が無かったなら作らない)

### show

- 表(無ければ `fill` で作る旨)、口ごとの選んだ実装と選べる名前(任意の口は `none` も)、選んだ実装の宣言の `env.required` のうち手元の 3 つのファイルのどれでも空の名前。`adapter.isConfigured` は呼ばない

### 終了コード

- 0 = 済んだ / 2 = 前提・読めない表・止めた(何も変えていない)・`fill` で決められない口が残った

## Internals

- 動作のファイルは引数を確かめて共有の部品を呼ぶだけ。書く前と後の `planExtensions` の問題を比べ、増えた物だけを命令の止めとする
- 予約名 `none` / `fake` は `src/lib/backends/reserved.ts` を字面で読む(`scripts/structure/extensions/select.mjs` の `readReservedNames`)
- 表は鍵の順に 2 字下げの JSON で書く

## Verification

- `pnpm test scripts/workflow/backend-selection/`(作り物の木の選ぶ点で fill の 2 回目が何も書かない・前提で止まる・ファイルの間の食い違いと map に無い値で止まる・set の止める所と戻し・show が値を出さない)
