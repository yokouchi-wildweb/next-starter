---
name: flux
description: 下流(fork)側で upstream の変更取り込みと DOWNSTREAM NOTICE への追随対応を全自動で行う。fetch→未適用noticeをcheckpointごとの区間に分割→適用計画→承認1回→区間ごとに merge/コード修正/DB/バックフィル/検証/台帳記録/コミット/push。いつ実行しても自forkの対応状況を正確に把握できる
argument-hint: "[status | status --chain | next | notice id (省略で全区間を merge + 適用)]"
disable-model-invocation: true
---

あなたは今 **下流(fork)** として、上流リポの変更取り込みと **DOWNSTREAM NOTICE**(追随対応の通知、`.notices/*.md`)への対応を行います。この仕組みは任意の上流→下流(T1→T2, T2→T3 等)で使われます。仕様詳細: `.notices/README.md`

## 大原則
- **状態はイベントではなくファイルと履歴から導出する**: 「ツリー内に存在する現役 notice の集合」−「継承済み notice の集合(fork 成立点から自動判定、下記)」−「自 fork 台帳に記録済みの集合」= 未適用。merge が誰の手でいつ行われたかは問わない(手動 merge / GitHub 上の merge / このコマンドの merge、すべて同じに扱う)。
- **承認は適用計画の提示時に1回だけ**。承認後は merge・コード修正・DB 操作・バックフィル・検証・台帳記録・コミットまで途中確認なしで完走する。**ただし下記「停止条件」に当たったら完走より停止を優先する**(承認は「計画どおりなら進めてよい」であって「何が出てきても押し切れ」ではない)。
- **区間単位で進める**: 未適用 notice を区切り(`checkpoint:`)ごとの区間に分け、区間ごとに「merge → 適用 → verify → 台帳 → commit → push」を完結させる。**既定は notice 1 件 = 区切り 1 つ**(`checkpoint: -` と上流が例外宣言した notice だけが次の区切りまで同じ区間に入る。欄が無い旧 schema は区切り扱い = 安全側)。途中で止まっても fork は直前の区切りに居て、再実行すれば続きから進む(状態は集合演算で導出されるので追加の記録は不要)。
- **適用計画の承認 = DB 操作を含む全ステップの明示的実行指示とみなす**。このスキル実行中は「DB 操作はユーザーに依頼する」系の一般ルールより本規約が優先される。ただし対話プロンプトを出すコマンド(`[user-run]` マーカー付き、db push 等)だけは Claude では実行できないため、下記の in-session ユーザー実行で合流する。

## 停止条件(完走原則より優先)
区間の merge / 適用中に次のいずれかに当たったら、**その区間を commit せずに止めて報告する**(前の区間は commit 済みなので fork の整合は保たれる):
- 上流の変更がこの fork の固有ロジックやデータを壊す: merge で fork の挙動が消える / `[user-run]` の db:push 差分に DROP・列削除などデータ消失が含まれる / notice の手順が fork 固有のテーブル・ファイルを触る
- notice の `required_actions` と実態が食い違い、verify が通らず、直し方が自明でない
- `moved:` の移植(下記「移動・改名の移植」)で、fork の編集の一部を新しいパスに当て直せず、直し方が自明でない
- 上流の変更自体にバグや設計上の問題が見え、そのまま入れると fork が退行する
- fork の `.claude/rules/project.md` の制約・事業上の意図と矛盾する
- 判断が本当に割れるコンフリクト(従来どおり)
- merge 結果が区間の上流差分の外のファイルを変えた(手順 5 の「区間外変更の検査」。git の改名推定が fork の無関係なディレクトリへ上流ファイルを流し込む・fork のファイルを消す等)
止まり方: merge 途中(未 commit)なら `git merge --abort` で区間開始前に戻す。適用途中なら変更をそのまま残し、何を変えたかを示す。そのうえで「何を見つけたか / 根拠(ファイル・差分・出力)/ 選択肢(この notice をスキップして次の区間へ・手で直して続行・上流に報告して待つ)」を提示して**待つ**。勝手にスキップも押し切りもしない。再開はユーザーの指示で(`/flux next` や notice id 指定で続きから)。

