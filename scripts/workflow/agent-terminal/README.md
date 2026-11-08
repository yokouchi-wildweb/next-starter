# scripts/workflow/agent-terminal(エージェントが動かす端末)

エージェントが自分の会話の端末(今は tmux)に 1 行打ち込む道具。今あるのは 2 つ:

- `pnpm workflow agent-terminal compactSelf "<残すこと>"` — エージェントが自分の会話の圧縮を頼む。今の返答が終わったら `/compact <残すこと>` が入力される
- 圧縮の後の続き — 人が手で打った `/compact`(上の予約も含む)が終わったら、入力欄に「続けてください」が入力され、会話はその時の文脈で続く(人が「続けて」と言ったのと同じ。承認の扱いは変わらない)

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

## `pnpm workflow agent-terminal compactSelf "<残すこと>"`

- 打てるとき(`AGENT_TERMINAL=tmux`・tmux の中・下の hook がこのペインで動いている): 裏に待つ役を残し「予約しました…ここで返答を終えてください」と出す。返答が終わると `/compact <残すこと>` が Enter 付きで入力される
- 打てないとき: 「次の 1 行をユーザーに打ってもらってください: /compact <残すこと>」と出す(exit 0。エラーにしない)
- 残すこと = 圧縮の後に何も読み直さなくても要ること(作業中のファイルのパス、未完了の手順など)を 1〜3 行。改行は空白に直す
- 省略語 coffee-break(`.claude/rules/shortcuts.md`)はこのコマンドを使う

## hook(`.claude/settings.json`)

`node scripts/workflow/agent-terminal/hook.mjs <start|busy|stop|precompact>` を SessionStart / UserPromptSubmit / Stop / PreCompact に登録している。

`hook.mjs` は hook が呼ぶ入口(手で打たない)。`pnpm workflow agent-terminal` の一覧には動作として出るが、`pnpm workflow agent-terminal hook` で打つ物ではない。

- 記録するもの(ペインごと): 今そのペインにいる会話の id、返答の始まりと終わりの時刻、圧縮の起こり方(手で打った / 自動)
- 手で打った圧縮の後(SessionStart の source が compact で、直前の PreCompact が manual)だけ、続きの待つ役を残す。返答の途中で起きる自動の圧縮はそのまま続くので打たない
- 標準出力に出すのは、`AGENT_TERMINAL=tmux` で tmux の中のときの SessionStart(どの source でも。圧縮の後も入れ直す)の案内 `AGENT_TERMINAL.tmux.md` だけ。ほかの hook・ほかの場合は何も出さない(UserPromptSubmit / SessionStart の出力は文脈に入るため)。標準エラーにも出さず、失敗しても黙って exit 0
- 何もしないとき: `AGENT_TERMINAL` が `tmux` でない / tmux の外 / 別の道具が動かすタブ(手元のチームツールのタブ: 環境変数 `TK_TEAM` など。圧縮や打ち込みはそちらの仕組みが受け持つ)

## 案内のファイル `AGENT_TERMINAL.<値>.md`

- 値ごとに 1 つ(`none` には無い)。別の端末に対応するときは値と一緒に 1 つ足す
- 中身 = その端末でエージェントができること(自分の圧縮の予約・`pnpm workflow dev-tab run`・`/msg` があればチームの統括への連絡・よい使い方)。エージェント向けに短く、経緯は書かない
- `.claude/rules/` の外に置く(Claude Code が自動で読み込まない。その端末のときだけ hook が入れる)

## 待つ役(lib.waiter.mjs)の決まり

- 打つのは、入力欄が画面にあって空のときだけ(Claude Code が薄く描く案内は空とみなす)。人の下書き・確認の画面・作業中の表示(`esc to interrupt`)には打たない
- やめるとき(打たない): そのペインの会話が変わった(`/clear`・別の claude)/ ペインが無くなった / 同じ種類の新しい予約に代わった / 人が自分の言葉を送った / 入力欄が空かないまま `AGENT_TERMINAL_WAIT` 秒(既定 600)
- 結果は 1 行ずつ記録の `typein.log` に残る(`typed` / `skip: <理由>` / `wait: <理由>`)

## 記録の置き場

`${XDG_STATE_HOME:-~/.local/state}/next-starter/agent-terminal/panes/<socket のハッシュ>_<ペイン番号>/`(リポの外。本体とワークツリーで共通。ペインの記録なのでどのチェックアウトから打っても同じ所を見る)

- `session` / `busy` / `idle` / `precompact` = hook の印、`lock.<種類>` = 動いている待つ役、`typein.log` = 打ち込みの記録

## テスト

`pnpm test scripts/workflow/agent-terminal/agentTerminal.test.mjs`(値の読み方、`pnpm workflow agent-terminal compactSelf` の 2 つの道、hook の出力(案内は tmux の中の SessionStart だけ)、案内のファイルが値ごとにあること、入力欄の読み取り、tmux があれば一時の tmux サーバーで偽の入力欄に打ち込む通し)
