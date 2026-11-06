---
name: ship
description: このリポの変更を出荷する(範囲の確定 → 検査 → 下流への影響の判定 → 要るなら DOWNSTREAM NOTICE を書く → コミット → push)。ユーザーがコミット・push・出荷を指示したとき、/inbox の対応完了のときに使う。取り込む側の /flux と対になる
argument-hint: "[order:<指令 id>] [no-push] [hotfix] [補足メモ(任意)]"
---

あなたは今 **出荷**(このリポの変更をコミットして push し、下流 fork に追随作業が要るなら DOWNSTREAM NOTICE を同じコミットに入れる)を行います。受け取る側は下流の `/flux` で、notice の書き方はその読み方と揃える。仕様: `.notices/README.md`

## いつ使うか
- ユーザーがコミット・push・出荷を指示したとき(「コミットして」「プッシュして」「出荷して」)。指示が無ければ使わない(behavior.md: 指示なしにコミットしない)。
- `/inbox` の手順 4(「対応完了」)から。引数 `order:<id>` が付く。
- 下流を持たないリポ(末端 fork)でも使う。下流の有無は `.claude/rules/project.md` の `downstream: yes|none` の 1 行(読み手は `src/lib/forkOwnership/forkIds.mjs` だけ): `node --input-type=module -e "import { readForkIdentity } from './src/lib/forkOwnership/forkIds.mjs'; const i = readForkIdentity('.'); console.log(i.downstream ?? i.downstreamError)"`。`none` なら手順 3〜5(notice)を飛ばす。`yes` / `none` 以外(宣言が無い・誤り)なら文面から推し量らずに止まり、`fork_id:` と同じ節に宣言を足してもらう(`pnpm ownership:check` も未検証になる)。

引数: $ARGUMENTS(`order:<id>` = 指令から来た出荷、`no-push` = commit だけして push しない、`hotfix` = 緊急修正として出す(人間が指示したときだけ。自分の判断で付けない。全 fork の作業に割り込むため)、残りは補足メモ)

## 手順(確認を挟まず続けて行う。止まるのは下の「止まるとき」だけ)
0. **指令の担当を確かめる**(引数 `order:<id>` があるときだけ): `node .claude/skills/order/mailbox.mjs inbox` の出力でその id の件を見る。先頭の語が `taken` で `taken_by:` に `(you)` が無い、または `routed` で `routed_to:` に `(you)` が無いなら、**他の担当の指令**なので「<id> は <担当> が持っています」と警告して止まる(他のセッションと二重に出荷しないため。続けるかは人が決める。人が続けると決めたら、/inbox の resolve は `--force=<理由>` が要る)。一覧に無い(既に done/)ときも止まって伝える。open・自分の担当ならそのまま次へ
1. **範囲を確定する**:
   - `git status --short` と `git diff --cached --name-only`。同じ作業ツリーで他のセッションがステージしていることがある。出荷するのはこの会話で自分が変えたファイルだけ(会話で触ったファイルと照合する)。どちらか分からないファイルがあれば止まる。
   - 範囲が空なら「出荷するものなし」とだけ報告して終える(コミットも push もしない)。
   - 削除・改名を洗い出す: `git status --short` の `D` / `R` 行と、作業ツリーで消したファイル。手順 3 の判定と `moved:` に使う。
   - **他のセッションのコミットと重ならないか確かめる**: 基準 = 会話の冒頭の HEAD(環境の gitStatus の最新コミット。無ければ作業を始めたときに自分が見た HEAD)。`git log --format='%h %(trailers:key=Claude-Session,valueonly,separator=) %s' <基準>..HEAD -- <範囲のファイル(削除したものを含む)>` から、この会話のコミット(`Claude-Session:` がこの会話の session URL のもの)を除く。残りが空なら次へ。残ったコミットごとに `git show <sha> -- <file>` を読み、
     - 自分が削除・移動したファイル、または丸ごと書き直したファイルなら、その変更を移し先に移す(移せないなら止まる)
     - 部分的に編集しただけのファイルなら、`git diff HEAD -- <file>` でその変更を戻していないことを確かめる
     移したものは報告とコミット本文に書く。部分的な編集は作業ツリーが HEAD の上にあるので他の変更が自然に残り、消えるのは削除・移動・丸ごとの書き直しのときだけ。
