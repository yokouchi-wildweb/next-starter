# scripts/workflow/agent-terminal(エージェントが動かす端末)

## Overview

エージェントが自分の会話の端末(今は tmux)に 1 行打ち込む道具と、会話の圧縮(compact)の仕組み。

圧縮のやり方は 1 つだけ: スキル `/coffee-break`(`.claude/skills/coffee-break/SKILL.md`)が下の `compactPlan` → 引き継ぎを書く → `compactSelf` を順に行い、圧縮の後に hook が引き継ぎを読み戻す。普通の会話でも、会話を束ねる道具が動かす会話でも同じ手順で、違いは道具が渡す値(下「値の約束」)だけ。

- `pnpm workflow agent-terminal compactPlan` — 圧縮の最初の一歩。この会話の足す手順・引き継ぎの一時ファイルの場所・続きの既定・打つ者を出す
- `pnpm workflow agent-terminal compactSelf [--then continue|wait|none] "<残すこと>"` — エージェントが自分の会話の圧縮を頼む。今の返答が終わったら `/compact <残すこと>` が入力される
- `pnpm workflow agent-terminal afterCompact <continue|wait|none> [--socket=<path> --pane=%<N>]` — `/compact` を自分で打つ道具が、打つ前にそのペインの圧縮の後の 1 行を決める(下「圧縮の後の 1 行」)
- `pnpm workflow agent-terminal open [--cwd=<dir>] [--name=<名前>] [--socket=<名前>] [-- <命令…>]` — スキル `/reinforce`。新しい tmux のタブを、打った人の画面を奪わずに開く(下)
- `pnpm workflow agent-terminal type <宛先> [--socket=<名前>] [--wait=<秒>] [--no-enter] -- <打つ文字>` — スキル `/intervene`。方針 `agent.intervene` が manual で人の 1 回分の許可(`/allow itv`)がある時だけ、別のタブの入力欄に 1 行打つ(Remote Control のつなぎ直し = `/remote-control` を打つ)(下)
- 圧縮の後の続き — 手で打った `/compact`(上の予約も含む)が終わったら、入力欄に 1 行が入力される(人がそう言ったのと同じ。承認の扱いは変わらない)
  - `continue`(既定。人が手で打った `/compact` も): 「必要な情報を読み返して作業を続行。」
  - `wait`(予約で `--then wait` を付けたときだけ): 「必要な情報を読み返して待機。」

端末による分かれ道はこのフォルダの中だけに置く。ルール・CLAUDE.md には端末のことを書かない(エージェントはコマンドの名前だけを知り、使えない端末ではコマンドが代わりの 1 行を出す)。その端末でできることは、その端末で動いているときだけ SessionStart の hook が案内のファイル(`AGENT_TERMINAL.<値>.md`)を文脈に入れる。

## Usage

### `pnpm workflow agent-terminal compactPlan`

- 出す行: `handoff: <一時ファイルのパス>` / `prepare: <足す手順>`(1 行ずつ。無ければ `prepare: none`)/ `then: <continue|wait|none>` / `typed by: <打つ者>` / `next: <compactSelf の 1 行>`
- 足す手順と続きの既定は `AGENT_COMPACT_CONTEXT`(下「値の約束」)から。無ければ足す手順なし・`continue`。読めない・形が違う → `context: ignored — <理由>` を出し、足す手順なしで進む
- 打つ者は `compactSelf` と同じ判断(頼み先 / このペインの待つ役 / ユーザー)
- exit 3 = 会話の id(`CLAUDE_CODE_SESSION_ID`)が分からず、一時ファイルの場所が決まらない

### 引き継ぎの一時ファイル

- 場所: 記録の置き場(下)の `handoff/<会話の id>.md`。会話ごとに 1 つ。エージェントが `compactPlan` の場所に書き(上書き)、`compactSelf` が頭に続きの種類と時刻の 1 行を足す
- 圧縮の後の SessionStart(source が compact)が、端末に関係なく(`AGENT_TERMINAL=none` でも)中身を文脈へ出して消す(一度きり)
- 読まないもの: 空 / 書いて(`compactSelf` が頭を足して)から 6 時間より古い(打たれずに残った物。消す)/ 別の会話の物(ファイル名が会話の id)
- 掃除: どの SessionStart でも、14 日より古い一時ファイルを消す
- 人が手で打った `/compact` で一時ファイルが無ければ、読み戻すものが無いだけ

### `pnpm workflow agent-terminal compactSelf [--then continue|wait|none] "<残すこと>"`

