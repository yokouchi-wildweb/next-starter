# cron タスクカタログ

アップストリームが提供する定期実行タスクの一覧。下流プロジェクトは vercel.json にスケジュール登録するか、CLI から呼ぶことで利用できる。

## 基本設計

- API ルート: `src/app/api/cron/<task-name>/route.ts`
- CLI: `pnpm cron <task-name>`
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
- **CLI**: `pnpm cron expire-pending-purchases`
- **推奨スケジュール**: `*/15 * * * *` （15分間隔）
- **必要環境変数**: `CRON_SECRET`（本番/preview のみ）
- **レスポンス例**: `{ "ok": true, "expired": 12 }`

---

## セットアップ

### Vercel（推奨）

プロジェクトルートに `vercel.json` を作成。サンプル: リポジトリの `vercel.json.example` をコピー。

```json
{
  "crons": [
    { "path": "/api/cron/expire-pending-purchases", "schedule": "*/15 * * * *" }
  ]
}
```

環境変数 `CRON_SECRET` を Vercel プロジェクト設定で追加（Vercel Cron は自動的に Bearer を付けてくれる）。

### CLI（Vercel 以外の環境）

`package.json` の `pnpm cron` コマンドを任意のスケジューラから呼ぶ。

**Docker + cron:**
```cron
*/15 * * * * cd /app && pnpm cron expire-pending-purchases
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
            command: ["pnpm", "cron", "expire-pending-purchases"]
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
      - run: pnpm install && pnpm cron expire-pending-purchases
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

### 登録タスク確認

```bash
pnpm cron --list
```

---

## 運用上の注意

- `CRON_SECRET` は本番/preview で**必須**。未設定時は API ルートが fail-closed で 401 を返す
- タスクが失敗した場合は 500 レスポンス + stderr に JSON ログ出力。Vercel Cron は自動リトライしないので、失敗の監視はログ側で行う
- `expire-pending-purchases` の per-row 処理（onExpire 定義あり）は件数に比例して時間がかかる。Vercel Cron は 60秒タイムアウトなので、極端に溜まる運用になったらスケジュールを短縮する
