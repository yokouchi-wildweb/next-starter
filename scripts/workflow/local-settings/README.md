# scripts/workflow/local-settings(pnpm workflow local-settings)

手元の Claude Code の設定を整える命令。共有の `.claude/settings.json` は許可の行を出荷せず、許可の層(PreToolUse のフック 1 本、`scripts/workflow/devcheck/README.md`「許可の層」)を出荷する。そのフックが確認を省くのは、手元に印 `DEVCHECK_GRANT=on` がある時だけ。この命令は手元の設定をその形に書き換える。確認を取って選ばせるのはスキル `/local-settings`(この命令は聞かない)。

## コマンド

```bash
pnpm workflow local-settings show [--json]      # 今ここで効いている設定ファイルと、それぞれが決めていること
pnpm workflow local-settings plan [選択…] [--json]   # 消える行と新しい中身(何も書かない)
pnpm workflow local-settings apply [選択…] [--json]  # plan のとおりに書く(控えを残す)
```

選択(plan と apply で同じ物を渡す):

- `--no-grant`: 印を書かない(許可のフックは確認を省かない。固定の止めはいつも効く)
- `--drop-deny=<行>`(繰り返してよい): 今の手元の deny の行のうち消す物。既定は全部残す。上流が昔配った 3 行 `Bash(sudo:*)`・`Bash(rm -rf /:*)`・`Read(./.env)` も既定で残す。今の手元に無い行を指すと止める
- `--bypass`: 全部許可を選んだ人だけ。個人設定 `~/.claude/settings.json` に `permissions.defaultMode = "bypassPermissions"` と `skipDangerousModePermissionPrompt = true` を書く(ほかの項目は変えない。無ければ作る)。defaultMode は次の起動から効く。このプロジェクトだけに絞る仕組みは無い

## 書く物

- 手元 `<チェックアウト>/.claude/settings.local.json` を全面的に書き換える。中身は 3 つだけ:
  - `env.DEVCHECK_GRANT = "on"`(`--no-grant` で無し)
  - `enabledMcpjsonServers = ["playwright"]`(`.mcp.json` の Playwright を確認の画面なしで有効にする。共有の設定では出荷しない)
  - `permissions.deny` = 残すと選んだ行(無ければ書かない)
  - allow の行・コマンド名・パス・defaultMode は書かない(昔の全部許可・「今後は聞かない」で足された行は消える行として plan に出る)
- 書く前の控え: `<チェックアウト>/.agent/settings.local.<日時>.json`、`--bypass` で個人設定が変わる時は `.agent/claude-user-settings.<日時>.json`(`.agent/` は追跡の外)
- 触れない物: managed の設定、チームの道具が起動ごとに渡す設定(`--settings`)、ほかのチェックアウト(ワークツリーはそれぞれ自分の手元を持つ)
- env の値は表示しない(印の値だけ出す)
- 読めない JSON があれば 1 行で止め、何も書かない

## 効き方

- 手元の env・deny・enabledMcpjsonServers は、書き換えた次の道具の呼び出しから効く(再起動は要らない)。`defaultMode` は新しいセッションから
- 優先: managed → コマンドライン(`--settings`)→ local → project → user。`bypassPermissions` は project・local では効かない(user・managed・コマンドラインだけ)
- `show` は managed・local・project・user のファイルを読む。コマンドラインの設定はここから見えない

## 終了コード

- 0 = 出した / 書いた | 2 = 設定が読めない・引数の誤り(1 行で理由、何も書かない)

## ファイル

- `lib.ts`(場所・計画・書き込み・効いている設定)・動作 `show.ts`・`plan.ts`・`apply.ts`
- テスト: `pnpm test scripts/workflow/local-settings`(一時のチェックアウトと一時の HOME だけに書く)
