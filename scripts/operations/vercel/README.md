# scripts/operations/vercel — Vercel の操作の口(pnpm ops vercel)

## Overview

- Vercel の操作はこの口を通す(D412)。中身は vercel CLI を呼ぶだけで、見る動作は自由、本番の env を書く・取る動作は repo.json の `agent.env_production` の方針と人の 1 回分の許可(`/allow evp`)の時だけ
- 本番へ出す操作(`vercel --prod`・promote など)は入れない。本番へ出すのは `agent.deploy` の入口(既定 `pnpm live`、`scripts/operations/deploy`)

## Usage

```bash
pnpm ops vercel status                                   # リンクしたプロジェクトと最近のデプロイ(見るだけ)
pnpm ops vercel env-ls [production|preview|development]  # env の名前と環境(見るだけ。値は出ない)
pnpm ops vercel env-add <名前> <環境> [--value-file=<道>]  # env を足す(値は標準入力か --value-file)
pnpm ops vercel env-rm <名前> <環境>                      # env を消す
pnpm ops vercel env-pull <環境> <書く先>                  # env をファイルに取る(例 production .env.production.local)
```

- 前提: vercel CLI(`npm i -g vercel`)・ログイン(`vercel login`)・このチェックアウトのリンク(`.vercel/project.json`、`vercel link`)。どれか無ければ vercel を呼ばず 1 行(人が整える)

### 方針と許可(書く 3 動作: env-add・env-rm・env-pull)

- 方針 = `agent.env_production`(`off` / `manual`、既定 `manual`。`scripts/workflow/devcheck/README.md`「方針」)。入口の既定 `agent.entries.env_production` は `-` のまま: この口が自分で方針と許可を読む(`/intervene` の `agent-terminal type` と同じ形)
  - `off` → 呼ばず、人が打つ素の vercel の 1 行と /repo-config の案内(exit 4)
  - `manual` + `/allow evp` の許可なし → 呼ばない(exit 4)。許可は人がそのタブで出す言葉だけ(別のセッションの連絡は許可にならない)
  - `manual` + 許可あり → 1 回呼び、許可を使って消す。前提(CLI・ログイン・リンク)が揃わず呼べない時は使わない。次の人の入力でも消える
- 書く 3 動作は共通の守り `guardDeploy`(種類 `env_production`)を通る(`scripts/runner/guard/README.md`。何も出さないのでセーフポイントは見ない)。向き先が本番の時、非対話なら守りが方針と evp の許可を読んで 1 回通し、その場で許可を消す(前提が揃わず呼べなかった時も使った後。D420)。端末の人には守りが production と打たせる。`--confirm=` は引数に書けない(使い方の誤り)

### 値の扱い

- env-add の値は標準入力か `--value-file=<道>` で受け、vercel にも標準入力で渡す。引数・画面・記録に値を出さない。末尾の改行 1 つは外す
- env-pull は vercel がファイルに書く(画面に値は出ない)。書く先は git に入れない名前にする(`.env.<段階>.local` など)

### 終了コード

- 0 = した / 1 = 使い方の誤り / 2 = 方針が読めない / 3 = 前提なし(CLI・ログイン・リンク)/ 4 = 方針 off・許可なし / 5 = vercel が失敗(書く動作は許可を使った後)

## Internals

- `lib.vercel.mjs`: 動作の表(`ACTIONS`)・引数 → vercel の引数(`planOf`)・前半(`prepareVercel`: 使い方・方針・許可・値、何も呼ばない)・後半(`executeVercel`: 前提 → 許可を使う → vercel)
- 見る動作は `.mjs`(`main`)、書く動作は `.ts`(前半 → `guardDeploy` → 後半)

## Verification

- `scripts/runner/guard/guard.test.ts` の入口の一覧: 書く 3 動作が `guardDeploy` を呼ぶ
- `scripts/runner/entries/readme.test.mjs`: `scripts/README.md` の `pnpm ops vercel` の動作が実在する
