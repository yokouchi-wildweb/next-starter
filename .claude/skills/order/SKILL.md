---
name: order
description: 指定したリポ(自分自身も可)の受信箱に、単発の作業指示・確認依頼を起票する。self 宛て = 自リポが次にやる作業の予約。受け取ったリポは /inbox で自分の役目に照らして受理を判断する
argument-hint: "<宛先: self | リポ名 | 省略で会話から判断> [補足メモ(任意)]"
---

あなたは今 **ORDER**(指定したリポの受信箱に、単発の「これをやって / 確かめて」を書き込む起票)を行います。

## メールボックスの構成
- 置き場: `~/.team/orders/`(このマシン上の共有フォルダ。git 管理外。実際の場所は `mailbox.mjs self` の `root:`)
- **受信箱はリポごと**: `<置き場>/<fork-id>/`(未対応)と `<fork-id>/done/`(対応済み)。fork-id = そのリポの `.claude/rules/project.md` の `fork_id: <短い名前>`(小文字・数字・ハイフン)。未宣言(行なし・旧い `-`)のリポは移行中だけ旧い名前(origin URL のホスト以降から `.git` を除き `/` → `--`、小文字。origin が無ければ `local--<ディレクトリ名>`)。宣言済みのリポの受信箱は、mailbox.mjs が名前を読んだときに旧い名前の箱から移り、旧い名前は新しい箱へのリンクとして残る
- 受信箱に入るのは単発の指令だけ。連続した・グループ化された指令は council の legate の中で扱う
- 宛先リポは自分の受信箱を `/inbox` で読む。起票したセッションは `/wen` で状況を確かめる
- 補助スクリプト: `node .claude/skills/order/mailbox.mjs <self | from | repos | inbox | name-check <名前> | resolve>`(リポのルートで実行。`from` = 起票する指令の `from:` 行。`name-check` = その名前を自リポの fork_id: にしてよいか(fleet.conf・手元のリポ・既存の受信箱と重ならないか。/fork-init が使う)。`resolve` = 指令に答える: RESOLUTION の追記と done/ への移動。手順は `.claude/skills/inbox/SKILL.md` の 4)

## 使う材料
- ここまでの会話の文脈(=何をしてほしいかは既に議論済みのはず)
- 引数: $ARGUMENTS(先頭の語が宛先。残りは補足メモ。宛先に当たらない語で始まるときは、全体を補足メモとして扱い、宛先は省略とする)

## 手順
1. **provenance を Bash で取得**(推測しない・手で組み立てない): `node .claude/skills/order/mailbox.mjs from` の `from:` 行をそのまま使う。
   - チーム(fleet・guild・council)のタブで実行すると、発行元はリポではなくそのチームの役職になる(タブの環境変数 `TK_TEAM` / `TK_INSTANCE` / `TK_LABEL` から作る)
   - id 用タイムスタンプ: `date +%Y%m%d-%H%M%S`
2. **宛先の受信箱を決める**:
   - `self`(または「自分」): `node .claude/skills/order/mailbox.mjs self` の `box:`
   - リポ名: `node .claude/skills/order/mailbox.mjs repos` の `repo:`(fork-id)か `path:` のディレクトリ名で照合し、その `box:`
   - 省略: 会話の文脈から宛先を決め、`repos` で受信箱を引く
   - 見つからない・複数当たる・会話から決めきれない: 候補を示して AskUserQuestion で聞く(推測で送らない)