## 上流への所見(findings)— 最終報告の常設項目
適用中に気づいたことを集め、最終報告の末尾に「**上流への所見**」として必ず出す(無ければ「なし」):
- (a) 上流のバグ・不備(取り込んだコードの問題、テスト漏れ)
- (b) notice と実態のズレ(手順が合わない、verify が通らない、書かれていない影響があった)
- (c) この fork で必要になった修正のうち、他 fork でも同じ修正が要りそうな汎用性のあるもの(= /upreq 候補)
- (d) 設計上の懸念
各項目: 1〜2 行 + 根拠(ファイル・commit・出力)+ 起票文案 1 行。**自動で /upreq は起票しない**。ユーザーが `/upreq` を打てば会話文脈から起票できる形にしておく。台帳の `notes:` には逸脱だけを書き、所見は報告側に出す(台帳は fork の記録であって上流宛てではない)。

## 自 fork の識別と台帳
1. origin 取得: `git remote get-url origin`
2. fork-id 導出: URL のパス部分(ホスト以降)から `.git` を除去し、`/` を `--` に置換、小文字化。例: `git@github.com:acme/shop.git` → `acme--shop`。origin が無ければ `local--<ディレクトリ名>`。
3. 自 fork 台帳 = `.notices/applied/<fork-id>.md`。無ければ未適用ゼロ記録として扱う(初回適用時に作成)。
4. `.notices/applied/` 内の他の fork-id のファイルは中間 Tier や他 fork の台帳(merge で流れてきたもの)。**自分の状態と混同しない**。参考情報として読むのは可。
5. **中間 fork-id** = 直上 upstream の URL から同じ規則で導出した fork-id。`<upstream>/<branch>` に `.notices/applied/<中間 fork-id>.md` があれば、直上 Tier は自分自身も下流として上流を追随している中間 Tier(下記「中継」で使う)。無ければ直上 upstream は最上流で、祖父 notice は存在しない。

## upstream の特定
1. `git remote -v` で origin 以外の remote(通常 `upstream`)を探す。
2. 無ければユーザーに upstream の URL を尋ね、`git remote add upstream <url>` してから続行する(勝手に推測しない)。
3. upstream のデフォルトブランチは `git ls-remote --symref <remote> HEAD` で特定する。

## 継承済み(pre-fork) notice の自動判定
fork は最新コードごと clone して始まるため、**fork 成立点のツリーに既に存在していた notice は定義上すべて適用済み**(継承済み)。これは台帳に記録せず、実行のたびに git 履歴から導出して未適用判定から除外する:
1. fork 固有の最初のコミット: `git rev-list --reverse HEAD ^<upstream>/<branch>` の先頭(= HEAD から辿れるが upstream に無い最古のコミット)。fetch 済みであること。
2. **無い場合**(fork がまだ何もコミットしていない)→ ツリー内の現役 notice は全件継承済み。
3. fork 成立点 = そのコミットに親があれば第一親(`<first_own>^`)、無ければ(ルートコミット = GitHub テンプレート起源等)そのコミット自身。
4. 継承済み集合 = `git ls-tree --name-only <fork成立点> .notices/` に存在する notice の id 群。
5. **shallow clone**(`git rev-parse --is-shallow-repository` が true)では履歴を辿れず判定不能。その旨を伝え、`git fetch --unshallow <upstream>` を提案するか、ユーザーに継承済み範囲を確認する(勝手に全件継承済み扱いしない)。
- 継承済み notice はファイル削除しない(下流で削除すると、上流がその notice を編集・done/ へ移動した際に merge で modify/delete コンフリクトになるため。判定式での除外が正)。

## モード分岐($ARGUMENTS)
- **空(既定)**: フルフロー(下記)。全区間を順に完走する。
- **`next`**: フルフローと同じだが、**最初の 1 区間だけ**処理して止まる(区間 0 があればそれ、無ければ区間 1)。残りの区間を見通しとして報告して終了。手動でペースを刻みたいとき・区間の合間にアプリを確認したいとき用。
- **`status`**: 状態報告のみ。fetch + 未マージコミット数 + 区間の見通し(区間番号 / merge 先 / 含まれる notice / checkpoint ラベル)+ 継承済み・台帳突合の結果を一覧表示して終了。**merge も適用も一切しない**。
- **`status --chain`**: 状態報告のみ(`status` と同じく merge も適用もしない)。祖父 notice(下記「中継」)ごとに 1 行: `<id> | 中間 Tier: applied <台帳記録 commit 短 sha> / not applied | relay: covered by <id> / none / not judged | me: applied / unapplied / inherited`(`none` = 中間 Tier の台帳が `relay:none`、`not judged` = covered されておらず台帳に `relay:` 欄も無い)。最後に、自分が中間 Tier として未判定の件数(下記「中継判定」の未判定)を 1 行。中間 Tier が無い(直上 upstream が最上流)なら「祖父 notice なし」とだけ出す。
- **notice id / ファイル名**: その notice だけを対象に、フルフローの手順 5 以降を行う(merge は行わない。既にツリーに存在する notice が対象。区間分割もしない)。

