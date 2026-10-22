---
name: downreq
description: 上流リポの変更に伴い、下流fork群で追随作業(コード修正・DBマイグレーション・バックフィル等)が必要になるとき、DOWNSTREAM NOTICE を .notices/ に起票する。T1→T2 / T2→T3 など任意の上流→下流で使用可
argument-hint: "[relay | 補足メモ(任意)]"
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
   checkpoint: <label | ->
   moved: <old path> -> <new path>; ...   (only when the change moves/renames files or dirs; omit the line otherwise)
   covers: <upstream notice id>, ...   (relay mode only; omit the line otherwise)
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
   - **ファイル・ディレクトリを移動・改名したら `moved:` を必ず書く**(リポジトリルートからの相対パス、ディレクトリ可、`;` 区切り)。移動の全組を `git diff --name-status -M <変更前> <変更後>` で洗い出して漏れなく載せる(git が改名と認識しない「新規作成 + 旧パス shim」でも書く)。下流の /flux はこれを使って fork の編集を新しいパスへ移植する。
   - **削除・移動は notice と同じ commit で出荷する**(後の commit に回さない。区間がずれて fork に案内の無い modify/delete コンフリクトが届く)。`git diff --name-status --diff-filter=DR <変更前> <変更後>` で削除・改名を全て洗い出し、改名は `moved:`、移動先の無い削除は `notes:` に削除パスと fork 独自内容の移し先を書く。変更本体が既にコミット済み(未 push)なら、notice は本体の直後の commit にし(間に他の notice の commit を挟まない = 同じ区間に入る)、その旨をユーザーに伝える(仕様: `.notices/README.md`「削除・移動は notice と同じ commit で出す」)。
   - **特定の fork への影響を書くときは推測しない**。その fork のリポジトリで、この変更が触るファイルについて fork 側の編集を差分で取り、結果をそのまま書く:
     `git -C <fork の作業ディレクトリ> diff --name-only $(git -C <fork> merge-base HEAD <fork 内の upstream remote>/<branch>) HEAD -- <この変更が追加・変更・削除・移動するファイル>`
     (移動元のパスも含める)。出力が空なら「上流ファイルの編集なし」、空でなければファイル名と `--stat` の規模を書く。fork 自身のファイル(fork が足したページ等)の確認はこれとは別に行い、混同しない。調べていない fork は `not checked` と書く。
   - **上流が core のコンポーネント・hook・service の呼び出し側(`_screen/*` の Screen など)を足す/切り替える変更では、verify に次の標準行を入れる**: `pnpm typecheck passes including upstream _screen/* default screens even where your page.tsx points to _components/; a failure there = your fork's core edit is not backward compatible (CLAUDE.md CORE_FILES fork_core_edit_compat) — fix the core side, do not edit the upstream Screen`
   - **`checkpoint`(区切り) = 原則必ずラベルを入れる**(英語ケバブ。迷ったら `<slug>` をそのまま使う)。意味は「この notice まで適用すれば fork は整合した休憩点にある」。notice は追随作業の単位で出荷されるので、適用し終えた時点で fork が整合しているのが普通 = 1 notice が 1 休憩点。/flux はこの区切りごとに merge→適用→verify→commit→push を閉じるので、DB 規模が大きい fork や独自要素の多い fork でも 1 変更ずつ安全に進められる。
     - **`-` は例外宣言**: 「後続の notice を適用しないと fork が動かない中間点」と断言できるときだけ。理由を `notes:` に書く(例: `notes: checkpoint:- because 20261020-... (step 2) is required for the build to pass`)。迷ったら `-` にしない。
     - 追随作業は無いが区切りだけ置きたい commit には、`severity: info` + `required_actions: none` + `checkpoint: <label>` の notice を起票する。
     - 下流は notice ファイルを追加した commit を git 履歴から導出して merge 先にする。よって **notice は、その区切りに含めたい変更本体と同じ commit か、それより後の commit** に含めること(先に出してはいけない)。
3. **事前確認は取らず、そのままファイルを書き出す**。「この内容で起票していいですか?」等の承認待ち・AskUserQuestion は**禁止**(ただの md で、後から編集・削除で修正可能なため):
   - パス: `<リポジトリルート>/.notices/<ts>-<slug>.md`
4. 日本語で報告: change / required_actions の要約(1〜3行)+ 保存パス + 次の案内:
   - 「**変更本体と同じコミット/PR に含めて出荷してください**(merge と通知がセットで届くのはこのときだけ保証されます)。変更が既にコミット済みなら notice 単独のコミットでも届きます」
   - 「下流側は upstream merge 後(または `/flux` 実行時の自動 merge で)検出されます。修正があればこのファイルを直接編集します(言ってください)」
   - コミット自体はこのリポの通常の運用(明示指示)に従う。勝手にコミットしない。

