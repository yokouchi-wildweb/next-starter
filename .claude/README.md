# プロジェクト固有ルール（`.claude/rules/`）

## Overview

- `.claude/rules/` には、フォーク先のプロジェクト固有の指示を置く。そこの `.md` は(`paths` フロントマターが無ければ)毎セッション無条件でロードされるので、1 行ごとにコンテキスト費用を毎回払う
- この説明書は自動ロードされないよう `.claude/rules/` の外(`.claude/README.md`)に置く。`.claude/rules/` には README などの説明の文書を置かない
- 何をどこに書くか・書式・大きさ・窓口の正は `.claude/rules/core/design.md`(places・format・size・authoring)

### ファイルの持ち主

- `CLAUDE.md`: このベースと全下流プロジェクトで共有するアーキテクチャの契約。下流では編集しない(足りなければ `/order <上流リポ>`)
- `.claude/rules/project.md`(地図・アーキテクチャの差分・判断基準)/ `behavior.md`(作業ルール): プロジェクトごとのファイル。下流で自由に書き換える。上流の merge で衝突したら下流側を採る
- `.claude/rules/shortcuts.md`(合言葉)/ `term-aliases.md`(用語の読み替え): 全員共通。末尾の `fork entries below` マーカーより上を上流、下を下流が書く(merge で衝突したら上は上流側、下は下流側を採る)
- 合言葉(`shortcuts.md`): メッセージがその単語だけのときに発動する短い指示。1 項目 1 行で、1 行に収まらないものはスキル(`.claude/skills/`)にする

## Usage

1. `.claude/rules/` に `.md` ファイルを足すと自動で読み込まれる(`paths` フロントマターが無いファイルは毎セッション全文。コストになるので恒常ルールだけを置く)
2. ベースの `CLAUDE.md` は変えず、`.claude/rules/core/design.md` の places が自分のリポの物とする範囲(self files・lineage の自分の節・core の外の自分の決まり)のルールだけをここに書く

### 書き方

`.claude/rules/` 内のファイルは AI エージェントが読むことに特化している:

- 言語: 英語のみ(AI の処理効率が高い)
- 形式: 箇条書き、キーバリュー形式、YAML 風の構造化データ
- コンテキスト節約: 冗長な説明を避け、簡潔に書く
- 例より規則: 長い例文より、明確なルール定義

```markdown
# domain-rules

## payment
- handler: src/domains/payment/
- external_api: Stripe
- webhook_path: /api/webhook/stripe

## email
- wrapper: src/lib/email/
- provider: SendGrid
- templates: src/templates/email/
```

## Related

- 置き場・書式・大きさの決まり: `.claude/rules/core/design.md`(self_files ほか)