## 未適用判定(ツリー内・流入予定の両方に同じ規則を適用)
notice は次のいずれかに該当すれば対象外、残りが**未適用**:
- `from:` の repo URL が自分の origin と一致(ssh/https 表記差・`.git` 有無は無視)→ 自分が上流として起票したもの。
- 継承済み集合(上記の自動判定)に含まれる → 適用済み扱い。
- 自 fork 台帳に id が記録済み → 適用済み。
- covered 側の id(下記「中継」)は、covers 側 notice が適用済みなら適用済み。covers 側が未適用なら未適用のまま covers 側の区間に吸収される(単独では適用しない)。

## 中継(3 段以上の Tier)
仕様: `.notices/README.md`「中継(relay)」。
- **祖父 notice** = `from:` の repo が自分の origin とも直上 upstream の URL とも一致しない notice(URL 比較は未適用判定と同じく表記差を無視)。中間 fork-id の台帳が無いときは祖父 notice を判定しない(従来どおり)。
- **covers 索引**: ツリー内と流入予定のすべての notice(自分の origin のものを除く)の `covers:` を読み、`covered id → covers 側 id` の対応を作る。同じ id を複数の notice が covers していたら、履歴上最も早い covers 側を採る。
- **祖父 notice の区切り点** = 中間 Tier の台帳にその id が記録された commit: `git log -S"id:<id>" --format=%H <upstream>/<branch> -- .notices/applied/<中間 fork-id>.md` の最古(`--reverse` で先頭)。台帳の `commit:` 欄は使わない。見つからなければ追加 commit を区切り点とし、計画に「中間 Tier が未適用: T1 の生 commit で区切る」と警告する。
- 祖父 notice で covered されていないものは、中間 Tier の台帳のその id の行の `relay:` 欄で分ける:
  - `relay:none` → 中間 Tier が差分で「中継不要」と判定済み(下記「中継判定」)。上流 notice をそのまま適用する(注記・写像なし)。
  - 欄が無い(旧台帳)→ 計画に「<直上 upstream> からの中継 notice なし。required_actions は中間 Tier の状態を前提に書かれている」と注記し、中間 Tier の台帳の `notes:`(その id の行)を読んで自 fork の実情へ写像する。
  - `relay:<id>` なのにその中継 notice がまだ届いていない → 中継 notice は台帳記録と同じ commit で出荷されるので通常起きない。起きたら報告に含め、欄が無い場合と同じ扱いにする。

## 区間の組み立て
1. 未適用 notice を 2 群に分ける: **ツリー内**(`.notices/` 直下の `*.md`、`done/` と `applied/` は除外。前回の部分実行で merge 済みだが未適用のもの)と**流入予定**(`git diff --name-only HEAD...<upstream>/<branch> -- .notices/` のうち直下の `*.md`。内容は `git show <upstream>/<branch>:.notices/<id>.md` で読む)。
2. 流入予定の各 notice に**区切り点 commit** を対応づける: 通常は追加 commit `git log --diff-filter=A --format=%H <upstream>/<branch> -- .notices/<id>.md`(通常 1 件。複数なら最古)。祖父 notice は上記「中継」の区切り点(中間 Tier の台帳記録 commit)。`from: commit:` 欄は参考情報で、判定には使わない。
3. covered 側の notice(covers 索引にある id)を流入予定の並びから外し、covers 側 notice の区間に入れる(区切り点にしない)。covers 側が既に適用済みなら covered 側も適用済み扱い(上記「未適用判定」)。covers 側がまだ届いていない祖父 notice は covered と分からないので、通常の祖父 notice として扱う(区切り点 = 中間 Tier の台帳記録 commit)。
4. 残りの流入予定 notice を区切り点 commit の履歴順に並べる(`git rev-list --reverse --topo-order HEAD..<upstream>/<branch>` 上の位置。区切り点が既に HEAD の祖先なら区間 0 扱い)。
5. 区間を切る:
   - **区間 0** = ツリー内の未適用 notice(merge 不要)。空なら無し。
   - 以降、流入予定を履歴順に走査し、**区切り notice**(`checkpoint:` が `-` 以外、または欄が無い旧 schema)の**直後で区間を閉じる**。閉じた区間の merge 先 = その区切り notice の区切り点 commit。covers 側 notice の区間には、それが covers する id も「covered」として並べる。`checkpoint: -` の notice は次の区切りまで同じ区間に入る(上流の例外宣言。理由は notes: にある)。
   - 最後の区切り以降の notice(無ければ空)+ 残りのコミットが**末尾区間**。merge 先 = `<upstream>/<branch>`。notice が無くても未マージコミットがあれば末尾区間は存在する(merge のみ)。
   - 結果として通常は notice 1 件 = 1 区間。同じ commit で出荷された複数 notice は merge 先が同じ区間が連続する(merge は 1 回目で完了し、2 回目以降は「既に最新」になるだけ。正常)。
