---
name: ship
description: このリポの変更を出荷する(範囲の確定 → 検査 → 下流への影響の判定 → 要るなら DOWNSTREAM NOTICE を書く → コミット → push)。ユーザーがコミット・push・出荷を指示したとき、/inbox の対応完了のときに使う。取り込む側の /flux と対になる
argument-hint: "[order:<指令 id>] [no-push] [補足メモ(任意)]"
---

あなたは今 **出荷**(このリポの変更をコミットして push し、下流 fork に追随作業が要るなら DOWNSTREAM NOTICE を同じコミットに入れる)を行います。受け取る側は下流の `/flux` で、notice の書き方はその読み方と揃える。仕様: `.notices/README.md`

## いつ使うか
- ユーザーがコミット・push・出荷を指示したとき(「コミットして」「プッシュして」「出荷して」)。指示が無ければ使わない(behavior.md: 指示なしにコミットしない)。
- `/inbox` の手順 4(「対応完了」)から。引数 `order:<id>` が付く。
- 下流を持たないリポ(末端 fork)でも使う。下流の有無は `.claude/rules/project.md` の TIER 節で判断し、無ければ手順 3〜5(notice)を飛ばす。

引数: $ARGUMENTS(`order:<id>` = 指令から来た出荷、`no-push` = commit だけして push しない、残りは補足メモ)

## 手順(確認を挟まず続けて行う。止まるのは下の「止まるとき」だけ)
1. **範囲を確定する**:
   - `git status --short` と `git diff --cached --name-only`。同じ作業ツリーで他のセッションがステージしていることがある。出荷するのはこの会話で自分が変えたファイルだけ(会話で触ったファイルと照合する)。どちらか分からないファイルがあれば止まる。
   - 削除・改名を洗い出す: `git status --short` の `D` / `R` 行と、作業ツリーで消したファイル。手順 3 の判定と `moved:` に使う。
2. **検査**(落ちたら直して再実行。直し方が自明でなければ止まる):
   - コード(`.ts` / `.tsx` / `.js` / `.mjs`)を変えた: `pnpm typecheck` と `pnpm exec eslint <変えたコードのファイル>`。
   - 変えた場所に応じたもの(当たるものは全部):
     - `CLAUDE.md`・`.claude/rules/core/` → `pnpm test:core-rules`
     - `src/lib/` の追加・削除・`src/lib/CATALOG.md` → `pnpm test:lib-catalog`
     - `src/app/api/cron/` → `pnpm cron:check`
     - `domainEntry.ts`・`domain.json` → `pnpm registry:check`(ずれていれば `pnpm registry:generate`)
     - `entities/drizzle.ts`・`src/registry/schemaRegistry.ts` → `pnpm test:schema-registry`。index を変えたら `pnpm db:push:check` が出す差分の説明を報告に書く(db:push 自体は実行しない)
     - `src/config/app/feature-gate.config.ts` → `pnpm test:feature-gate`
     - `src/config/ui/` → `pnpm test:config-module-load`
     - ページ・ルートの追加・削除・移動 → `pnpm routes:map` で地図を作り直して範囲に含め、`pnpm test:route-map`
     - ロール定義(`*.role.json`)→ `pnpm role:generate` の出力を範囲に含める
     - 上のどれでもない: 変えたファイルの隣にある `*.test.*` と、package.json の `test:*` のうち変えた領域の名前のもの
   - notice を含めるとき(手順 5 の後)は `pnpm test:notices`。
3. **下流への影響を判定する**(下流を持つリポだけ): 次のどれかに当たれば notice が要る。当たらなければ「notice 不要: <理由>」を報告に 1 行書いて手順 6 へ。
   - fork が手を入れうるファイル(docs・README・registry・config・core の部品など)の削除・移動(`.notices/README.md`「削除・移動は notice と同じ commit で出す」)
   - fork の既存コードが新しい仕様とずれる: export の削除・改名、引数・props・戻り値の型の変更、config のキーの増減、生成器の出力・命名・置き場の規約の変更
   - fork 側の手作業が要る: `db:push`(テーブル・列・index)、再生成、env、外部の準備、cron の増減・時刻変更(`pnpm cron:generate`)
   - 挙動・権限が黙って変わる
   - 変えた分野のルール・README が notice を求めている(CLAUDE.md や `.claude/rules/core/`、colocated README で「→ notice」「ship .notices」と書かれた条件。変えた分野のものを読んで確かめる)
   - 前に出荷したものの修正(手順 4)