2. **検査**(落ちたら直して再実行。直し方が自明でなければ止まる):
   - いつも: `pnpm check --gate=ship`(門 ship に乗る生成器・検査器の check を全部、順に回す: role・domain・registry・routes・cron・cycles・config・eslint と、watch つきの rules(`CLAUDE.md`・`.claude/rules/` を変えた時の test:core-rules)・notices(`.notices/`・ship / flux のスキルを変えた時の test:notices)。watch に当たらない対象は飛ばして 1 行出す、`--all` で全部。`scripts/runner/gates/README.md`)。落ちたら直して回し直す(生成のずれは `pnpm generate <対象>`)。
   - コード(`.ts` / `.tsx` / `.js` / `.mjs`)を変えた: `pnpm typecheck` と `pnpm exec eslint <変えたコードのファイル>`。
   - 変えた場所に応じたもの(当たるものは全部。門に乗った検査 = registry:check・routes:map --check・cron:check・test:config-module-load・eslint:required・test:cycles・test:core-rules・test:notices は上の `pnpm check --gate=ship` が回すので重ねない):
     - `src/lib/` の追加・削除・`src/lib/CATALOG.md` → `pnpm test:lib-catalog`
     - `domainEntry.ts`・`domain.json` → 登録表がずれていれば `pnpm generate registry`(= registry:generate)
     - `entities/drizzle.ts`・`src/registry/schemaRegistry.ts` → `pnpm test:schema-registry`。index を変えたら `pnpm db:push:check` が出す差分の説明を報告に書く(db:push 自体は実行しない)
     - `src/featureGate/rules/`・`src/proxies/*.ts` の項目・cron の `task.ts` → `pnpm extensions:check`(ずれていれば `pnpm extensions:generate`)と `FEATURE_GATE_CHECK=all pnpm test:feature-gate`
     - ページ・ルートの追加・削除・移動、loader・guard.ts の変更 → `pnpm routes:map` で地図(`src/app/route-map.jsonl`)を作り直して範囲に含め、`pnpm test:route-map`(地図の一致は check --gate=ship も見る)
     - `domain.json`・ロール定義(`*.role.json`)・`*.profile.json` → `pnpm forge`(生成と事後検査を 1 回で。生成物・`src/features/feature-map.txt`・ルート地図の変化を範囲に含める。表が変わった案内は報告に書く)
     - `.claude/skills/` → 変えたスキルの隣の `*.test.mjs`(`node --test <file>`)。スキルを消した・改名したら `git grep -n "/<旧名>"` で参照が残っていないこと(`.notices/` と `docs/journal/` は記録なので除く)
     - `package.json` の scripts → 足した・変えたスクリプトを 1 回実行して通ること(実行に DB・外部サービス・dev サーバーが要るものは実行せず、報告に「未実行: 理由」)
     - 上のどれでもない: 変えたファイルの隣にある `*.test.*` と、package.json の `test:*` のうち変えた領域の名前のもの
   - notice を含めるとき(手順 5 の後)は `pnpm check notices`(名前で呼ぶと watch を見ずに回す = test:notices)。