6. 区間ごとに持つ情報: 番号 / merge 先(短 sha と、checkpoint ラベル or `HEAD`)/ 含まれる notice id(covered id・祖父 notice はその旨を添える)/ そこまでのコミット数 / 衝突の予測と移動元の編集(下記「衝突の事前予測」)。

## 衝突の事前予測(計画時、読み取りのみ)
区間ごとに、その区間の merge で衝突しそうなファイルを承認前に出す。index・作業ツリーは変更しない。
1. 用語: `base` = `git merge-base HEAD <upstream>/<branch>`(計画時点の HEAD で 1 回だけ求める)。**fork 側の編集** = `git diff --name-only <base> HEAD`(全区間で共通)。**区間 k の上流側の変更** = `git diff --name-only <区間 k-1 の merge 先> <区間 k の merge 先>`(区間 1 は `<base>` から)。
2. git 2.38 以上(`git version`)なら区間 1 だけは正確に出せる: `git -c merge.directoryRenames=false merge-tree --write-tree --name-only HEAD <区間 1 の merge 先>`(exit code 1 = 衝突あり、出力に衝突ファイル)。区間 2 以降は前の区間の解消結果に依存するので 3 の近似を使う。`-c merge.directoryRenames=false` は手順 5 の merge と同じ設定にして予測と実際をそろえるため。
3. 近似(2.38 未満、および区間 2 以降): fork 側の編集と区間 k の上流側の変更の**共通部分**(両方を一時ファイルに書いて `comm -12` で突き合わせる)。近似であることを計画に明記する(同じファイルでも別の箇所なら実際は自動で解決される)。
4. 各ファイルに fork 側の編集規模 `git diff --stat <base> HEAD -- <file>` を添える。上流側の改名は `git diff -M --name-status <区間 k-1 の merge 先> <区間 k の merge 先>` の `R` 行を添える。
5. 計画には区間ごとに「衝突しそうなファイル(fork 側の編集規模)」と「移動元の編集」(下記)を載せる。無ければ「なし」。

## 移動・改名の移植(`moved:`)
上流が `git mv` ではなく「新規作成 + 古いパスを shim に置換」で移動すると、git は改名と認識せず、fork が古いパスで行った編集は shim との衝突になるか上流版で上書きされる。notice の `moved: <old> -> <new>; ...` を使って /flux が移植する(仕様: `.notices/README.md`「移動・改名(moved)」)。
0. 対象の組 = 区間内の notice(covers 側・covered 側の両方)の `moved:` を合わせたもの(同じ組は 1 つにまとめる)。
1. **計画時**: 対象の各組について `git diff --name-only <base> HEAD -- <old>` を取り、空でなければ計画に「fork が編集した移動元: <old> → <new>(ファイル数・規模)」と出す。
2. **merge 前**(手順 5 の直前): 編集のある各組について fork 側の差分を保存する: `git diff --binary <base> HEAD -- <old> > <scratch>/moved-<n>.patch`。
3. **merge 後**: 古いパスの衝突は上流版を採る(`git checkout --theirs -- <old>`、上流で削除済みなら `git rm`)。保存した差分のパス(`diff --git a/<old>... b/<old>...`・`--- a/`・`+++ b/` 行)を `<new>` に書き換え(ディレクトリはプレフィックスを置換)、`git apply --3way <書き換えた patch>` で当てる。
4. 当たらなかった hunk は衝突マーカーとして残る。上流側の変更と fork の意図を両立できる形で解消し、自明でなければ停止条件として止める。
5. 移植した組・ファイル・手で解消した箇所を台帳の `notes:` に書き、verify で新しいパス側に fork の編集が入っていることを確認する(`git diff <merge 先> -- <new>` に fork の変更が出る)。

