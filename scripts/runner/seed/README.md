# scripts/runner/seed — シードのランナー(pnpm ops db seed)

各ドメインのシード `src/features/<ドメイン>/seed.ts`(書き方: `src/lib/seed/README.md`)を走査し、`after` の順に各ドメインのサービスで入れる。一覧ファイル・登録表は持たない。

## コマンド

```bash
pnpm ops db seed          # 対話でドメインを選ぶ(after のドメインは自動で足す)
pnpm ops db seed --all    # 全部
pnpm db:push && pnpm ops db seed --all   # 表を作ってから全部
```

env ファイルは `ENV_FILE`(既定 `.env.development`)。DB が未設定なら何も入れずに止める。何度打っても同じ状態になる(上流のシードは全部の行に `$unique`)。

## ファイル

- `run.ts` … 本体(入口は `scripts/operations/db/seed.ts`)。走査 → 閉じた機能の判定 → 計画(`planSeeds`)→ 入れる
- `scan.ts` … `seed.ts` の走査と読み込み、閉じた機能の判定(`closedByOf`: ドメインのフォルダを `features` に持つ規則が閉じているか。全開スイッチを通した `rules`)
- `insert.ts` … 行を入れる(表 → ドメインのサービスは serviceRegistry。`seedCreate` があれば先に使う、`$unique` は `search` で探して使い回す、`ref` を id に置き換える)
- `gate.ts` … 表が無いエラー(42P01)の見分け
- テスト: `pnpm test scripts/runner/seed`(作り物のサービス。DB には触らない)

## 閉じた機能とシード

閉じた機能のドメインのシードは飛ばして名前を出す。それを `after` に持つ開いたシードは理由を出して止める(何も入れない)。表が DB に無くて落ちたら `pnpm db:push` を案内する。
