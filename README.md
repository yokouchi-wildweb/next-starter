# このリポジトリについて

## Overview

### AIでつくり、事業と育てる。

next-starterは、商用サービスの立ち上げと、その先の成長を支えるアプリ開発フレームワークです。

**AIが力を発揮する設計 — AIネイティブ**

AIが迷わずつくれるよう、設計のルールと開発の道具を整備。機能づくりも、大きな見直しも、すばやく進めます。

**事業の単位で育てる — ドメインドリブン**

会員や決済など、業務ごとに必要な仕組みをひとまとめに。機能をまとまりで足したり止めたりでき、事業の変化に対応します。

**作り直しを恐れない — デットフリー**

AIの速さを、よりよい設計に使います。その場しのぎを積み重ねず、必要なときに仕組みから見直します。

設計の考え方は、[設計思想とアーキテクチャ](docs/!must-read/設計思想とアーキテクチャ.md)へ。

この README は next-starter を基盤とする全リポジトリ(上流・下流を問わず)で**共通の内容**です。プロジェクトごとに書き換えません。プロジェクト固有の情報は次の場所にあります。

| 知りたいこと | 場所 |
|---|---|
| このプロジェクトは何か・方針・予定ドメイン | [`.claude/rules/project.md`](.claude/rules/project.md) |
| Tier(段)とリポの名前 | [`repo.json`](repo.json) の `tier`・`repo_id` |
| プロジェクト名(GitHub 上の一覧向け) | リポジトリの description 欄 |
| サービス名・運営者情報 | `src/business/business.ts`(`@/business` で読む) |

動作要件: Node.js 24（`package.json` の `engines`。Next.js 16 自体の下限は 20.9）、pnpm 10（`packageManager`）。

## Usage

### 新規プロジェクトを作る(フォーク)

このリポジトリをフォークして新しいプロジェクトを立ち上げる手順です。Tier1 から Tier2 へ、Tier2 から Tier3 へ、どの段でも同じ手順です。

1. GitHub に空の private リポジトリを作り、description 欄にプロジェクト名と一言説明を入れる
2. このリポジトリを全履歴ごと clone し、`origin` を新リポ、`upstream` をフォーク元に設定する
3. `claude` を起動して `/fork-init <name>` を実行する(repo.json / 追随台帳 / src/lib/CATALOG.md / package 名 / src/business/business.ts / 機能のスイッチ src/config/featureGate/switches.config.ts / vercel.json / project.md の書き換えから初期コミット・push まで承認1回で完走。.env.development も作るがコミットには入れない)

詳細と手動で進める場合の手順:

➡️ **[新規プロジェクトの立ち上げ: フォークからデプロイまで](docs/setup/新規プロジェクトの立ち上げ_フォークからデプロイまで.md)**

### 上流の変更を取り込む

- `/flux` : upstream を fetch / merge し、追随作業が必要な変更(DOWNSTREAM NOTICE)を検出して適用・記録まで行う
- `/flux status` : 状態確認のみ
- 汎用機能が必要になったら自前実装せず `/order <上流リポ>` で上流に依頼し、`/wen` で状況を追う

仕組み: [`.notices/README.md`](.notices/README.md)

## Related

### 開発ドキュメント

設計の全体像と、各ルールの背景（なぜそうするか）は次から読めます。

➡️ **[docs/!must-read/](docs/!must-read/README.md)** — アーキテクチャの全体像（置き場所・処理の流れ・画面の分割・バックエンド・上流と下流の所有分担）と文書の地図

ルールの索引は [`CLAUDE.md`](CLAUDE.md)、各機能の使い方はコードの隣の `README.md` にあります。
