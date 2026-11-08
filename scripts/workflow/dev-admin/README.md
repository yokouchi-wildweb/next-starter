# scripts/workflow/dev-admin(pnpm workflow dev-admin run)

開発用 DB にエージェントの確認用の管理者を用意し、ログイン情報を出す道具(エージェントが Playwright で自分でログインするためのもの)。開発の進め方の道具で、業務の操作ではないので user ドメインのタスクにしない。

## コマンド

```bash
pnpm workflow dev-admin run
```

出力は JSON 1 行(`action`・`email`・`password`・`loginUrl`)。終了コード: 0 = できた / 1 = 止まった(理由は `error`)

## 中身

- メール `agent-admin@example.test` / ロール `admin`。管理者カテゴリなので `(user)/(protected)` のページにも入れる
- パスワードは `AUTH_JWT_SECRET` から決まる(出力に出る)。env はワークツリーにも複製されるので、本体とワークツリーで同じ値
- 何度実行してもよい: 無ければ作る(監査に system として残る)/ あればそのまま使い、パスワードが合わなければ合わせ直し、ロックが掛かっていれば外す
- 止まる: 段階(env ファイルの `APP_ENV`、`@/lib/appEnv`)が `development` でない / `ENV_FILE` が `.env.development*` でない / `AUTH_JWT_SECRET` が無い / DB 未設定
- 利用者を作る・直すのは `userService`(動的 import)。DB を直接書く部品は読まない(lint `import-boundaries/tools-no-db-write` の範囲に入っている)
- 下準備(env ファイルの読み込み・DB 未設定の止め・監査の system 文脈)はタスクのランナーの部品 `scripts/runner/task/prepare.ts` を使う

## ログイン

`/admin/login` を開き、メールとパスワードを入れて送信する(開発サーバーは `pnpm workflow dev-tab run`、`scripts/workflow/dev-tab/README.md`)。

## ファイル

- `run.ts` = 動作(DB に触る本体) | `lib.ts` = 純粋な部品(パスワード・段階の判定) | テスト `pnpm test scripts/workflow/dev-admin/dev-admin.test.ts`(DB には触らない)
