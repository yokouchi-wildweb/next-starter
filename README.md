# このリポジトリについて

この README は next-starter を基盤とする全リポジトリ(上流・下流を問わず)で**共通の内容**です。プロジェクトごとに書き換えません。プロジェクト固有の情報は次の場所にあります。

| 知りたいこと | 場所 |
|---|---|
| このプロジェクトは何か・方針・Tier・予定ドメイン | [`.claude/rules/project.md`](.claude/rules/project.md) |
| プロジェクト名(GitHub 上の一覧向け) | リポジトリの description 欄 |
| サービス名・運営者情報 | `src/config/business.config.ts` |

---

## 開発ドキュメント

設計の全体像と、各ルールの背景（なぜそうするか）は次から読めます。

➡️ **[docs/!must-read/](docs/!must-read/README.md)** — アーキテクチャの全体像（置き場所・処理の流れ・画面の分割・バックエンド・上流と下流の所有分担）と文書の地図

ルールの索引は [`CLAUDE.md`](CLAUDE.md)、各機能の使い方はコードの隣の `README.md` にあります。

動作要件: Node.js 20.9 以上（Next.js 16 の要件）、pnpm。

---

## 新規プロジェクトを作る(フォーク)

このリポジトリをフォークして新しいプロジェクトを立ち上げる手順です。Tier1 から Tier2 へ、Tier2 から Tier3 へ、どの段でも同じ手順です。

1. GitHub に空の private リポジトリを作り、description 欄にプロジェクト名と一言説明を入れる
2. このリポジトリを全履歴ごと clone し、`origin` を新リポ、`upstream` をフォーク元に設定する
3. `claude` を起動して `/fork-init <name>` を実行する(project.md / 追随台帳 / package 名 / business.config / .env.development の書き換えから初期コミット・push まで承認1回で完走)

詳細と手動で進める場合の手順:

➡️ **[新規プロジェクトの立ち上げ: フォークからデプロイまで](docs/setup/新規プロジェクトの立ち上げ_フォークからデプロイまで.md)**

---

## 上流の変更を取り込む

- `/flux` : upstream を fetch / merge し、追随作業が必要な変更(DOWNSTREAM NOTICE)を検出して適用・記録まで行う
- `/flux status` : 状態確認のみ
- 汎用機能が必要になったら自前実装せず `/upreq` で上流に依頼し、`/wen` で状況を追う

仕組み: [`.notices/README.md`](.notices/README.md)