## フルフロー
1. **偵察**: `git fetch <upstream>` → 未マージコミット数(`git rev-list --count HEAD..<upstream>/<branch>`)→ 上記「区間の組み立て」。working tree に未コミットの変更がある場合は先に報告し、stash してよいか確認する。
2. **一覧と計画**: 区間の見通しを日本語で一覧(区間番号 / merge 先 / notice id・severity・change / checkpoint ラベル)。継承済みとして除外した件数があれば 1 行添える。各 notice を全文読み(流入予定は `git show` で)、required_actions を**自リポの実情に写像した適用計画**(対象ファイル・コマンド・順序・`[user-run]` 合流点・verify 手順)として区間ごとに提示する。区間ごとに「衝突の事前予測」と「移動元の編集」(上記)も載せる。
   - 未適用ゼロ・未マージコミットもゼロなら「この fork の追随対応はすべて完了しています」で終了。未適用ゼロで未マージコミットだけある場合は merge のみの計画。
   - **乖離の掃討を計画に含める**: required_actions は最低線。notice の変更点・目印(grep パターン等)で fork 全体を検索し、旧仕様のまま残る fork 固有コード(required_actions に無いもの)も対象ファイルとして計画に載せる。
3. **承認を 1 回だけ取る**。以後は全区間を完走する(`next` なら 1 区間)。
4. **区間ループ**: 区間 0 → 1 → … の順に、各区間で手順 5〜7 を**完結**させてから次へ進む。区間の切り替わりで「区間 k/N 完了(checkpoint: <label>)」と 1 行報告する。失敗したら取り繕わず止める(fork は直前の checkpoint に整合した状態で残る。再実行すれば残り区間から続く)。
5. **merge**(区間 0 は省略): 区間に `moved:` の移植対象があれば先に差分を保存する(上記「移動・改名の移植」2)。merge 直前の HEAD を控え(`git rev-parse HEAD` = `<pre>`)、`git -c merge.directoryRenames=false merge --no-commit <区間の merge 先>`。ディレクトリ改名推定を切るのは、fork 側の削除・再編を「ディレクトリの改名」と誤推定し、上流の新規ファイルを fork の無関係なディレクトリへ置いたり fork のファイルの削除をステージしたりするため(`-X no-renames` では止まらない)。上流の本物のディレクトリ移動は `moved:` の移植が扱う。移植対象があれば上記 3〜4 を行う。コンフリクトが出たら自分で解消する(上流の意図と自 fork の改変の両立を判断。判断が本当に割れるものだけユーザーに確認)。`.claude/rules/project.md` と `behavior.md` はプロジェクトごとのファイルなので fork 側を採り、上流の追加はこの fork に当てはまるものだけ取り込む。`.claude/rules/shortcuts.md` と `term-aliases.md` は `fork entries below` マーカーより上を上流側、下を fork 側で採る。**区間外変更の検査**(コンフリクト解消・`moved:` 移植の後、merge コミットの前。読み取りのみ): 許可集合 = `git diff --name-only $(git merge-base <pre> <区間の merge 先>) <区間の merge 先>` + 区間の `moved:` の移動先(ディレクトリならその配下)。実際の変更 = `git diff --name-only <pre>`(ステージ済み・未ステージの両方)。両方を一時ファイルに書いて `comm -13` で突き合わせ、許可集合の外が 1 件でもあれば停止条件として `git merge --abort` し、その一覧を根拠に示す(fast-forward になった場合は merge の推定が働かないので検査は不要)。通れば `git commit --no-edit` で merge コミットを作る。merge 後にツリーの notice を再走査し、区間の想定と食い違えば報告して止める。
6. **実行**: その区間の計画の順に実施。
   - 通常ステップ: Claude が実行(コード修正、`pnpm dc:generate` 等のコマンド、バックフィル task、データ移行)。
   - 掃討: 計画に載せた fork 固有コードも同じ区間で新仕様へ揃え、旧 API の呼び出し・互換 shim への依存・不要になった独自実装を残さない。揃え方に fork 固有の判断が要るものは停止条件として止める。notice に目印が無く掃討しきれなかったものは「上流への所見」(b) に出す。
   - `[user-run]` ステップ: 「プロンプトに `! <コマンド>` と打ってください」と依頼して待つ。`!` プレフィックスはセッション内実行で出力が会話に流れ込むので、**出力を確認し、成功を判定してから**後続を再開する。失敗していたら取り繕わず対処を提示する。
   - notice の `verify:` を自分で実行して確認する。
   - 下流を持つ fork なら、verify の後に下記「中継判定」を行う(差分ありなら中継 notice の下書きまでこの区間で作る)。
   - `tsc` が**自 fork では使っていない上流の `_screen/*` 既定 Screen**(page.tsx を `_components/` に向けているルート等)で落ちたら、原因は自 fork の core 編集の非互換(必須 props の追加・使わない core コードの削除など)。直すのは core 側(足した props を省略可能+空の既定値に戻す、消したものを上流から戻す)で、上流の Screen は編集しない(CLAUDE.md CORE_FILES `fork_core_edit_compat`、`src/lib/screens/README.md` §7)。台帳の notes に何を戻したかを書く。
