# プロジェクト固有ルール（`.claude/rules/`）

`.claude/rules/` には、フォーク先のプロジェクト固有の指示を配置します。そこにある `.md` は**毎セッション無条件でロードされる**ため、1 行ごとにコンテキスト費用を毎回払います。入れるものは厳選してください。

> この説明書自体は人間向けなので、自動ロードされないよう `.claude/rules/` の外（`.claude/README.md`）に置いています。`.claude/rules/` に README などの人間向け文書を置かないでください。

## ファイルの持ち主

- **`CLAUDE.md`**: このベースと全下流プロジェクトで共有するアーキテクチャの契約。下流では編集しない（足りなければ `/upreq`）
- **`.claude/rules/project.md` / `behavior.md`**: プロジェクトごとのファイル。下流で自由に書き換える。上流の merge で衝突したら下流側を採る
- 何を書き何を書かないかの規則は `CLAUDE.md` 冒頭の `PER_PROJECT` が正

## 重要：記述フォーマット

`.claude/rules/` 内のファイルは **AIエージェントが読むことに特化** しています。以下のルールに従って記述してください：

- **言語**: 英語のみ（AIの処理効率が高い）
- **形式**: 箇条書き、キーバリュー形式、YAML風の構造化データを推奨
- **コンテキスト節約**: 冗長な説明を避け、簡潔に記述
- **例より規則**: 長い例文より、明確なルール定義を優先

### 推奨フォーマット例

```markdown
# domain-rules

## payment
- handler: src/features/payment/
- external_api: Stripe
- webhook_path: /api/webhook/stripe

## email
- wrapper: src/lib/email/
- provider: SendGrid
- templates: src/templates/email/
```

## 使い方

1. `.claude/rules/` に `.md` ファイルを追加すると、自動的に読み込まれます（＝毎セッションのコストになるので、恒常ルールだけを置く）
2. ベースの `CLAUDE.md` は変更せず、上記「書くもの」の範囲に収まる追加ルールのみをここに記述します

## ディレクトリ構造例

```
.claude/
├── README.md           # このファイル（人間向け・日本語。自動ロードされない）
└── rules/
    ├── project.md      # プロジェクト概要・ルール
    ├── api-rules.md    # API固有のルール
    └── domain/         # ドメイン別のルール（サブディレクトリも可）
        └── users.md
```
