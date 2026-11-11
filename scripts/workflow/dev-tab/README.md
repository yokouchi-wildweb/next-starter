# scripts/workflow/dev-tab(pnpm workflow dev-tab run)

開発サーバーを tmux のタブか裏のプロセスで立てる・止める・様子を見る道具。エージェントが動いているアプリで確かめるときに、自分で立てて自分で止めるためのもの(人に立ち上げを頼まない)。人が使ってもよい。

## コマンド

```bash
pnpm workflow dev-tab run            # 立てる(= start)。もう動いていれば URL を出すだけ
pnpm workflow dev-tab run --port=3005
pnpm workflow dev-tab run --background  # tmux の中でも裏のプロセスで立てる
pnpm workflow dev-tab run stop       # 止めてタブを閉じる
pnpm workflow dev-tab run status     # どこで動いているか・応答するか
```

出力は 1 行:

- タブ: `http://localhost:<port> — <本体のチェックアウト or ワークツリー>(ブランチ)、タブ <番号>(セッション <名前>)`
- 裏: `http://localhost:<port> — <本体のチェックアウト or ワークツリー>(ブランチ)、裏のプロセス <pid>(ログ .agent/dev-tab.log)`

終了コード: 0 = できた(既に動いていた場合も)/ 1 = 失敗(使い方の誤り・起動の途中で終わった等)/ 3 = 立てなかった(この道具の外で開発サーバーが動いている)

## どこに立つか

上から順に決まる(`lib.ts` の `decideMode`):

1. `--background` → 裏のプロセス(`--session` / `--socket` と一緒には使えない)
2. `--session=<name>` / `--socket=<name>`(tmux の行き先の名指し)→ そのタブ。外から特定の tmux セッション(`tmux -L <name>` のサーバー)に足すとき。無いセッションなら作る。`AGENT_TERMINAL` より強い(チームツールはこの形で呼ぶ)
3. `AGENT_TERMINAL`(環境変数 → `scripts/workflow/agent-terminal/default.conf`、無い・知らない値 = none)が `tmux` で、tmux が入っている → タブ
   - **tmux の中から**: 今の tmux セッションにタブ「Dev」を足す。tmux サーバーは `$TMUX` で決まるので、いつもの tmux でも別の socket でも同じように動く
   - **tmux の外から**(VS Code 拡張・デスクトップアプリ等): 裏で tmux セッション `dev-<フォルダ名>` を作ってそこで動かす。見るときは `tmux attach -t dev-<フォルダ名>`
4. それ以外(`AGENT_TERMINAL=none`、tmux が入っていない)→ 裏のプロセス

**裏のプロセス**: 切り離したプロセスグループ(この道具が終わっても動き続ける)で dev スクリプトを動かし、出力は `<チェックアウト>/.agent/dev-tab.log`(立てるたびに書き直す)。記録・URL の 1 行・status / stop・二重起動の判定・外のサーバーの検出・ポートの選び方はタブと同じ

## 決まりごと

- **1 チェックアウトに 1 つ**。記録は `<チェックアウト>/.agent/dev-tab.json`(gitignore)。ワークツリーごとに別なので、本体とワークツリーで同時に立てられる
  - 記録の `mode`: `tab`(socket・session・window。`mode` の無い古い記録もタブ)/ `background`(pid・pgid・procStart = 開始時刻の印・log)
- **ポート**: `--port`、無ければ 3000 から空きを選ぶ(`DEV_TAB_PORTS` = 試す数、既定 20)
- **env**: `PORT` と `APP_BASE_URL=http://localhost:<port>` を渡して dev スクリプトを動かす(3000 以外でもメールのリンク等が合う。プロセスの env は `.env.*` より優先される)。`next dev` には `--port` も渡す
- **この道具の外で動いているサーバー**(人が立てたもの等。そのフォルダを作業場所にする dev のプロセス)を見つけたら立てずに exit 3 で知らせる。そのまま使うか、止めてからもう一度
- **起動待ち**: 最大 60 秒ポートの応答を待つ(`DEV_TAB_WAIT`)。応答が無くても失敗にはせず「起動中」と出す(タブかログを見る)。裏のプロセスが応答する前に終わったら、記録を消してログの終わりを出し exit 1
- **止め方**:
  - タブ: Ctrl-C → 最大 10 秒待つ(`DEV_TAB_STOP_WAIT`)→ 残った子プロセスに TERM → タブを閉じる
  - 裏: プロセスグループに SIGINT(Ctrl-C と同じ)→ ポートが閉じるまで最大 10 秒(`DEV_TAB_STOP_WAIT`)→ 残れば TERM → 2 秒 → まだ残れば KILL。グループが残らないことを確かめて記録を消す
  - どちらもプロセスの無い `.next/dev/lock` は消す
- タブが手で閉じられていたら・裏のプロセスが終わっていたら(pid が別のプロセスに使い回されていても開始時刻の印で見分ける)、記録は次に読んだときに消える

## エージェントの使い方

- 動いているアプリでの確認が要る → 承認を 1 回取って `pnpm workflow dev-tab run` → 出た URL を Playwright で開く → 済んだら `pnpm workflow dev-tab run stop`
- ログインが要る → `pnpm workflow dev-admin run`(テスト用の管理者。`scripts/workflow/dev-admin/README.md`)
- 決まりそのもの(いつ立てるか・承認の取り方)は各リポの `.claude/rules/behavior.md`(fork が変えてよい)

## 対応環境

- Linux / WSL / macOS。タブは tmux が要る(無ければ裏のプロセス)。外のサーバーの検出と開始時刻の印は Linux が `/proc`、それ以外が `ps`(+ `lsof`)

## テスト

`pnpm test scripts/workflow/dev-tab/dev-tab.test.ts`(純粋な部品・どこに立つかの表・記録の生死、小さな HTTP サーバーを立てて止める通し: 裏はいつも、タブは tmux があるときだけ専用の tmux サーバーで)
