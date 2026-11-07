# scripts/workflow/tmux-launch(通常セッションを tmux で開く)

ターミナルで `claude` を打つと、tmux のセッションの中で開くようにする仕組み。tmux の中で動いていれば、エージェントが `pnpm workflow dev-tab run`(`scripts/workflow/dev-tab/README.md`)で同じ tmux にタブ「Dev」を足し、開発サーバーを自分で立てて確かめられる。

シェルで打った `claude` を tmux に移すのは起動より前の段階なので、リポの中だけでは完結しない。**マシンごとに 1 回** `pnpm workflow tmux-launch setup` が要る(以後、同じマシンのどの next-starter 系のリポでも効く)。

## コマンド

```bash
pnpm workflow tmux-launch setup            # このマシンに入れる(入っていれば版を合わせ直す)
pnpm workflow tmux-launch setup --check    # 入り具合を出すだけ(そろっていれば exit 0、足りなければ 1)
pnpm workflow tmux-launch setup --remove   # 外す
```

tmux が無ければ何も入れずに止まる(exit 2)。先に入れる: Debian/Ubuntu/WSL `sudo apt install tmux` / macOS `brew install tmux`

## 入れるもの(どれも印 `# >>> next-starter claude-tmux >>>` で囲む。何度入れても重ならない)

- **中身**: `claude-tmux.sh` の写しを `<XDG_DATA_HOME か ~/.local/share>/next-starter/claude-tmux.sh` に置く。特定のリポの場所を指さないので、リポを消しても壊れない
- **シェルの設定**: `~/.bashrc`(`$SHELL` が zsh なら `~/.zshrc`)に、中身を読み込む 1 行
- **`~/.tmux.conf`**: Claude Code の文書(terminal-config)が tmux に勧める設定 + タブの移動と見た目
  - `allow-passthrough on`(通知・進み具合が外のターミナルに届く)/ `focus-events on` / `extended-keys on` + `terminal-features 'xterm*:extkeys'`(Shift+Enter で改行)/ `mouse on`
  - タブの移動と見た目はチームツールと同じ: F1-F12 でそのタブへ、Shift+←→ で前後、タブはクリックでも移動、タブは 1 から(claude = F1、`pnpm workflow dev-tab run` の Dev = F2)。下に 2 行(セッション名とタブの並び / 操作の案内)、各タブの上の枠に名札、履歴 50000 行、truecolor。色は緑(`colour114`。チームの色と重ならない)
  - 既定(`-g`)として書くので、チームツールのセッションは自分の色で上書きしたまま変わらない
  - 動いている tmux サーバーがあれば `tmux source-file` で読み直させる
  - どれも `-q` 付き(その版の tmux が知らない設定は黙って飛ばす。`allow-passthrough` は tmux 3.3 から。`-q` が無いと、tmux サーバーの起動時 = 最初の 1 回だけ、設定のエラーが最初のタブに重なって出て claude が隠れる)
- `--check` と hook は塊の中身まで比べる: 前の版の中身のままなら「古い」と出る。`pnpm workflow tmux-launch setup` で書き直す

## `claude` を打ったとき

- **tmux で開く**: 今のフォルダから上にたどって目印 `.claude/tmux-launch` があるリポの中で、tmux の外から対話で起動したとき
  - `claude` 1 回につき tmux のセッション 1 つ。名前 = リポのルートのフォルダ名(ワークツリーならその名前)、同じリポで 2 つ目からは `<名前>-2`・`-3` …
  - 引数はそのまま渡る(`claude --continue` など)
- **そのまま起動する**: tmux の中(チームツールのタブを含む)/ `NO_TMUX_LAUNCH=1` / 端末でない / `-p`・`--print`・`--help`・`--version` / サブコマンド(`mcp`・`config`・`update` 等)/ tmux が無い / 目印の無いフォルダ
- **ターミナルを閉じたとき**: 普通のターミナルのタブと同じく全部終わる。セッションに `destroy-unattached` を付けているので、つないでいるターミナルが無くなるとセッションが消え、中の claude も Dev タブのサーバーも止まる(裏に残らない。会話の続きは `claude --continue`)
- **claude を終えたとき**: そのセッションに claude のタブがもう無く、`pnpm workflow dev-tab run` の Dev タブがそのセッションにあれば止める(Dev タブだけが残り続けない)
- 一時的に外す: `NO_TMUX_LAUNCH=1 claude`
- tmux の新しいタブの環境変数は tmux サーバーのもの(打ったシェルで export しただけの変数は届かないことがある)

## 案内(SessionStart hook)

`.claude/settings.json` の SessionStart hook(`check.mjs`)が、ターミナルの claude(`CLAUDE_CODE_ENTRYPOINT=cli`)を tmux の外で起動し、このマシンで未設定・古いときだけ、エージェントに 1 行で知らせる。エージェントはユーザーに 1 回伝え、承認をもらってから `pnpm workflow tmux-launch setup` を実行する。設定済み・tmux の中・VS Code 拡張・デスクトップアプリでは何も出さない。

## 版

`claude-tmux.sh` の `NEXT_STARTER_CLAUDE_TMUX_VERSION` を、中身を直したら 1 上げる。マシンに置いた写しが古いと hook が知らせ、`pnpm workflow tmux-launch setup` で合わせ直す。

## tmux の中での注意(Claude Code)

- Ctrl+B は tmux の prefix。Claude Code のバックグラウンド化は 2 回押す
- 画像の貼り付けは tmux で文書化されていない。だめならファイルのパスかドラッグで渡す
- tmux 3.6 系はちらつくことがある(同期出力が無い)。extended-keys は tmux 3.2 から
- 画面が崩れたら Ctrl+L

## 対応環境

Linux / WSL / macOS のターミナル + tmux、bash / zsh。VS Code 拡張・デスクトップアプリ・Windows ネイティブは対象外(いつもどおり起動する)。

## テスト

`pnpm test scripts/workflow/tmux-launch/tmux-launch.test.mjs`(印の塊・HOME を一時フォルダにした setup の通し・偽の tmux / claude での振り分け・専用 tmux サーバーでのタブの中の後始末)