3. **下流への影響を判定する**(下流を持つリポだけ): 次のどれかに当たれば notice が要る。当たらなければ「notice 不要: <理由>」を報告に 1 行書いて手順 6 へ。
   - fork が手を入れうるファイル(docs・README・registry・config・core の部品など)の削除・移動(`.notices/README.md`「削除・移動は notice と同じ commit で出す」)
   - fork の既存コードが新しい仕様とずれる: export の削除・改名、引数・props・戻り値の型の変更、config のキーの増減、生成器の出力・命名・置き場の規約の変更
   - fork 側の手作業が要る: `db:push`(テーブル・列・index)、再生成、env、外部の準備、cron の増減・時刻変更(`pnpm cron:generate`)
   - 挙動・権限が黙って変わる
   - 変えた分野のルール・README が notice を求めている(CLAUDE.md や `.claude/rules/core/`、colocated README で「→ notice」「ship .notices」と書かれた条件。変えた分野のものを読んで確かめる)
   - 前に出荷したものの修正(手順 4)
   - 自分の `.claude/rules/lineage.md` の節(`## <自分の fork_id>`)を変えた: 下流に効く規則の変更なので必ず notice(言い回しだけの変更 = `severity: info` + `required_actions: none`)。`(default)` の鍵の削除・改名・`(default)` を外した・下流に作業が要る契約の変更は、`required_actions` に打ち消し(`overrides: <自分の fork_id>.<key> = …`)を書いている下流の直し方を書く(鍵の新しい名前へ書き換える・打ち消しを消す等。下流の `/flux` は打ち消しの鍵に触れた区間で止まる)
   - 下流の fork から来た指令の解決: 引数 `order:<id>` があり、その指令の依頼元が自リポ以外のリポ(`node .claude/skills/order/mailbox.mjs` の requester で判定。指令の `from:` の先頭がリポの origin URL で自リポと違う)。notice に `resolves: <id>` を書く。他に notice が要らなくても `severity: info` + `required_actions: none` + `checkpoint:` の notice を出す(下流の一時許可の失効に使う。`.notices/README.md`「解決(resolves)」)。却下・取り下げで閉じた指令にも書く
4. **修正かどうかを確かめる**: まず会話の文脈(不具合の報告・指令の need・「直して」)で判断する。
   - 文脈で修正と分かる、またはコードの既存の行を変えた・消した → 下の blame で修正元を特定する
   - 文書・スキル・設定の追記だけで、文脈にも不具合が無い → 確認を省き、報告に「修正ではない」と書く
   - `fixes:` を付けるのは、修正元の区切りに留まった fork で、ビルド・起動・挙動・データのどれかに害がある(検査が落ちる・自前で直す・同じ不具合を再オーダーする原因になる)ときだけ。/flux はその区切りの手前で全 fork を止めて聞くので、害の無いもの(上流側の道具・スキル・文書の書き方の改善)は修正として扱わない(notice の要否は手順 3 の他の項目で判断する)

   修正元の特定: 変えた行の元を辿る。変更前の行に `git blame -L <範囲> HEAD -- <file>` をかけ(または `git log -L`)、出てきた commit が最近の notice の区間に入っているか(`git log --diff-filter=A --format=%H -- .notices/` の各 notice の追加 commit との前後)を見る。会話の文脈(不具合の報告・指令の need)と合わせて、前の出荷の不具合を直すものなら `fixes:` の候補にする。修正元に notice があればその id、無ければ `commit:<短 sha>`。この修正に fork の追随作業が無くても、`fixes:` を伝えるために notice を出す(`severity: info`、`required_actions: none`)。