## relay モード($ARGUMENTS が `relay` で始まるとき)
中間 Tier(T2 など)が、自分が `/flux` で適用した上流 notice を下流(T3)へ中継する notice を下書きする。仕様: `.notices/README.md`「中継(relay)」。上記「手順」の 1・3・4 はそのまま使い、2 の材料を次で置き換える(`relay` 以降の文字列は補足メモ扱い)。
- 通常の中継は `/flux` が区間ごとに差分で判定し、必要な区間だけ下書きまで行う(`.claude/skills/flux/relay.md`「中継判定」)。このモードは、その仕組み導入前に適用した**未判定**の旧 notice の後始末用。
- 下記の手順 3〜4(材料集めと合成)は `/flux` の中継判定から呼ばれる共通の合成規則でもある。`/flux` から使うときは、`covers:` は `/flux` が渡す id(その区間で差分ありの id と、その covered id)に置き換え、手順 1・2・5 は使わない。
1. **自 fork 台帳を特定**: fork-id は `/flux` と同じ規則(origin URL のパス部分、`.git` 除去、`/`→`--`、小文字化)。台帳 = `.notices/applied/<fork-id>.md`。無ければ「中継対象なし」と報告して終了。
2. **未判定 id を求める**: 台帳の id のうち、その行に `relay:` 欄が無く、notice ファイル(`.notices/<id>.md` または `done/<id>.md`)の `from:` が自分の origin でなく、自分の origin の notice のどの `covers:` にも含まれないもの。0 件なら「未判定の notice はありません」と報告して終了(書き出さない)。
3. **id ごとに材料を集める**(推測しない):
   - 上流 notice 本文(change / required_actions / moved / verify)
   - 自台帳のその id の行の `notes:`(逸脱・移植した移動・解消した衝突・足した hook 等)
   - 台帳に記録した commit: `git log -S"id:<id>" --reverse --format=%h HEAD -- .notices/applied/<fork-id>.md` の先頭。その commit とその直前の merge commit が、下流が受け取る「解消済みの点」
   - 自分が上流ファイルに加えている編集のうち、その notice が触ったファイルに当たるもの: `git diff --stat <upstream>/<branch> HEAD -- <notice が触ったファイル>`(下流がこの fork の版を受け取る箇所)
4. **合成**(スキーマは上記と同じ。英語):
   - `covers:` = 未判定 id 全件(履歴順)。旧 notice は差分判定の基準点が古く機械判定できないため、追随作業の無いものも含めて閉じる。
   - `moved:` = covered 全件の `moved:` + 自分が中継対象の作業で行った移動(台帳 notes と `git diff -M --name-status` で確認)を合わせたもの。
   - `change:` = 「<自分> applied N <上流> notices: <id> in <sha>, ...」+ 下流に影響する自分側の差分(移植先・自分固有の移動・新しい拡張点)。
   - `why:` = 下流から見て何が残っているか(上流のコード作業はこの fork で済んでいる。残りは下流自身のカスタマイズと旧パス参照等)。
   - `required_actions:` の先頭 2 行は**必ず**次を入れる(`covers:` を知らない旧 /flux 向けの互換。新 /flux では no-op):
     `1. Merge <自分の repo> up to THIS notice's commit in ONE segment; do NOT stop at the covered notices' commits (<covered 側の上流 commit 短 sha 列>) — they are raw <上流> commits without <自分>'s conflict resolutions.`
     `2. Record THIS notice and the covered ids (<id>, ...) in your own ledger .notices/applied/<your-fork-id>.md (notes for covered ids: "covered by <this id>"); do not edit .notices/applied/<fork-id>.md.`
     以降に、上流 notice の required_actions のうち下流にも残る作業を、この fork の状態(移植先・自分固有のパス)に合わせて書き直したもの。
   - `verify:` = covered 側の verify のうち下流で意味があるもの + この fork の検証結果(実際に取った数値のみ)。
   - `checkpoint:` = ラベル必須(中継 notice は下流にとって 1 つの休憩点)。
   - `refs:` = covered の上流 notice パス、台帳記録 commit、自台帳パス。
5. 書き出し・報告は上記手順 3・4 のとおり(事前確認なし)。報告に「中身は台帳 notes と commit から組み立てた下書きなので、確認・編集してからコミットしてください」と添える。

## 完了追跡について
- 下流 fork の適用記録は**各 fork のリポジトリ内** `.notices/applied/<fork-id>.md` に残る(fork ごとの台帳)。台帳は上流へは流れてこないため、上流側での追跡コマンドは設けない(往復不要)。
- 全 fork 適用済み・陳腐化したと判断したら、上流側で手動で `.notices/done/` へ `git mv` してよい(下流には merge で伝播し、/flux の走査対象から外れる)。

## 言語ルール
- ファイル(通知)の中身は英語・構造化。ユーザーとの会話は日本語。