4. **修正かどうかを確かめる**: 変えた行の元を辿る。変更前の行に `git blame -L <範囲> HEAD -- <file>` をかけ(または `git log -L`)、出てきた commit が最近の notice の区間に入っているか(`git log --diff-filter=A --format=%H -- .notices/` の各 notice の追加 commit との前後)を見る。会話の文脈(不具合の報告・指令の need)と合わせて、前の出荷の不具合を直すものなら `fixes:` の候補にする。修正元に notice があればその id、無ければ `commit:<短 sha>`。この修正に fork の追随作業が無くても、`fixes:` を伝えるために notice を出す(`severity: info`、`required_actions: none`)。
5. **notice を書く**(要るときだけ。事前確認は取らずに書き出す。下記「notice の合成」)。書いたら手順 2 の `pnpm test:notices` を通す。
6. **コミットする**:
   - 自分のファイルだけを `git add <paths>` し、`git commit -- <paths>` で入れる(他のセッションのステージを巻き込まない)。notice は変更本体と同じコミットに入れる。
   - メッセージは behavior.md の書式(件名 `<area>: <summary>`、空行、本文 = 判断の記録)。`order:<id>` があれば本文の後に `order: <id>` の行。末尾に環境指定のトレーラー。
   - ブランチは behavior.md とチームの方針に従う(既にフィーチャーブランチ上ならそのまま)。
   - 変更本体が既にコミット済みで notice だけ後から書いたときは、本体の直後のコミットにする(間に他の notice のコミットを挟まない)。
7. **push する**(`no-push` のときはしない): `git push`。できなかったら取り繕わず理由を報告する。
8. **報告**(日本語):
   - 先頭に下流の取り込み判定(実測)を 1 行: `取り込み判定: 安全 | 要注意(理由)| 危険(理由)`。危険 = そのまま merge すると fork のビルド・起動・既存動作が壊れる / fork 側の手作業が要る / 挙動・権限が黙って変わる。要注意 = merge の衝突が起きうる程度。下流が無ければ省く。
   - コミットの短 sha・push 先(またはしなかった理由)・検査の結果・notice の id と change の要約(書かなかったなら「notice 不要: <理由>」)・`fixes:` を付けたならその参照先。
   - `/inbox` から来たときは、ここで止まらず `/inbox` の手順 4 の続き(RESOLUTION)に戻る。commit sha と push の結果をそこで使う。

## 止まるとき
- 範囲に入れてよいか分からないファイルがある(他のセッションの変更かもしれない)。
- 検査が落ち、直し方が自明でない。
- 下流への影響の判定で、notice の required_actions が下流の Claude に実行できる具体度で書けない(上流の変更の側を直すべきかもしれない)。
止まったら、見つけたことと選択肢を平文で示して待つ。