7. **記録とコミット**(途中確認なしで連続実行):
   a. 自 fork 台帳 `.notices/applied/<fork-id>.md` に追記(無ければヘッダごと作成。英語):
      ```
      # APPLIED LEDGER fork:<own origin url>
      - id:<notice id> | date:<ISO8601> | commit:<short sha or -> | relay:<none | relay notice id> | notes:<deviations from required_actions, or ->
      ```
      covers 側 notice を記録したら、その covered id も 1 行ずつ記録する(`notes:covered by <covers 側 id>`。既に台帳にある id は重ねない)。`relay:` 欄は下流を持つ fork だけが書き(下記「中継判定」の結果。covered id には covers 側と同じ値)、末端 fork は欄ごと省く。
   b. 差分(適用実装+台帳+この区間で下書きした中継 notice)をコミット & プッシュ。メッセージ: 1行サマリ + 空行 + `downstream-notice: <id>`(区間内の全 id、1 行ずつ)+ 環境指定の Co-Authored-By トレーラー。ブランチ運用は自リポの方針に従う。push できない場合は取り繕わず報告し、台帳の `notes:` に正直に反映する。
   c. その区間の merge コミットも未 push なら一緒に push する。
8. **報告**(日本語): 区間ごとに merge 結果(取り込みコミット数)/ 適用した notice と verify 結果 / コミット sha。`next` なら残りの区間の見通しを添える。`manual_steps` があれば**まとめてチェックリストとして提示**(ここだけは人間の宿題)。下流を持つ fork なら下記「中継判定」の報告行。最後に「**上流への所見**」(上記、無ければ「なし」)。停止条件で止まった場合も同じ構成で、止まった区間と理由・選択肢を先頭に置く。

## 中継判定(下流を持つ fork のみ)
自分が中間 Tier として、適用した上流 notice を下流へ中継する必要があるかを **git の差分だけで**機械的に決める(文面の解釈で判断しない)。仕様: `.notices/README.md`「中継(relay)」。
- **対象 fork**: `.claude/rules/project.md` の TIER 節に下流(Tier3 等)を持つと書かれている fork。下流が無い・予定なしと書かれていれば末端 fork として何もしない。どちらとも読めなければ平文でユーザーに尋ねる。
- **対象 notice**: 区間内で適用した notice のうち `from:` が自分の origin でないもの(祖父 notice・上流の中継 notice を含む)。covered id は covers 側と一緒に 1 件として判定する。
- **判定**(区間の手順 6 の verify 後、手順 7 の前。notice ごとに):
  1. 上流が変えたファイル = `git diff --name-only <P> <Q> -- . ':!.notices'`。`Q` = その notice の区切り点(上記「区間の組み立て」の区切り点。区間 0 なら追加 commit。祖父 notice なら中間 Tier の台帳記録 commit)、`P` = 上流履歴上でその直前にある notice の区切り点(無ければ fork 成立点)。
  2. 比較: `git diff --quiet <Q> -- <1 のファイル>`(作業ツリーと比べるので、この区間の適用分も含まれる)。
  3. exit 0(差分なし)→ `relay:none`。exit 1(差分あり)→ 中継が必要。差分のあったファイルを `git diff --name-only <Q> -- <1 のファイル>` で控える。