3. 会話内容と補足から、指令を**次のスキーマちょうど**に合成する(**機械間ファイルなので英語・簡潔。散文や表は使わない**):
   ```
   # ORDER id:<ts>-<slug>
   from: <mailbox.mjs from の値>
   to: <target origin url> | box:<target fork-id>
   date: <ISO8601>
   status: open
   need: <one line — the work or check requested>
   why: <the situation driving it; for work that should live in the target repo, why it belongs there>
   done_when: <how the receiver can tell it is finished>
   constraints: <compat / must-not-break / perf / deadline | ->
   refs: <files, commits or code locations that show the need>
   notes: <anything else for the receiver | ->
   ```
   - `from:` は先頭が発行元(3 通り。読み手は mailbox.mjs の `requester` で見分ける):
     - リポのセッション = `<origin url> | branch:<branch> | cwd:<path>`
     - チームの役職 = `<team> <instance> | role:<役職名> | repo:<origin url> | branch:<branch> | cwd:<path>`(例: `fleet 20261024-220119 | role:Admiral | …`。repo: は動いていたリポで、参考情報)
     - 評議会の legate = `council <議題id> | …`(legate が自分で書く。role: 欄は無い)
   - self 宛てのとき: 後で読むのは文脈を持たない別のセッションなので、`why:` と `refs:` に今の会話で分かっていることを省かず書く(どこまで決まったか、未決の点、読むべきファイル)
   - `<slug>` は need から短いケバブ(英語)で作る
   - `status:` は起票時 `open`。答えた側の `mailbox.mjs resolve` が done/ に移すときに RESOLUTION の status(done / partial / relayed / rejected / withdrawn)へ書き換える(手では書き換えない)
4. **事前確認は取らず、そのままファイルを書き出す**(受信箱のフォルダが無ければ作成)。宛先が決まった後の「この内容で起票していいですか?」等の承認待ちは**禁止**(起票はただの md ファイルで、後から編集・移動・削除で直せるため):
   - パス: `<宛先の box>/<ts>-<slug>.md`
5. 書き出したら日本語で報告:
   - **1 行目に宛先**: `宛先: <宛先リポ名>(<理由を短く>)`
   - need / done_when の要約(1〜3 行)+ **保存パス(フルパス。/wen はこのパスで状況を確かめる)**
   - 「宛先リポで `/inbox` を実行すると受け取れます。このセッションで `/wen` を打つと状況を確かめられます。宛先や内容を直すときはこのファイルを編集・移動します(言ってください)」

## 一時許可の依頼(fork が所有の検査の違反を通すとき)
`pnpm ownership:check` の違反のうち、受け口へ移せない・元に戻せない物(upstream に無い機能、upstream のバグ・性能・セキュリティの修正)は、直接の親への依頼 + 一時許可で通す(`src/lib/forkOwnership/README.md`「一時許可」)。
1. 宛先 = 直接の親(`.claude/rules/project.md` の TIER、無ければ origin 以外の remote の repo)。上の手順で起票する。need に違反のパスと upstream に要る物(受け口・修正)、refs に検査の違反の行と許可の下書きの行(`<path> upreq:<依頼の番号> base:… head:…`)、why に fork が今その書き換えを要る理由
   - 削除・rename の許可の依頼は「止める受け口(feature-gate 等)を用意してほしい」、祖先 lib への追加は「その lib に入れてほしい / 受け口がほしい」に限る
   - upstream の負債の箇所(intake.txt の debt)と、upstream が既に受けた依頼(受信箱の修正の依頼)は起票しない。intake.txt の debt の理由欄・依頼の id をそのまま使う
2. 起票した id で下書きの `<依頼の番号>` と `<理由>` を埋め、`.fork-ownership/<fork-id>.permits.txt` に 1 ファイル 1 行で貼る(同じファイルに複数の依頼なら `upreq:<id>,<id>`)
3. 許可ファイルを commit してから `pnpm ownership:check` を走らせ直し、その行が permitted になることを確かめる
4. 依頼の状況は `/wen permits` で確かめる。解決(親の notice の `resolves:`)・却下を見たら、その行を外して受け口へ移すか元に戻す

## self 宛ての使いどころ
- 今は着手しない次の作業を、このリポの作業待ちとして残す(会話を閉じても消えない。`/inbox` に一覧で出る)
- 進行中の作業の引き継ぎ(状態・次の一手)は auto-memory の役目で、self 宛ての指令は「着手前の作業の予約」に使う

## 言語ルール
- ファイル(指令書)の中身は英語・構造化。ユーザーとの会話は日本語。
