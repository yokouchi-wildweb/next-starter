# cron タスクカタログ

アップストリームが提供する定期実行タスクの一覧。下流プロジェクトは vercel.json にスケジュール登録するか、CLI から呼ぶことで利用できる。

## 基本設計

- API ルート: `src/app/api/cron/<task-name>/route.ts`
- CLI: `pnpm task <task-name>`
- 認証: `Authorization: Bearer ${CRON_SECRET}` （development はバイパス）
- レスポンス: `{ ok: true, ...result }` or `{ ok: false, error }`
- ログ: stdout に JSON 構造化ログ

新しいタスクを追加する手順は `src/lib/cron/README.md` を参照。

---

## 提供タスク一覧

### `expire-pending-purchases`

期限切れ（`expires_at` 経過）の pending 購入リクエストを `expired` に遷移する。
`onExpire` フックを定義した purchase_type では副次テーブルの atomic クリーンアップも同時に実行される。

- **API**: `GET /api/cron/expire-pending-purchases`
- **CLI**: `pnpm task expire-pending-purchases`
- **推奨スケジュール**: `*/15 * * * *` （15分間隔）
- **必要環境変数**: `CRON_SECRET`（本番/preview のみ）
- **レスポンス例**: `{ "ok": true, "expired": 12 }`

### `audit-log-prune`

`audit_logs` テーブルの retention_days を超過した行をバッチ削除する。各ドメインが記録した監査ログを行単位 retention に基づいて整理する。`SKIP LOCKED` でバッチ反復するため書き込み tx を長時間ブロックしない。

- **API**: `GET /api/cron/audit-log-prune`
- **CLI**: `pnpm task audit-log-prune`
- **推奨スケジュール**: `0 3 * * *` （日次・深夜帯）
- **必要環境変数**: `CRON_SECRET`（本番/preview のみ）
- **レスポンス例**: `{ "ok": true, "deletedCount": 3200, "iterations": 4, "truncated": false }`

### `audit-log-recover-dead-letter`

`audit_logs_failed` （bestEffort 記録の dead-letter 退避先）に溜まった行を再 insert する。書き込み失敗が一過性（DB 一時障害等）の場合に救済する。永続失敗は別途運用判断で手動対処。

- **API**: `GET /api/cron/audit-log-recover-dead-letter`
- **CLI**: `pnpm task audit-log-recover-dead-letter`
- **推奨スケジュール**: `0 * * * *` （毎時）
- **必要環境変数**: `CRON_SECRET`（本番/preview のみ）
- **レスポンス例**: `{ "ok": true, "recovered": 5, "remaining": 0 }`

### `user-login-event-prune`

`user_login_events` テーブルの retention_days を超過した行をバッチ削除する。IP 横断検索用の正規化テーブルで、件数増加が早いため日次プルーニングを推奨。

- **API**: `GET /api/cron/user-login-event-prune`
- **CLI**: `pnpm task user-login-event-prune`
- **推奨スケジュール**: `0 4 * * *` （日次・深夜帯。`audit-log-prune` と時刻を被らせない）
- **必要環境変数**: `CRON_SECRET`（本番/preview のみ）
- **レスポンス例**: `{ "ok": true, "deletedCount": 1500, "iterations": 2, "truncated": false }`

### `wallet-expire-lots`

有効期限切れウォレットロットの残額を没収（残高減算 + wallet_histories 記録）する。
`wallet-expiration.config.ts` で `expirationDays` + `sweepEnabled` を設定した通貨のみ対象で、
未設定（デフォルト）なら即終了の no-op。登録したままでも害はない。冪等・再実行安全。

- **API**: `GET /api/cron/wallet-expire-lots`
- **CLI**: `pnpm task wallet-expire-lots`
- **推奨スケジュール**: `30 4 * * *` （日次・深夜帯）
- **必要環境変数**: `CRON_SECRET`（本番/preview のみ）
- **レスポンス例**: `{ "ok": true, "sweptWallets": 120, "expiredAmount": 45000, "iterations": 1, "truncated": false }`
- **詳細**: `src/features/core/wallet/README.md` の「有効期限（ロット管理）」

