# scripts/workflow/agent-terminal(エージェントが動かす端末)

エージェントが自分の会話の端末(今は tmux)に 1 行打ち込む道具。今あるのは 2 つ:

- `pnpm workflow agent-terminal compactSelf [--then continue|wait] "<残すこと>"` — エージェントが自分の会話の圧縮を頼む。今の返答が終わったら `/compact <残すこと>` が入力される
- 圧縮の後の続き — 手で打った `/compact`(上の予約も含む)が終わったら、入力欄に 1 行が入力される(人がそう言ったのと同じ。承認の扱いは変わらない)
  - `continue`(既定。人が手で打った `/compact` も): 「必要な情報を読み返して作業を続行。」
  - `wait`(予約で `--then wait` を付けたときだけ): 「必要な情報を読み返して待機。」

端末による分かれ道はこのフォルダの中だけに置く。ルール・CLAUDE.md には端末のことを書かない(エージェントはコマンドの名前だけを知り、使えない端末ではコマンドが代わりの 1 行を出す)。その端末でできることは、その端末で動いているときだけ SessionStart の hook が案内のファイル(`AGENT_TERMINAL.<値>.md`)を文脈に入れる。

## 入り切り: `AGENT_TERMINAL`

エージェントがどの端末を動かすかの値。端末に頼る道具はすべてこの 1 つの値で入り切りする(`pnpm workflow dev-tab run` も後でこの値に乗る)。

| 値 | 意味 |
|---|---|
| `tmux` | tmux のペインに打ち込む(tmux の外で動いている会話には何もしない) |
| `none` | 何もしない。hook は記録もせず、`pnpm workflow agent-terminal compactSelf` は代わりの 1 行を出す |

- 読む順: プロセスの環境変数 `AGENT_TERMINAL` → `scripts/workflow/agent-terminal/default.conf`(git に入るプロジェクトの既定値。今は `tmux`)
- 無い・知らない値 = `none`
- 人ごとに切る: シェルの設定で `export AGENT_TERMINAL=none`(hook とスクリプトは Next の `.env*` を読まない)
- 別の端末に対応するときは値を 1 つ足す(on/off ではなく端末の名前)

## 値の約束(端末を持つ別の道具が渡す)

エージェントの端末を別の道具(会話を束ねて動かす道具など)が持つとき、その道具はこの値をセッションの環境変数に入れる。鍵にどの道具の名前も入れない。呼ばれるたびに読む。

| 鍵 | 値 | 意味 |
|---|---|---|
| `AGENT_TERMINAL` | `none` | 端末は別の道具が持つ。hook は記録も案内もせず、ここからは何も打たない(人が切る時と同じ値) |
| `AGENT_COMPACT_CMD` | `<実行ファイル> [引数…]`(空白で区切る。引用符は使えない) | `compactSelf` の頼み先。残すことを env `AGENT_COMPACT_FOCUS` に入れて呼ぶ。出力はそのままエージェントに見せる。exit 0 以外 = 渡せなかった |

- 値が無い = 単体(`AGENT_TERMINAL` は default.conf、頼み先なし)
- `AGENT_COMPACT_CMD` は `AGENT_TERMINAL` と独立に効く(tmux の中でも頼み先が先)
- 古い形の値(切り替えで消す): 値を書く側がまだ上の値を書かない間だけ、`lib.mjs` の `legacyHandoff` 1 か所が古い環境変数を読み、同じ 2 つ(端末は別の道具が持つ・頼み先)に読み替える。ほかの場所は古い名前を持たない

## `pnpm workflow agent-terminal compactSelf [--then continue|wait] "<残すこと>"`

- 打てるとき(`AGENT_TERMINAL=tmux`・tmux の中・下の hook がこのペインで動いている): 裏に待つ役を残し「予約しました…ここで返答を終えてください」と出す。返答が終わると `/compact <残すこと>` が Enter 付きで入力される
- 頼み先があるとき(`AGENT_COMPACT_CMD`、下の「値の約束」): 自分では打たない。そのコマンドを、残すことを env `AGENT_COMPACT_FOCUS` に入れて呼び、その出力をそのまま出す
  - 打ち込むのは端末を持つ道具だけ(その道具の通知・合図の打ち込みとぶつからない)。断るかどうか・いつ打つかもその道具が決める
  - 呼べない・失敗(exit 0 以外): 下の代わりの 1 行を出す