- 打てるとき(`AGENT_TERMINAL=tmux`・tmux の中・下の hook がこのペインで動いている): 裏に待つ役を残し「予約しました…ここで返答を終えてください」と出す。返答が終わると `/compact <残すこと>` が Enter 付きで入力される
- 頼み先があるとき(`AGENT_COMPACT_CMD`、下の「値の約束」): 自分では打たない。そのコマンドを、残すことを env `AGENT_COMPACT_FOCUS` に入れて呼び、その出力をそのまま出す
  - 打ち込むのは端末を持つ道具だけ(その道具の通知・合図の打ち込みとぶつからない)。断るかどうか・いつ打つかもその道具が決める
  - 呼べない・失敗(exit 0 以外): 下の代わりの 1 行を出す
- 打てないとき: 「次の 1 行をユーザーに打ってもらってください: /compact <残すこと>」と出す(exit 0。エラーにしない)
- 引き継ぎの一時ファイルがあれば、頭に `--then` の値と時刻を書く。無くても断らない(圧縮の後に読み戻すものが無いだけ)
- `--then` を省いたときの既定 = `AGENT_COMPACT_CONTEXT` の `then`、無ければ `continue`
- `--then` = 圧縮の後に打つ 1 行の種類。`continue`(既定)= 読み返して続ける / `wait` = 読み返して待つ(区切りで止めて人の指示を待つとき)。ほかの値・値なしは使い方を出して exit 1
  - 待つ役が `/compact` を打てたときだけペインの印 `after` に書く(打たずにやめた予約の印が、後で人が打つ `/compact` の続きを変えないように)。SessionStart の hook がそれを読み、どの start でも消す
  - 頼み先があるとき・打てないときは使わない(後は頼み先の仕組み・既定の続き)
- 残すこと = 圧縮の後に何も読み直さなくても要ること(作業中のファイルのパス、未完了の手順など)を 1〜3 行。改行は空白に直す
- エージェントが直接打つのではなく、`/coffee-break` の最後の一歩として打つ

### `pnpm workflow agent-terminal open [--cwd=<dir>] [--name=<名前>] [--socket=<名前>] [-- <命令…>]`

- 新しい tmux のセッションを切り離して(`-d`)作り、cwd(既定は今の場所)で命令を走らせる。attach も switch-client もしない(打った人の画面はそのまま)
- 命令: 既定 = `claude --remote-control <名前>`(新しい通常セッション、Remote Control つき)/ `--` の後 = その命令(議会・チームの起動など。この道具はチームを知らない)。命令が終わってもタブは残る(`(命令が終わりました: exit <n>)` の後にシェル)
- サーバー: `--socket=<名前>` = `tmux -L <名前>` / 呼んだ会話が tmux の中 = 同じサーバー / ほか(`AGENT_TERMINAL=none` も)= 既定のサーバー
- 名前: `--name`、無ければ cwd のフォルダ名(英数と `._-` だけ)。そのサーバーに同じ名前があれば `-2`、`-3` …
- 出す 1 行: `open: 開きました — <サーバー> のセッション <名前>(…)。見る: <サーバー> attach -t <名前>`
- tmux が無い: 開かず `open: tmux が無いので開いていません。人が新しい端末で打つ 1 行: cd <場所> && <命令>`(exit 3)
- 終了コード: 0 = 開いた / 1 = 使い方の誤り / 3 = 開けない

### `pnpm workflow agent-terminal type <宛先> [--socket=<名前>] [--wait=<秒>] [--no-enter] -- <打つ文字>`

- 方針: 呼んだ所のチェックアウトの `repo.json` の `agent.intervene`(off / manual、既定 manual、`scripts/workflow/devcheck/README.md`「方針」)。off → 打たず人の 1 行(exit 4)| manual → 人の 1 回分の許可 `itv`(`/allow itv` か言葉の許可、`.agent/devcheck-allow.json`)が無ければ打たない(exit 4)。別のセッションの連絡は許可にならない
- 宛先からペインを 1 つに決める: `%<N>`(ペイン)/ `<セッション>[:<窓の番号か名前>]`(見えているペイン)/ ほか = 会話の名前(`claude agents --json` の名前、peer と同じ)→ その会話の id を印 `session` に持つペイン(下「記録の置き場」、`AGENT_TERMINAL=tmux` の会話だけ)
- 探す所: `--socket=<名前>` のサーバー、省けばこのユーザーの全サーバー(`$TMUX_TMPDIR` か `/tmp` の `tmux-<uid>/`)
- 宛先が 2 つ以上・無い・tmux の外 → 打たず、候補か「そのタブで「<打つ文字>」と打ってください」(exit 3、許可は残る)
- 宛先が決まったら許可 `itv` を使って消し(次の人の入力でも消える: devcheck の hook)、入力欄が空で作業中の表示(`esc to interrupt`)が無い時だけ打つ(待つ役と同じ確かめ、`--wait` 秒・既定 120 まで。打てなければ exit 3)。`--no-enter` = Enter を押さない
- 打つ文字が `/remote-control` なら、打った後 8 秒まで画面に `rc active` を探し、出た / まだ出ない(狭い画面では出ないことがある)を 1 行で
- 結果はそのペインの `typein.log`(`intervene`)に 1 行。許可の言葉と使ったことは `.agent/devcheck-allow.json` の流れ(/allow)に残る
- 終了コード: 0 = 打った / 1 = 使い方の誤り / 2 = 方針が読めない / 3 = 打たなかった / 4 = 方針 off・許可が無い

