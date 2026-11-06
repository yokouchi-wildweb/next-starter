# scripts/workflow/dev-tab(pnpm dev:tab)

開発サーバーを tmux のタブで立てる・止める・様子を見る道具。エージェントが動いているアプリで確かめるときに、自分で立てて自分で止めるためのもの(人に立ち上げを頼まない)。人が使ってもよい。

## コマンド

```bash
pnpm dev:tab            # 立てる(= start)。もう動いていれば URL を出すだけ
pnpm dev:tab --port=3005
pnpm dev:tab stop       # 止めてタブを閉じる
pnpm dev:tab status     # どこで動いているか・応答するか
```

出力は 1 行: `http://localhost:<port> — <本体のチェックアウト or ワークツリー>(ブランチ)、タブ <番号>(セッション <名前>)`

終了コード: 0 = できた(既に動いていた場合も)/ 1 = 失敗 / 2 = tmux が無い / 3 = 立てなかった(この道具の外で開発サーバーが動いている)

## どこに立つか

- **tmux の中から**: 今の tmux セッションにタブ「Dev」を足す。tmux サーバーは `$TMUX` で決まるので、いつもの tmux でも別の socket(`tmux -L <name>`)でも同じように動く
- **tmux の外から**(VS Code 拡張・デスクトップアプリ等): 裏で tmux セッション `dev-<フォルダ名>` を作ってそこで動かす。見るときは `tmux attach -t dev-<フォルダ名>`
- **tmux が無い**: 入れ方を出して止まる(exit 2)
- `--session=<name>` / `--socket=<name>`: 外から特定の tmux セッション(`tmux -L <name>` のサーバー)に足すとき。無いセッションなら作る

## 決まりごと

- **1 チェックアウトに 1 つ**。記録は `<チェックアウト>/.agent/dev-tab.json`(gitignore)。ワークツリーごとに別なので、本体とワークツリーで同時に立てられる
- **ポート**: `--port`、無ければ 3000 から空きを選ぶ(`DEV_TAB_PORTS` = 試す数、既定 20)
- **env**: `PORT` と `APP_BASE_URL=http://localhost:<port>` を渡して dev スクリプトを動かす(3000 以外でもメールのリンク等が合う。プロセスの env は `.env.*` より優先される)。`next dev` には `--port` も渡す
- **この道具の外で動いているサーバー**(人が立てたもの等。そのフォルダを作業場所にする dev のプロセス)を見つけたら立てずに exit 3 で知らせる。そのまま使うか、止めてからもう一度
- **起動待ち**: 最大 60 秒ポートの応答を待つ(`DEV_TAB_WAIT`)。応答が無くても失敗にはせず「起動中」と出す(タブを見る)
- **止め方**: Ctrl-C → 最大 10 秒待つ(`DEV_TAB_STOP_WAIT`)→ 残った子プロセスに TERM → タブを閉じる。プロセスの無い `.next/dev/lock` は消す
- タブが手で閉じられていたら、記録は次に読んだときに消える

## エージェントの使い方

- 動いているアプリでの確認が要る → 承認を 1 回取って `pnpm dev:tab` → 出た URL を Playwright で開く → 済んだら `pnpm dev:tab stop`
- ログインが要る → `pnpm task dev-admin`(テスト用の管理者。`scripts/tasks/README.md`)
- 決まりそのもの(いつ立てるか・承認の取り方)は各リポの `.claude/rules/behavior.md`(fork が変えてよい)

## 対応環境

- Linux / WSL / macOS + tmux。外のサーバーの検出は Linux が `/proc`、それ以外が `ps` + `lsof`

## テスト

`pnpm test:dev-tab`(純粋な部品 + tmux があるときだけ、専用の tmux サーバーで小さな HTTP サーバーを立てて止める通し)