5. **notice を書く**(要るときだけ。事前確認は取らずに書き出す。下記「notice の合成」)。書いたら**索引の行を足す**: `node scripts/workflow/notices/shippedIndex.mjs add .notices/<id>.md`(自分の索引 `.notices/shipped/<fork_id>.md` の末尾に本文から 1 行。手で書かない・既存の行を直さない。`.notices/README.md`「出荷索引と本文の読み方」)。自分の索引がまだ無く自分の notice が既にあるリポ(索引の導入前から notice を出していた fork)は、先に `node scripts/workflow/notices/shippedIndex.mjs backfill`(親の索引に載る notice は飛ばす)。その後に手順 2 の `pnpm test:notices` を通す(索引の検査を含む)。
6. **コミットする**:
   - 自分のファイルだけを入れる(他のセッションのステージを巻き込まない)。notice は変更本体と同じコミットに入れる:
     - `git add` には作業ツリーにあるパスだけを渡す(削除・移動元は渡すと pathspec エラーで止まる。削除は `git rm` でステージするか、次の commit の pathspec に含める)。
     - `git commit -- <paths>` には削除したパス・ディレクトリも含める(commit の pathspec は削除も拾う)。
     - コミットの前に `git diff --cached --name-only` で、範囲のファイルだけが入っていることを確かめる(notice を書いたら `.notices/shipped/<fork_id>.md` も入る)。
   - メッセージは behavior.md の書式(件名 `<area>: <summary>`、空行、本文 = 判断の記録)。`order:<id>` があれば本文の後に `order: <id>` の行。末尾に環境指定のトレーラー。
   - ブランチは behavior.md とチームの方針に従う(既にフィーチャーブランチ上ならそのまま)。
   - 変更本体が既にコミット済みで notice だけ後から書いたときは、本体の直後のコミットにする(間に他の notice のコミットを挟まない)。`hotfix` では不可(本体と notice を必ず同じコミットに入れる。別なら取り消してまとめ直す)。
   - `fixes:` の notice を含めたとき、commit の後・push の前に **先に取れるかを判定する**(`.notices/README.md`「修正(fixes)」の「先に取れる印(pick)」): `pnpm notices:pick-check <この commit>`。壊れた地点(修正元の区切りのコミット)にこの commit だけを載せた一時の木(fork がその地点までに先に取っている別の `pick: clean` の修正は先に載せる)で、1 commit・lock / route-map なし・手順が後の notice を名指さない・cherry-pick の衝突なし・`pnpm typecheck`・`pnpm test:config-module-load`・`pnpm registry:check`・前提の検査を見て(この commit が足した索引の行は捨てて載せる。索引だけの衝突は数えない)、**索引のその notice の行**に `pick:clean` か `pick:-` を書く(本文には書かない。人は書かない・書き換えない。行が無ければ書かずに exit 2 = 手順 5 の add を忘れている)。
     - exit 0 / 1(clean / -): 書かれた索引を同じ commit に入れる: `git commit --amend --no-edit -- .notices/shipped/<fork_id>.md`(push 前の自分の commit だけ。`pick:` は判定に影響しない)→ `pnpm test:notices`。`-` でも止まらずに出荷する(fork は今の fixes の動きで受ける)。外れた条件を報告に書く
     - exit 2(判定できない: 修正元が履歴に無い・依存を入れられない): 欄を書かずに出荷し(欄なし = `-` と同じ扱い)、報告に「pick 未確認: <理由>」
     - 「未実行: <検査>」(その土台の木に script が無い)は報告に書く
   - `hotfix` のとき、commit の後・push の前に **pick できるか確かめる**(`.notices/README.md`「緊急修正(hotfix)」): `pnpm test:notices` を通し直す。`fixes:` があれば上の `pnpm notices:pick-check` がその確かめを兼ねる: `-` の理由が衝突・検査の失敗・後の notice への依存なら push せず止まる(「止まるとき」)。`fixes:` が無ければ省く(どの版に当てるかが決まらないため。報告に「未確認: 修正元なし」)。
     続けて **遅れた fork で前提が揃うか確かめる**: `pnpm notices:hotfix-check <この commit>`。fleet.conf の各 fork の位置(merge-base)に pick した木で、この commit が足した・変えたパス指定ルールの `paths:`、notice の手順の `pnpm <script>`、notice が名指すパスがあるかを見る(間の変更で届くものに頼っていないか)。exit 1 → push せず止まる(「止まるとき」)。exit 2(fork の位置が分からない)→ 報告に「未確認: 遅れた fork の位置」と書いて進む。位置が分かれば `--base=<sha>` で渡せる。
   - push の前に **途中の区切りを確かめる**(`.notices/README.md`「区切り(checkpoint)と区間適用」の「途中の区切りの検査」): 範囲 `origin/<branch>..HEAD` に先端の commit 以外で足した区切りの notice があれば、`node scripts/workflow/notices/checkpointCheck.mjs origin/<branch>..HEAD`。fork が区間ごとに merge し、直後に取る `pick: clean` の修正も取って持つ木で各区切りに typecheck・test:config-module-load・test:core-rules・registry:check を通す。
     - exit 1(壊れた区切りがある): push せずに止まる。その区切りが push 前の自分の commit なら、その commit を直して(rebase で直す・本体と notice と索引の行を揃える)検査を通し直す。push 済みの区切り(sha を保つ必要がある脇の commit を含む)なら、`fixes: <その notice>` の修正を出して pick-check で `pick: clean` にする
     - exit 2(判定できない: 依存を入れられない等): 報告に「途中の区切り未確認: <理由>」と書いて進む