## API

### 値の約束(会話を束ねて動かす道具が渡す)

会話を束ねて動かす別の道具は、次の値をセッションの環境変数に入れる。鍵にどの道具の名前も入れない。呼ばれるたびに読む。

| 鍵 | 値 | 意味 |
|---|---|---|
| `AGENT_TERMINAL` | `tmux` | その会話は tmux のペインで動く(道具が自分のタブに明示して入れる。人の `export AGENT_TERMINAL=none` を持ち込まない) |
| `AGENT_COMPACT_CMD` | `<実行ファイル> [引数…]`(空白で区切る。引用符は使えない) | `compactSelf` の頼み先。残すことを env `AGENT_COMPACT_FOCUS`、引き継ぎの一時ファイルの場所を env `AGENT_COMPACT_HANDOFF` に入れて呼ぶ。`--then` の値を env `AGENT_COMPACT_THEN` に入れる(頼み先は `/compact` を打つ前に afterCompact で印に書く)。出力はそのままエージェントに見せる。exit 0 以外 = 渡せなかった |
| `AGENT_COMPACT_CONTEXT` | `<絶対パス>` | 圧縮の文脈ファイル(下)。`compactPlan` と `compactSelf` が呼ばれるたびに読む(道具は起動の後も書き直してよい) |

- 値が無い = 単体(`AGENT_TERMINAL` は default.conf、頼み先なし)
- `AGENT_COMPACT_CMD` は `AGENT_TERMINAL` と独立に効く(tmux の中でも頼み先が先)

### 圧縮の文脈ファイル(`AGENT_COMPACT_CONTEXT`)

版つきの key=value(1 行 1 つ、`#` から後は注釈)。鍵にどの道具の名前も入れない。

```
v=1                         # 版(必須。読めるのは 1)
prepare=<足す手順の 1 行>    # 引き継ぎを書く前にエージェントが行う手順(繰り返してよい。compactPlan がそのまま出す)
then=continue|wait|none     # 圧縮の後の続きの既定(compactSelf の --then を省いたとき)
```

- 知らない鍵・値、版が違う → ファイル全体を使わない(`compactPlan` が `context: ignored` を出す)

### 圧縮の後の 1 行(印 `after`)

- 値: `continue`(既定、読み返して続ける)/ `wait`(読み返して待つ: 人がこの圧縮について今は待てと言った時だけ。答え待ち・承認待ちの途中は `continue` のまま、続けた後に待っていた問いを出し直す)/ `none`(何も打たない)| 無い・知らない値 = `continue`
- 書くのは `/compact` を打つ者だけ、打つ直前に: 待つ役(`compactSelf --then`)、または `/compact` を自分で打つ道具(`pnpm workflow agent-terminal afterCompact <値> --socket=<path> --pane=%<N>`、頼み先なら受けた `AGENT_COMPACT_THEN`)| 道具が決めずに打った `/compact` は人が打ったのと同じ(`continue`)
- 次の SessionStart(どの source でも)で消える | 書くのは記録の置き場(下)のペインごとの印で、どのチェックアウトから書いても同じ

## Extension

### 入り切り: `AGENT_TERMINAL`

この会話が tmux を使うかの値(どの道具が会話を動かしているかの印ではない)。端末に頼る道具はすべてこの 1 つの値で入り切りする(`pnpm workflow dev-tab run` もこの値でタブか裏のプロセスかを決める)。

| 値 | 意味 |
|---|---|
| `tmux` | tmux のペインに打ち込む(tmux の外で動いている会話には何もしない) |
| `none` | 人が tmux を使わないと決めた。打ち込まない。hook は記録もしない(圧縮の後の引き継ぎの読み戻しだけは行う)、`pnpm workflow agent-terminal compactSelf` は代わりの 1 行を出す |

