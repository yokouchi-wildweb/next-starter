---
name: upreq
description: 下流(fork)から上流リポへの機能・修正リクエストを構造化して、宛先リポの受信箱(共有メールボックス)に起票する。宛先は自分より上の Tier から起票者が判断して決める(Tier1 に限らない)
argument-hint: "[補足メモ(任意)]"
---

あなたは今 **UPSTREAM REQUEST**(下流 fork から、自分より上流のリポに「これを作って / 直してほしい」と依頼する起票)を行います。

## メールボックスの構成
- 置き場: `~/.team/upstream-requests/`(このマシン上の共有フォルダ。git 管理外)
- **受信箱はリポごと**: `~/.team/upstream-requests/<fork-id>/`(未対応)と `<fork-id>/done/`(対応済み)。fork-id は `/flux` と同じ導出(origin URL のホスト以降から `.git` を除き `/` → `--`、小文字)
- 宛先リポは自分の受信箱だけを `/inbox` で読む。別の枝のリポには届かない
- 補助スクリプト: `node .claude/skills/upreq/mailbox.mjs <self | chain | inbox | mine>`(リポのルートで実行)

## 使う材料
- ここまでの会話の文脈(=何が必要かは既に議論済みのはず)
- ユーザーからの補足(空のこともある): $ARGUMENTS

## 手順
1. **provenance を Bash で取得**(推測しない):
   - repo: `git remote get-url origin`(無ければ `(no remote)`)
   - branch: `git rev-parse --abbrev-ref HEAD`
   - cwd: `pwd`
   - id 用タイムスタンプ: `date +%Y%m%d-%H%M%S`
2. **宛先候補を取得**: `node .claude/skills/upreq/mailbox.mjs chain`
   - 出力 = 自分から最上流までの祖先(`ancestor 1` = 直上)。各祖先の url / 手元 checkout の path / project.md の場所 / 受信箱
   - 祖先が無い(`chain_end: root` で ancestor 0 件)= このリポが最上流。起票先が無いので、その旨を伝えて終了
   - `chain_end: not-cloned` = その祖先より上は手元で辿れない。辿れた範囲から選ぶ
3. **宛先を自分で決める**(ユーザーに聞かない。AskUserQuestion 禁止):
   - 判断の材料: 自分の project.md の TIER 節(`responsibility_boundary` 等の分担)と、各祖先の project.md(役割・扱うドメイン)
   - **新機能・汎用化の依頼** = その機能の概念を持つ最も上の Tier。ドメイン非依存(インフラ・UI 部品・CRUD 基盤・認証・開発ツール)→ 最上流。ある中間 Tier のドメイン固有(例: オリパ固有)→ その中間 Tier
   - **不具合の報告** = 問題のコードを持ち込んだ Tier。目安: 該当ファイルを持つ最も上の祖先(`git -C <祖先の path> ls-files <file>` で確かめる)。祖先側で改変されていれば、改変した祖先
   - **迷ったら近い方(下位)を選ぶ**: 近い祖先は汎用と判断すれば `/inbox` でさらに上へ回せるが、上位に入った依頼は無関係な枝にまで配られうる
   - 宛先の受信箱 = chain 出力のその祖先の `box:`
4. 会話内容+補足から、依頼を**次のスキーマちょうど**に合成する(**機械間ファイルなので英語・簡潔・散文や表は使わない**):
   ```
   # UPSTREAM REQUEST id:<ts>-<slug>
   from: <repo> | branch:<branch> | cwd:<path>
   to: <target origin url> | box:<target fork-id>
   routing: <one line — why this tier owns it (and why not the nearer/higher candidate)>
   date: <ISO8601>
   status: open
   need: <one line — the capability or fix requested>
   why: <the downstream use case driving it>
   generality: <why it belongs to the target tier, not local>
   proposed_api: <how downstream wants to consume it; signatures/shape>
   scope_hint: <suggested layer per CODE_PLACEMENT: lib / core / feature — the target decides>
   constraints: <compat / must-not-break / perf / deadline>
   refs: <downstream files or code locations that show the need>
   notes: <anything else for the target>
   ```
   `<slug>` は need から短いケバブ(英語)で作る。
5. **事前確認は取らず、そのままファイルを書き出す**(受信箱のフォルダが無ければ作成)。「この内容で起票していいですか?」等の承認待ち・AskUserQuestion は**禁止**(起票はただの md ファイルで、後から編集・移動・削除で直せるため):
   - パス: `<宛先の box>/<ts>-<slug>.md`
6. 書き出したら日本語で報告:
   - **1 行目に宛先**: `宛先: <宛先リポ名>(<理由を短く>)`
   - need / why / proposed_api の要約(1〜3 行)+ 保存パス
   - 「宛先リポで `/inbox` を実行すると受け取れます。宛先や内容を直すときはこのファイルを編集・移動します(言ってください)」

## 言語ルール
- ファイル(依頼書)の中身は英語・構造化。ユーザーとの会話は日本語。