### `wallet-lots-prune`

消費し尽くしたウォレットロット（remaining = 0）を保持期間（デフォルト30日）経過後に物理削除する。
有効期限を有効化した（特に付与頻度が高い）プロジェクトでは wallet_lots の肥大化を防ぐため必須。
機能未使用なら削除対象が存在せず no-op。

- **API**: `GET /api/cron/wallet-lots-prune`
- **CLI**: `pnpm task wallet-lots-prune`
- **推奨スケジュール**: `45 4 * * *` （日次・深夜帯。`wallet-expire-lots` の後）
- **必要環境変数**: `CRON_SECRET`（本番/preview のみ）
- **レスポンス例**: `{ "ok": true, "deletedCount": 8000, "iterations": 8, "truncated": false }`

> **Note**: `pnpm task wallet-lots-init` はタスクランナーに登録されているが**定期実行してはいけない**
> （ウォレット有効期限の導入時に1回だけ手動実行するデータ移行。再実行は全ユーザーの失効カウントをリセットする）。

> **Note**: `pnpm task user-name-dedup` も one-shot タスクで**定期実行しない**
> （表示名の一意性 `USER_NAME_CONFIG.unique` を有効化する際に1回だけ実行し、既存の重複表示名へ
> サフィックスを付与して解消する。冪等なので再実行は安全。`-- --dry-run` で対象の事前確認が可能。
> 詳細: `src/features/core/user/README.md` の「表示名（バリデーションと一意性）」）。

---

## セットアップ

### Vercel（推奨）

プロジェクトルートに `vercel.json` を作成。サンプル: リポジトリの `vercel.json.example` をコピー。

```json
{
  "crons": [
    { "path": "/api/cron/expire-pending-purchases",      "schedule": "*/15 * * * *" },
    { "path": "/api/cron/audit-log-prune",               "schedule": "0 3 * * *" },
    { "path": "/api/cron/audit-log-recover-dead-letter", "schedule": "0 * * * *" },
    { "path": "/api/cron/user-login-event-prune",        "schedule": "0 4 * * *" },
    { "path": "/api/cron/wallet-expire-lots",            "schedule": "30 4 * * *" },
    { "path": "/api/cron/wallet-lots-prune",             "schedule": "45 4 * * *" }
  ]
}
```

環境変数 `CRON_SECRET` を Vercel プロジェクト設定で追加（Vercel Cron は自動的に Bearer を付けてくれる）。

### CLI（Vercel 以外の環境）

`package.json` の `pnpm task` コマンドを任意のスケジューラから呼ぶ。

**Docker + cron:**
```cron
*/15 * * * * cd /app && pnpm task expire-pending-purchases
```

**Kubernetes CronJob:**
```yaml
spec:
  schedule: "*/15 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: expire-pending
            image: myapp:latest
            command: ["pnpm", "task", "expire-pending-purchases"]
```

**GitHub Actions:**
```yaml
on:
  schedule:
    - cron: "*/15 * * * *"
jobs:
  expire:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install && pnpm task expire-pending-purchases
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

### 登録タスク確認

```bash
pnpm task --list
```

---

## 運用上の注意

- `CRON_SECRET` は本番/preview で**必須**。未設定時は API ルートが fail-closed で 401 を返す
- タスクが失敗した場合は 500 レスポンス + stderr に JSON ログ出力。Vercel Cron は自動リトライしないので、失敗の監視はログ側で行う
- `expire-pending-purchases` の per-row 処理（onExpire 定義あり）は件数に比例して時間がかかる。Vercel Cron は 60秒タイムアウトなので、極端に溜まる運用になったらスケジュールを短縮する