- 読む順: プロセスの環境変数 `AGENT_TERMINAL` → `scripts/workflow/agent-terminal/default.conf`(git に入るプロジェクトの既定値。今は `tmux`)
- 無い・知らない値 = `none`
- 人ごとに切る: シェルの設定で `export AGENT_TERMINAL=none`(hook とスクリプトは Next の `.env*` を読まない)
- 別の端末に対応するときは値を 1 つ足す(on/off ではなく端末の名前)

### 案内のファイル `AGENT_TERMINAL.<値>.md`

- 値ごとに 1 つ(`none` には無い)。別の端末に対応するときは値と一緒に 1 つ足す
- 中身 = その端末でエージェントができること(自分の圧縮 = `/coffee-break`・`pnpm workflow dev-tab run`・よい使い方)。エージェント向けに短く、経緯は書かない
- `.claude/rules/` の外に置く(Claude Code が自動で読み込まない。その端末のときだけ hook が入れる)

## Internals

### hook(`.claude/settings.json`)

`node scripts/workflow/agent-terminal/hook.mjs <start|busy|stop|precompact>` を SessionStart / UserPromptSubmit / Stop / PreCompact に登録している。

`hook.mjs` は hook が呼ぶ入口(手で打たない)。`pnpm workflow agent-terminal` の一覧には動作として出るが、`pnpm workflow agent-terminal hook` で打つ物ではない。

- 記録するもの(ペインごと): 今そのペインにいる会話の id、返答の始まりと終わりの時刻、圧縮の起こり方(手で打った / 自動)
- 手で打った圧縮の後(SessionStart の source が compact で、直前の PreCompact が manual)だけ、続きの待つ役を残す(打つ 1 行は印 `after` で選ぶ。上の `--then`)。返答の途中で起きる自動の圧縮はそのまま続くので打たない。印 `after` が `none` なら残さない
- 標準出力に出すのは 2 つだけ(UserPromptSubmit / SessionStart の出力は文脈に入るため): `AGENT_TERMINAL=tmux` で tmux の中のときの SessionStart(どの source でも。圧縮の後も入れ直す)の案内 `AGENT_TERMINAL.tmux.md` と、圧縮の後の引き継ぎ(端末に関係なく。上「引き継ぎの一時ファイル」)。標準エラーにも出さず、失敗しても黙って exit 0
- 記録・案内・待つ役をしないとき: `AGENT_TERMINAL` が `tmux` でない(`none` = 人が切った)/ tmux の外

### 待つ役(lib.waiter.mjs)の決まり

- 打つのは、入力欄が画面にあって空のときだけ(Claude Code が薄く描く案内は空とみなす)。人の下書き・確認の画面・作業中の表示(`esc to interrupt`)には打たない
- やめるとき(打たない): そのペインの会話が変わった(`/clear`・別の claude)/ ペインが無くなった / 同じ種類の新しい予約に代わった / 人が自分の言葉を送った / 入力欄が空かないまま `AGENT_TERMINAL_WAIT` 秒(既定 600)
- 結果は 1 行ずつ記録の `typein.log` に残る(`typed` / `skip: <理由>` / `wait: <理由>`)

### 記録の置き場

`${XDG_STATE_HOME:-~/.local/state}/next-starter/agent-terminal/`(ペインの印は `panes/<socket のハッシュ>_<ペイン番号>/`)(リポの外。本体とワークツリーで共通。ペインの記録なのでどのチェックアウトから打っても同じ所を見る)

- `handoff/<会話の id>.md` = 引き継ぎの一時ファイル(ペインではなく会話ごと)
- `session` / `busy` / `idle` / `precompact` = hook の印、`after` = 圧縮の後の続きの種類(待つ役が書き、hook が消す)、`lock.<種類>` = 動いている待つ役、`typein.log` = 打ち込みの記録

## Verification

- `pnpm test scripts/workflow/agent-terminal/agentTerminal.test.mjs`(値の読み方、文脈ファイルの読み方と `compactPlan` の出力、引き継ぎの一時ファイル(頭の 1 行・一度きりの読み戻し・古い物と空の物・掃除・端末なしでも読み戻す)、`pnpm workflow agent-terminal compactSelf` の道(頼み先・失敗・待つ役・代わりの 1 行)と `--then`、圧縮の後の続行 / 待機の打ち分け、hook の出力(案内は tmux の中の SessionStart だけ)、案内のファイルが値ごとにあること、入力欄の読み取り、tmux があれば一時の tmux サーバーで偽の入力欄に打ち込む通し)