## notice の合成
1. **provenance を Bash で取得**(推測しない): repo `git remote get-url origin`(無ければ `(no remote)`)/ branch `git rev-parse --abbrev-ref HEAD` / commit `git rev-parse --short HEAD`(これから作るコミットに入るなら `- (this commit)`)/ id 用 `date +%Y%m%d-%H%M%S`。
2. **次のスキーマちょうど**に合成する(機械間ファイルなので英語・簡潔。散文や表は使わない):
   ```
   # DOWNSTREAM NOTICE id:<ts>-<slug>
   from: <upstream repo> | branch:<branch> | commit:<short sha>
   date: <ISO8601>
   severity: breaking | action-required | info
   checkpoint: <label | ->
   moved: <old path> -> <new path>; ...   (only when the change moves/renames files or dirs; omit the line otherwise)
   fixes: <notice id | commit:<sha>>, ...   (only when this change fixes something shipped earlier; omit the line otherwise)
   change: <what changed upstream, one line>
   why: <why downstream must follow up>
   required_actions:
   1. <step executable by downstream Claude as-is: target files, commands, order>
   2. [user-run] <interactive command Claude cannot run (e.g. pnpm db:push) — /flux asks the user to run it in-session via `!` prefix, then continues>
   verify: <how downstream Claude verifies the result itself: query / curl / test command>
   manual_steps: <steps outside Claude's reach (Vercel env vars, external dashboards) | - if none>
   refs: <upstream files / commits / docs / related order id>
   notes: <anything else downstream should know>
   ```
   - `<slug>` は change から短い英語のケバブ。保存先は `.notices/<ts>-<slug>.md`。
   - **required_actions は「下流の Claude が承認 1 回で止まらずに実行できる具体度」**で書く。DB マイグレーション・バックフィル・再生成・データ移行も全部ここ。対話プロンプトを出すコマンド(db push 等)だけ `[user-run]`。ドメインの再生成は `pnpm dc:generate <Domain> --yes`(対話なし。`[user-run]` を付けない)で、必要なカテゴリだけ `--only` で指定する。
   - fork の既存コードが新しい仕様とずれる変更では、fork 側の対象コードを探せる目印(grep パターン等)と、新しい仕様へ揃える手順を書く。互換を残して放置させない。
   - 自動化できないことだけ `manual_steps` に分ける(fail-auto)。
   - **移動・改名したら `moved:` を必ず書く**(リポジトリルートからの相対パス、ディレクトリ可、`;` 区切り)。`git diff --name-status -M <変更前> <変更後>`(未コミットなら `git diff --cached -M --name-status`)で漏れなく洗い出す。git が改名と認識しない「新規作成 + 旧パス shim」でも書く。移動先の無い削除は `notes:` に削除したパスと fork 独自の内容の移し先を書く。
   - **特定の fork への影響を書くときは推測しない**。その fork のリポジトリで、この変更が触るファイル(移動元を含む)について fork 側の編集を差分で取り、結果をそのまま書く: `git -C <fork> diff --name-only $(git -C <fork> merge-base HEAD <fork 内の upstream remote>/<branch>) HEAD -- <files>`。空なら「上流ファイルの編集なし」、空でなければファイル名と `--stat` の規模。調べていない fork は `not checked`。
   - **core のコンポーネント・hook・service の呼び出し側(`_screen/*` の Screen など)を足す・切り替える変更では、verify に次の標準行を入れる**: `pnpm typecheck passes including upstream _screen/* default screens even where your page.tsx points to _components/; a failure there = your fork's core edit is not backward compatible (CLAUDE.md CORE_FILES fork_core_edit_compat) — fix the core side, do not edit the upstream Screen`
   - verify の型チェックは `pnpm typecheck` と書く(`tsc --noEmit` は使わない。`.notices/README.md`)。
   - **`checkpoint` = 原則ラベル**(英語ケバブ、既存と重ならない。迷ったら `<slug>`)。「この notice まで適用すれば fork は整合した休憩点にある」の宣言。**区切りの commit は動く状態であること**: その notice を含める commit で `pnpm typecheck` と `pnpm test:config-module-load`(部品を re-export する config を最初に読んだときの循環 import の検査)を通す。通らなければ修正を同じ commit に入れる(後の commit に回すなら `checkpoint: -` + notes)。区切りで画面が落ちると、全 fork の /flux がそこで止まって commit・push する。`-` は「後続の notice が無いと fork が動かない中間点」と断言できるときだけで、理由を `notes:` に書く(例: `notes: checkpoint:- because <id> (step 2) is required for the build to pass`)。迷ったら `-` にしない。
   - 追随作業は無いが区切りや `fixes:` だけ伝えたいときは `severity: info` + `required_actions: none` + `checkpoint: <label>`。
   - notice は区切りに含めたい変更本体と同じ commit か、それより後の commit に入れる(先に出すと merge 先に本体が含まれない)。
3. 出荷済みの notice を直すのは、その notice の書き間違い(手順が実態と合わない等)を直すときだけ。不具合の修正は修正元を編集せず、新しい notice の `fixes:` で示す(`.notices/README.md`「修正(fixes)」)。

## アーカイブ
全 fork が適用済み・陳腐化したと判断した notice は、上流側で手動で `.notices/done/` へ `git mv` してよい(下流には merge で伝わり、/flux の走査対象から外れる)。台帳は上流へは流れないので、上流での適用状況の追跡はしない。

## 言語
ユーザーとの会話は日本語。notice の中身は英語。