- 端末は別の道具が持つ(`AGENT_TERMINAL=none`)で頼み先が無い: 打たず、下の代わりの 1 行を出す
- 打てないとき: 「次の 1 行をユーザーに打ってもらってください: /compact <残すこと>」と出す(exit 0。エラーにしない)
- `--then` = 圧縮の後に打つ 1 行の種類。`continue`(既定)= 読み返して続ける / `wait` = 読み返して待つ(区切りで止めて人の指示を待つとき)。ほかの値・値なしは使い方を出して exit 1
  - 待つ役が `/compact` を打てたときだけペインの印 `after` に書く(打たずにやめた予約の印が、後で人が打つ `/compact` の続きを変えないように)。SessionStart の hook がそれを読み、どの start でも消す
  - 頼み先があるとき・打てないときは使わない(後は頼み先の仕組み・既定の続き)
- 残すこと = 圧縮の後に何も読み直さなくても要ること(作業中のファイルのパス、未完了の手順など)を 1〜3 行。改行は空白に直す
- 省略語 coffee-break(`.claude/rules/shortcuts.md`)はこのコマンドを使う

## hook(`.claude/settings.json`)

`node scripts/workflow/agent-terminal/hook.mjs <start|busy|stop|precompact>` を SessionStart / UserPromptSubmit / Stop / PreCompact に登録している。

`hook.mjs` は hook が呼ぶ入口(手で打たない)。`pnpm workflow agent-terminal` の一覧には動作として出るが、`pnpm workflow agent-terminal hook` で打つ物ではない。

- 記録するもの(ペインごと): 今そのペインにいる会話の id、返答の始まりと終わりの時刻、圧縮の起こり方(手で打った / 自動)
- 手で打った圧縮の後(SessionStart の source が compact で、直前の PreCompact が manual)だけ、続きの待つ役を残す(打つ 1 行は印 `after` で選ぶ。上の `--then`)。返答の途中で起きる自動の圧縮はそのまま続くので打たない
- 標準出力に出すのは、`AGENT_TERMINAL=tmux` で tmux の中のときの SessionStart(どの source でも。圧縮の後も入れ直す)の案内 `AGENT_TERMINAL.tmux.md` だけ。ほかの hook・ほかの場合は何も出さない(UserPromptSubmit / SessionStart の出力は文脈に入るため)。標準エラーにも出さず、失敗しても黙って exit 0
- 何もしないとき: `AGENT_TERMINAL` が `tmux` でない(`none` = 端末は別の道具が持つ・人が切った)/ tmux の外 / 古い形の値(下)

## 案内のファイル `AGENT_TERMINAL.<値>.md`

- 値ごとに 1 つ(`none` には無い)。別の端末に対応するときは値と一緒に 1 つ足す
- 中身 = その端末でエージェントができること(自分の圧縮の予約・`pnpm workflow dev-tab run`・よい使い方)。エージェント向けに短く、経緯は書かない
- `.claude/rules/` の外に置く(Claude Code が自動で読み込まない。その端末のときだけ hook が入れる)

## 待つ役(lib.waiter.mjs)の決まり

- 打つのは、入力欄が画面にあって空のときだけ(Claude Code が薄く描く案内は空とみなす)。人の下書き・確認の画面・作業中の表示(`esc to interrupt`)には打たない
- やめるとき(打たない): そのペインの会話が変わった(`/clear`・別の claude)/ ペインが無くなった / 同じ種類の新しい予約に代わった / 人が自分の言葉を送った / 入力欄が空かないまま `AGENT_TERMINAL_WAIT` 秒(既定 600)
- 結果は 1 行ずつ記録の `typein.log` に残る(`typed` / `skip: <理由>` / `wait: <理由>`)

## 記録の置き場

`${XDG_STATE_HOME:-~/.local/state}/next-starter/agent-terminal/panes/<socket のハッシュ>_<ペイン番号>/`(リポの外。本体とワークツリーで共通。ペインの記録なのでどのチェックアウトから打っても同じ所を見る)

- `session` / `busy` / `idle` / `precompact` = hook の印、`after` = 圧縮の後の続きの種類(待つ役が書き、hook が消す)、`lock.<種類>` = 動いている待つ役、`typein.log` = 打ち込みの記録

## テスト

`pnpm test scripts/workflow/agent-terminal/agentTerminal.test.mjs`(値の読み方、`pnpm workflow agent-terminal compactSelf` の道(頼み先・失敗・古い形の値・待つ役・代わりの 1 行)と `--then`、圧縮の後の続行 / 待機の打ち分け、hook の出力(案内は tmux の中の SessionStart だけ)、案内のファイルが値ごとにあること、入力欄の読み取り、tmux があれば一時の tmux サーバーで偽の入力欄に打ち込む通し)