7. **push する**(`no-push` のときはしない): `git push`。できなかったら取り繕わず理由を報告する。
8. **報告**(日本語):
   - 先頭に下流の取り込み判定(実測)を 1 行: `取り込み判定: 安全 | 要注意(理由)| 危険(理由)`。危険 = そのまま merge すると fork のビルド・起動・既存動作が壊れる / fork 側の手作業が要る / 挙動・権限が黙って変わる。要注意 = merge の衝突が起きうる程度。下流が無ければ省く。
   - コミットの短 sha・push 先(またはしなかった理由)・検査の結果・notice の id と change の要約(書かなかったなら「notice 不要: <理由>」)・`fixes:` を付けたならその参照先・`resolves:` を付けたならその指令 id。
   - `fixes:` の notice を出したときは、`pick:` の判定(clean / - と外れた条件 / 未確認)を伝える。
   - `hotfix` のときは、緊急修正として出したことと pick の確認の結果、各 fork で `/flux` が要ること(打つまで fork は気づかない)を伝える。
   - `/inbox` から来たときは、ここで止まらず `/inbox` の手順 4 の続き(RESOLUTION)に戻る。commit sha と push の結果をそこで使う。

## 止まるとき
- 範囲に入れてよいか分からないファイルがある(他のセッションの変更かもしれない)。
- 検査が落ち、直し方が自明でない。
- 下流への影響の判定で、notice の required_actions が下流の Claude に実行できる具体度で書けない(上流の変更の側を直すべきかもしれない)。
- `hotfix` で、前の未出荷・未取り込みの変更に依存している、または pick の確認(`notices:pick-check`)が衝突・検査の失敗を挙げた(依存する変更を示し、hotfix をやめて通常の出荷にするか、依存を外すかを聞く)。
- `hotfix` で、`notices:hotfix-check` が遅れた fork の木に無いものを挙げた(その一覧を示し、選択肢を聞く: 依存を外す / notice の required_actions に、その fork で何が通らず何をするかを書き足す / hotfix をやめて通常の出荷にする / そのまま出す)。ルールの `paths:` を、検査を通すためだけに変えない(どのファイルで読まれなくなるかを言わずに変えない)。
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
   skip_checkpoint: <notice id>, ...   (only on a fix that cannot be picked ahead, see below; omit the line otherwise)
   uses: <path>, ...   (only when required_actions run a migration / codemod shipped in this commit; omit the line otherwise)
   resolves: <order id>, ...   (only when this change resolves orders a downstream repo filed in this repo's inbox; omit the line otherwise)
   hotfix: <why forks must take this ahead of other changes, one line>   (only with the `hotfix` argument; omit the line otherwise)
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
   - `pick:` は本文に書かない(手順 6 の pick-check が索引の行に書く)。値に ` | ` を含めない(索引の行の区切り。`shippedIndex.mjs add` が止まる)。
   - **`uses:`**: required_actions が実行する移行(`src/features/<domain>/scripts/migrations/`)・codemod(`.notices/<id>.<名前>.mjs`)を列挙し、同じ commit に入れる。`uses:` を持つ notice は `checkpoint:` をラベルにする(`-` 不可)。`pnpm test:notices` が実在と区切りを見る(`.notices/README.md`「使う移行・codemod の欄」)。
   - **`skip_checkpoint:`**: `fixes:` の修正元の区切りが動かない(その区切りで fork の検査が落ちる)のに、手順 6 の pick-check が `-` のときだけ、修正元の id を書く(各 id は `fixes:` にあること。修正の notice 自身はラベルの区切り)。修正元が `uses:` を持つなら外せない。pick-check の後に本文へ足したら、push 前の行を本文から作り直す: `node scripts/workflow/notices/shippedIndex.mjs refresh .notices/<id>.md`(行の `pick:` は保つ。push 済みの行は拒否。手で直さない)→ `git commit --amend --no-edit -- .notices/<id>.md .notices/shipped/<fork_id>.md` → `pnpm test:notices`(`.notices/README.md`「区切りを外す欄」)。
   - `fixes:` の notice の required_actions・verify・refs は、壊れた地点の木に無いパス・script(その後に足した道具など)を名指さない(fork は壊れた地点の直後に取るので、pick-check の前提の検査が `-` にする)。後の道具に触れたい時は notes に書く(notes は前提の検査が読まない)。
   - `hotfix:` の notice の required_actions は、間の変更と後の notice を前提にせず書く(fork は間を飛ばして適用する)。`pnpm-lock.yaml`・`src/app/route-map.jsonl` を commit に含めない(fork ごとに中身が違う。`pnpm test:notices` が検査)。
   - **required_actions は「下流の Claude が承認 1 回で止まらずに実行できる具体度」**で書く。DB マイグレーション・バックフィル・再生成・データ移行も全部ここ。対話プロンプトを出すコマンド(db push 等)だけ `[user-run]`。ドメインの再生成は `pnpm dc:generate <Domain>`(既定で対話なし。`[user-run]` を付けない)で、必要なカテゴリだけ `--only` で指定する。設定を足した fork 側の一括の作り直しは `pnpm forge`。
   - fork の既存コードが新しい仕様とずれる変更では、fork 側の対象コードを探せる目印(grep パターン等)と、新しい仕様へ揃える手順を書く。互換を残して放置させない。
   - 自動化できないことだけ `manual_steps` に分ける(fail-auto)。
   - **管理画面全体に効く変更**(管理の共通部品・admin の layout / guard / loader の組・Screen の作りの API を変える等)の notice は、生成の管理画面の再生成(`pnpm dc:generate:all`)だけで終わらせない。fork には `"adminRoutes": false` のドメインの手書きの管理ページと、生成を写した `_components/` がある。required_actions に次をそのまま書く: (a) 手書きの管理ページを持つドメインを出す `git grep -l '"adminRoutes": *false' -- 'src/features/**/domain.json'` / (b) 変えた API を使う管理のファイルを出す `git grep -l -E '<変えた API の名前>' -- 'src/app/admin/**'`。そのうち頭に「このファイルは dc:generate が生成する」とある物(再生成で直る)と、上流と同じ物(`git diff --quiet <upstream>/<branch> -- <file>` が差分なし = merge で直る)を除いた残りが fork の手書き / (c) 残りの各ファイルを新しい形へ揃える手順。verify に `pnpm typecheck` と「(b) の残りが 0 件か、全部揃えた」を入れる
   - **config のキーを足させる notice では、fork が同じキーを既に持つ場合の手順も書く**: fork の分を消して upstream の行に揃える手順と、探す `git grep`。fork と upstream が別の位置に足すと git は衝突なしに両方を取り込むので、「衝突したら」「無ければ足す」だけでは足りない(`.notices/README.md`)。
   - fork の振る舞いの無い編集(コメントだけなど)を「残す」と書かない。upstream の文面に戻してよいと書く(`.notices/README.md`)。
   - **移動・改名したら `moved:` を必ず書く**(リポジトリルートからの相対パス、ディレクトリ可、`;` 区切り)。`git diff --name-status -M <変更前> <変更後>`(未コミットなら `git diff --cached -M --name-status`)で漏れなく洗い出す。git が改名と認識しない「新規作成 + 旧パス shim」でも書く。移動先の無い削除は `notes:` に削除したパスと fork 独自の内容の移し先を書く。
   - **特定の fork への影響を書くときは推測しない**。その fork のリポジトリで、この変更が触るファイル(移動元を含む)について fork 側の編集を差分で取り、結果をそのまま書く: `git -C <fork> diff --name-only $(git -C <fork> merge-base HEAD <fork 内の upstream remote>/<branch>) HEAD -- <files>`。空なら「上流ファイルの編集なし」、空でなければファイル名と `--stat` の規模。調べていない fork は `not checked`。
   - **core のコンポーネント・hook・service の呼び出し側(`_screen/*` の Screen など)を足す・切り替える変更では、verify に次の標準行を入れる**: `pnpm typecheck passes including upstream _screen/* default screens even where your page.tsx points to _components/; a failure there = your fork's core edit is not backward compatible (CLAUDE.md CORE_FILES fork_core_edit_compat) — fix the core side, do not edit the upstream Screen`
   - verify の型チェックは `pnpm typecheck` と書く(`tsc --noEmit` は使わない。`.notices/README.md`)。
   - **`checkpoint` = 原則ラベル**(英語ケバブ、既存と重ならない。迷ったら `<slug>`)。「この notice まで適用すれば fork は整合した休憩点にある」の宣言。**区切りの commit は動く状態であること**: その notice を含める commit で `pnpm typecheck` と `pnpm test:config-module-load`(部品を re-export する config を最初に読んだときの循環 import の検査)を通す。通らなければ修正を同じ commit に入れる(後の commit に回すなら `checkpoint: -` + notes)。区切りで画面が落ちると、全 fork の /flux がそこで止まって commit・push する。`-` は「後続の notice が無いと fork が動かない中間点」と断言できるときだけで、理由を `notes:` に書く(例: `notes: checkpoint:- because <id> (step 2) is required for the build to pass`)。迷ったら `-` にしない。
   - 追随作業は無いが区切りや `fixes:` だけ伝えたいときは `severity: info` + `required_actions: none` + `checkpoint: <label>`。
   - notice は区切りに含めたい変更本体と同じ commit か、それより後の commit に入れる(先に出すと merge 先に本体が含まれない)。
3. push 前の自分の commit(`origin/<branch>..HEAD`)は自由に直してよい(amend・rebase で本体・notice・索引の行を直す。索引の行は本文から作り直す: `shippedIndex.mjs refresh`)。出荷済み(push 済み)の notice の本文と索引の行は書き換えない(push 済みの行の変更は `pnpm test:notices` が止める)。修正の notice(`fixes:`)は push 済みの物を直す時だけ。書き間違い・不具合の修正・動かない区切りは、新しい notice の `fixes:`(と要るなら `skip_checkpoint:`)で示す(`.notices/README.md`「修正(fixes)」「区切りを外す欄」)。

## 本文の片付け
区間が閉じた notice の本文は、上流側で消してよい(期限なし。`done/` へは移さない。索引の行は残す)。移行・codemod を使う notice は、出荷 → 自分の DB で実行 → 次の commit で添付と本文を消す。片付けだけの削除に notice は要らない(`.notices/README.md`「本文と添付物の片付け」)。台帳は上流へは流れないので、上流での適用状況の追跡はしない。

## 言語
ユーザーとの会話は日本語。notice の中身は英語。