- **中継 notice の下書き**(区間内に差分ありが 1 件以上): 区間につき 1 件、`.notices/<ts>-relay-<slug>.md` に書き出す。合成規則は `.claude/skills/downreq/SKILL.md`「relay モード」の手順 3〜4(`covers:` = この区間で差分ありの id と、その covered id)。加えて `notes:` に差分のあったファイルと `git diff --stat <Q> -- <files>` の結果をそのまま載せる。下書きはこの区間の適用コミットに含める(中継 notice の追加 commit = 台帳記録 commit になり、下流の区切り点が一致する)。
- **台帳**: 手順 7a で各 id の行に `relay:none` か `relay:<中継 notice id>` を書く。
- **報告**: 判定した notice ごとに 1 行「<id>: 中継不要(差分なし)」/「<id>: 中継 notice <中継 id> を作成(差分: <files>)」。作成した中継 notice は「中身は差分・台帳 notes から組み立てた下書き。下流へ出す前に確認・編集してよい」と添える。
- **未判定**(この仕組み導入前の旧台帳行): 自台帳の id のうち、`relay:` 欄が無く、`from:` が自分の origin でなく、自分の origin の notice のどの `covers:` にも含まれないもの(継承済み・notice ファイルが無い id は除く)。1 件以上あれば報告に 1 行: 「中継未判定の旧 notice が N 件あります: <id>, ...。`/downreq relay` で中継 notice を下書きできます」。0 件なら何も出さない。

## エッジケース
- `covers:` の id が merge 後のツリー(現役・`done/`)のどこにも無い: その id を報告に含める(黙って飛ばさない)。covers 側 notice の適用自体は続け、その id は台帳に記録しない。
- 祖父 notice の中間 Tier 台帳記録 commit が covers 側 notice の追加 commit より後: covers 側の区間の merge 先をその記録 commit まで伸ばす(区間内で最も後の点を merge 先にする)。
- 自分の origin の notice が `covers:` を持つ(自分が出した中継 notice): 未適用判定の対象外なのは従来どおり。covers 索引には入れず、中継判定の未判定の計算にだけ使う。
- 中継判定で `P` と `Q` の間に上流の変更ファイルが無い(`severity: info` の区切りだけの notice 等): 差分なしとして `relay:none`。
- 区間を停止条件で止めた: その区間の notice は台帳に記録されないので中継判定もしない(再開時に判定する)。
- 上流に `.notices/` が無い(この仕組み導入前の上流): 通常の merge として完走し、その旨だけ報告。
- notice のスキーマが読めない/欠損: その notice はスキップして報告に含める(黙殺しない)。
- 台帳にあるがツリーに無い id(上流が done/ へ移動済み): 正常。何もしない。
- checkpoint notice の追加 commit が既に HEAD の祖先(merge 済み)なのに台帳に無い: ツリー内の未適用として区間 0 で扱う(merge 不要)。
- 流入予定 notice に `checkpoint:` 欄が無い(旧スキーマ): 区切り扱い(安全側。`-` とみなしてはいけない)。
- `moved:` の旧パスがディレクトリで、fork がその配下にファイルを足していた: 足したファイルも同じプレフィックス置換で新しいディレクトリへ移す(差分に「新規ファイル」として含まれるので手順は同じ)。
- `moved:` に書かれた旧パスが merge-base に存在しない(fork 成立が移動より後など): 移植対象なしとして扱う。
- 区間の merge 先が `<upstream>/<branch>` の祖先でない(上流が履歴を書き換えた等): その旨を報告して止める。勝手に全量 merge へ倒さない。

## 対話ルール
- ユーザーとの会話は日本語。台帳・notice への追記は英語。
- **AskUserQuestion(選択肢ウィジェット)は使わない**。計画の承認、merge 方針、コンフリクトの判断、停止時の選択肢など、ユーザーに聞くことはすべて**平文で**書いて次のメッセージを待つ。理由: このスキルは fleet(複数 fork 並列実行)では統括が tmux 経由で平文を送り込んで回答するため、ウィジェットだと回答できない。単体実行でも同じ挙動にし、聞き方を一本化する。
