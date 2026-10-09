---
name: fork-init
description: upstream(next-starter 等)を clone した直後のリポジトリで、新規プロジェクトのフォーク初期設定を承認1回で完走する。GitHub リポ作成・リモート整理・pnpm install・フォーク固有ファイル(project.md / 台帳 / package 名 / business.config / README / .env.development)の書き換え・初期コミット・push まで
argument-hint: "<name> [github-owner]  例: 88-base yokouchi-wildweb"
disable-model-invocation: true
---

あなたは今、**upstream を clone した直後のリポジトリの中で**、新規プロジェクトのフォーク初期設定を行います。

手順の正は `docs/how-to/initial-setup/新規プロジェクトの立ち上げ_フォークからデプロイまで.md` です。**最初にその文書を読み**、本スキルは文書の手順 2(リモート整理以降)〜手順 4(初期コミットと push)を実行役として代行します。文書と本スキルが食い違ったら文書を優先し、食い違いをユーザーに報告してください。

## 大原則
- **承認は計画提示時に1回だけ**。承認後は GitHub リポ作成・リモート変更・ファイル書き換え・コミット・push まで途中確認なしで完走する。この承認は「コミットと push の明示的指示」を含む。
- **推測で埋めない**。プロジェクト名・GitHub owner・サービスの一言説明・Tier・バックエンドの有無は、引数と会話から確定できないものをまとめて1回で質問する。
- **upstream の履歴は保持する**。shallow clone(`git rev-parse --is-shallow-repository` が true)なら `git fetch --unshallow` を提案して先に解消する。

## 事前確認(計画提示の前に行う)
1. `git remote -v` を確認する。期待する状態は「origin が upstream(フォーク元)を指し、`upstream` リモートはまだ無い」。
   - `upstream` リモートが既にある、または `.notices/applied/` に自分の fork-id の台帳がある → 初期化済み。その旨を伝えて終了する(再実行で壊さない)。
   - origin が無い → ユーザーにフォーク元 URL を尋ねる。
2. 引数 `$ARGUMENTS` から `<name>` と `[github-owner]` を取る。owner 省略時は `gh api user --jq .login` で取得する。
3. `gh auth status` でログイン済みか確認する。未ログインなら `! gh auth login` を依頼して待つ(ブラウザのコード入力はターミナルのワンタイムコード)。
4. `gh repo view <owner>/<name>` でリポジトリの有無を確認する。既存なら作成をスキップし、空でなければ(`isEmpty` が false)push 先として安全か確認を取る。
5. 以下を会話から確定する。足りないものは1回の質問にまとめる:
   - サービスの一言説明(日本語可。project.md には英語で書く)
   - Tier: 既定は「フォーク元の Tier + 1、下流なし」
   - バックエンド: Firebase / Neon を今設定するか、未設定で始めるか(既定: 未設定)
   - 予定ドメイン・方向性(無ければ「TBD」で可)
6. fork-id を導出する: origin になる URL のパス部分から `.git` を除去、`/` を `--` に置換、小文字化。

## 計画提示(承認を取る)
以下を箇条書きで提示し、承認を1回取る:
- 作成するリポジトリ(`<owner>/<name>` private)/ スキップの場合はその旨
- リモート: origin = 新リポ、upstream = 現 origin
- 書き換えるファイルの一覧(文書の手順 4 チェックリストと同じ 6 項目)
- 初期コミットの件名: `chore: <name> フォーク初期設定`
- push 先: `origin main`

## 実行(承認後、途中確認なし)
1. `gh repo create <owner>/<name> --private --description "<一言説明>"`(既存ならスキップ)。
2. `git remote rename origin upstream` → `git remote add origin git@github.com:<owner>/<name>.git`。
3. `pnpm install`(`node_modules` が無い場合のみ)。
4. フォーク固有ファイルの書き換え(文書の手順 4 の順):
   a. `.claude/rules/project.md`: 同じディレクトリの `project.template.md`(本スキルに同梱)をコピーし、`<...>` を事前確認で得た内容で埋めて置き換える。節の追加・削除はしない(未定の節は `TBD`)。先頭のコメントブロックは削除する。英語・箇条書き。
   b. `.notices/applied/<fork-id>.md`: `# APPLIED LEDGER fork:<origin url>` の1行のみ。
   c. `package.json`: `name` を `<name>` に。
   d. `src/config/business.config.ts`: `serviceName` / `serviceNameShort` / `description` / `descriptionShort` / `mail.defaultFromName` を `<name>` ベースに。`domain` / `url` / `mail.defaultFrom` は確定していれば入れ、未定なら upstream の名前を含まない仮値(`example.com` 等)にする。
   e. `README.md`: 冒頭の「プロジェクト概要」節を `<name>` の説明に置き換え、upstream 宣言の引用ブロックと「実案件へ適用する際は」の案内を削除する。開発ドキュメントへの導線は残す。
   f. `.env.development`: `.env.example` をコピーし、`APP_BASE_URL=http://localhost:3000`、`AUTH_JWT_SECRET`(`openssl rand -base64 32`)、`ENCRYPTION_KEY`(`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)を埋める。gitignore 対象であることを `git status` で確認し、**コミットに含めない**。
5. `pnpm tsc --noEmit` 相当の型チェックは不要(設定ファイルのみの変更)。`git status --short` で意図したファイルだけが変更されていることを確認する。
6. コミット: 件名 `chore: <name> フォーク初期設定` + 空行 + 本文(フォーク元、書き換えた項目、バックエンド未設定ならその旨)+ 環境指定の Co-Authored-By トレーラー。
7. `git push -u origin main`。

## 報告(日本語)
- 作成したリポジトリ URL、リモート構成、コミット sha
- `.env.development` に生成した値は**表示しない**(ファイルにあることだけ伝える)
- 次にユーザーがやること: `pnpm dev` で起動確認。以降の作業は新リポのディレクトリで別セッションを開くよう案内する
- バックエンドを後で接続する場合の導線: 文書の手順 3「機能別に必要なバックエンド」と `Neon_Firebaseなど各種バックエンドサービスの設定方法.md`

## 言語ルール
- ユーザーとの会話は日本語。`project.md` と台帳は英語。
