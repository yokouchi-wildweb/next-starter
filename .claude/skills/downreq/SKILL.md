---
name: downreq
description: 上流リポの変更に伴い、下流fork群で追随作業(コード修正・DBマイグレーション・バックフィル等)が必要になるとき、DOWNSTREAM NOTICE を .notices/ に起票する。T1→T2 / T2→T3 など任意の上流→下流で使用可
argument-hint: "[補足メモ(任意)]"
disable-model-invocation: true
---

あなたは今 **DOWNSTREAM NOTICE**(上流リポの変更に伴い、下流 fork 側で追随作業が必要になることを知らせる通知ファイル)を起票します。

通知はリポジトリ内 `.notices/` にコミットされ、**下流が上流を merge した瞬間に変更本体と一緒に届きます**(配送インフラ = git)。下流側は `/flux` がツリー内の notice と自 fork の適用台帳を突合して未適用を検出します。この仕組みは Tier1→Tier2 専用ではなく、任意の上流→その下流(T2→T3 等)で使えます。「上流」= いまいるこのリポ。仕様詳細: `.notices/README.md`

## 使う材料
- ここまでの会話の文脈(=どんな変更で、下流に何をしてほしいかは議論済みのはず)
- ユーザーからの補足(空のこともある): $ARGUMENTS

## 手順
1. **provenance を Bash で取得**(推測しない):
   - repo: `git remote get-url origin 2>/dev/null`(無ければ `(no remote)`)
   - branch: `git rev-parse --abbrev-ref HEAD`
   - commit: `git rev-parse --short HEAD`(通知対象の変更が別コミットなら、会話文脈から正しい sha を特定して使う)
   - id用タイムスタンプ: `date +%Y%m%d-%H%M%S`
2. 会話内容+補足から、通知を**次のスキーマちょうど**に合成する(**機械間ファイルなので英語・簡潔・散文や表は使わない**):
   ```
   # DOWNSTREAM NOTICE id:<ts>-<slug>
   from: <upstream repo> | branch:<branch> | commit:<short sha>
   date: <ISO8601>
   severity: breaking | action-required | info
   change: <what changed upstream, one line>
   why: <why downstream must follow up>
   required_actions:
   1. <step executable by downstream Claude as-is: target files, commands, order>
   2. [user-run] <interactive command Claude cannot run (e.g. pnpm db:push) — /flux asks the user to run it in-session via `!` prefix, then continues>
   verify: <how downstream Claude verifies the result itself: query / curl / test command>
   manual_steps: <steps outside Claude's reach (Vercel env vars, external dashboards) | - if none>
   refs: <upstream files / commits / docs / related upstream-request id>
   notes: <anything else downstream should know>
   ```
   - `<slug>` は change から短いケバブ(英語)。
   - **required_actions は「下流の Claude が承認1回でノンストップ実行できる具体度」で書くことが必須**。DB マイグレーション・バックフィル・再生成・データ移行もすべてここに含める。対話プロンプトを出すコマンド(db push 等)だけ `[user-run]` を付ける。
   - 自動化できないことが明示された `manual_steps` 以外は、すべて下流の Claude が実行する前提(fail-auto)。
3. **事前確認は取らず、そのままファイルを書き出す**。「この内容で起票していいですか?」等の承認待ち・AskUserQuestion は**禁止**(ただの md で、後から編集・削除で修正可能なため):
   - パス: `<リポジトリルート>/.notices/<ts>-<slug>.md`
4. 日本語で報告: change / required_actions の要約(1〜3行)+ 保存パス + 次の案内:
   - 「**変更本体と同じコミット/PR に含めて出荷してください**(merge と通知がセットで届くのはこのときだけ保証されます)。変更が既にコミット済みなら notice 単独のコミットでも届きます」
   - 「下流側は upstream merge 後(または `/flux` 実行時の自動 merge で)検出されます。修正があればこのファイルを直接編集します(言ってください)」
   - コミット自体はこのリポの通常の運用(明示指示)に従う。勝手にコミットしない。

## 完了追跡について
- 下流 fork の適用記録は**各 fork のリポジトリ内** `.notices/applied/<fork-id>.md` に残る(fork ごとの台帳)。台帳は上流へは流れてこないため、上流側での追跡コマンドは設けない(往復不要)。
- 全 fork 適用済み・陳腐化したと判断したら、上流側で手動で `.notices/done/` へ `git mv` してよい(下流には merge で伝播し、/flux の走査対象から外れる)。

## 言語ルール
- ファイル(通知)の中身は英語・構造化。ユーザーとの会話は日本語。
