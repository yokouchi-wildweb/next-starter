---
name: flux
description: 下流(fork)側で upstream の変更取り込みと DOWNSTREAM NOTICE への追随対応を全自動で行う。fetch→未適用noticeをcheckpointごとの区間に分割→適用計画→承認1回→区間ごとに merge/コード修正/DB/バックフィル/検証/台帳記録/コミット/push。いつ実行しても自forkの対応状況を正確に把握できる
argument-hint: "[status | next | notice id (省略で全区間を merge + 適用)]"
disable-model-invocation: true
---

あなたは今 **下流(fork)** として、上流リポの変更取り込みと **DOWNSTREAM NOTICE**(追随対応の通知、`.notices/*.md`)への対応を行います。この仕組みは任意の上流→下流(T1→T2, T2→T3 等)で使われます。仕様詳細: `.notices/README.md`

## 大原則
- **状態はイベントではなくファイルと履歴から導出する**: 「ツリー内に存在する現役 notice の集合」−「継承済み notice の集合(fork 成立点から自動判定、下記)」−「自 fork 台帳に記録済みの集合」= 未適用。merge が誰の手でいつ行われたかは問わない(手動 merge / GitHub 上の merge / このコマンドの merge、すべて同じに扱う)。
- **承認は適用計画の提示時に1回だけ**。承認後は merge・コード修正・DB 操作・バックフィル・検証・台帳記録・コミットまで途中確認なしで完走する。
- **区間単位で進める**: 未適用 notice を区切り(`checkpoint:`)ごとの区間に分け、区間ごとに「merge → 適用 → verify → 台帳 → commit → push」を完結させる。**既定は notice 1 件 = 区切り 1 つ**(`checkpoint: -` と上流が例外宣言した notice だけが次の区切りまで同じ区間に入る。欄が無い旧 schema は区切り扱い = 安全側)。途中で止まっても fork は直前の区切りに居て、再実行すれば続きから進む(状態は集合演算で導出されるので追加の記録は不要)。
- **適用計画の承認 = DB 操作を含む全ステップの明示的実行指示とみなす**。このスキル実行中は「DB 操作はユーザーに依頼する」系の一般ルールより本規約が優先される。ただし対話プロンプトを出すコマンド(`[user-run]` マーカー付き、db push 等)だけは Claude では実行できないため、下記の in-session ユーザー実行で合流する。

## 自 fork の識別と台帳
1. origin 取得: `git remote get-url origin`
2. fork-id 導出: URL のパス部分(ホスト以降)から `.git` を除去し、`/` を `--` に置換、小文字化。例: `git@github.com:acme/shop.git` → `acme--shop`。origin が無ければ `local--<ディレクトリ名>`。
3. 自 fork 台帳 = `.notices/applied/<fork-id>.md`。無ければ未適用ゼロ記録として扱う(初回適用時に作成)。
4. `.notices/applied/` 内の他の fork-id のファイルは中間 Tier や他 fork の台帳(merge で流れてきたもの)。**自分の状態と混同しない**。参考情報として読むのは可。

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
- **notice id / ファイル名**: その notice だけを対象に、フルフローの手順 5 以降を行う(merge は行わない。既にツリーに存在する notice が対象。区間分割もしない)。

## 未適用判定(ツリー内・流入予定の両方に同じ規則を適用)
notice は次のいずれかに該当すれば対象外、残りが**未適用**:
- `from:` の repo URL が自分の origin と一致(ssh/https 表記差・`.git` 有無は無視)→ 自分が上流として起票したもの。
- 継承済み集合(上記の自動判定)に含まれる → 適用済み扱い。
- 自 fork 台帳に id が記録済み → 適用済み。

## 区間の組み立て
1. 未適用 notice を 2 群に分ける: **ツリー内**(`.notices/` 直下の `*.md`、`done/` と `applied/` は除外。前回の部分実行で merge 済みだが未適用のもの)と**流入予定**(`git diff --name-only HEAD...<upstream>/<branch> -- .notices/` のうち直下の `*.md`。内容は `git show <upstream>/<branch>:.notices/<id>.md` で読む)。
2. 流入予定の各 notice に**追加 commit** を対応づける: `git log --diff-filter=A --format=%H <upstream>/<branch> -- .notices/<id>.md`(通常 1 件。複数なら最古)。`from: commit:` 欄は参考情報で、判定には使わない。
3. 流入予定 notice を追加 commit の履歴順に並べる(`git rev-list --reverse --topo-order HEAD..<upstream>/<branch>` 上の位置)。
4. 区間を切る:
   - **区間 0** = ツリー内の未適用 notice(merge 不要)。空なら無し。
   - 以降、流入予定を履歴順に走査し、**区切り notice**(`checkpoint:` が `-` 以外、または欄が無い旧 schema)の**直後で区間を閉じる**。閉じた区間の merge 先 = その区切り notice の追加 commit。`checkpoint: -` の notice は次の区切りまで同じ区間に入る(上流の例外宣言。理由は notes: にある)。
   - 最後の区切り以降の notice(無ければ空)+ 残りのコミットが**末尾区間**。merge 先 = `<upstream>/<branch>`。notice が無くても未マージコミットがあれば末尾区間は存在する(merge のみ)。
   - 結果として通常は notice 1 件 = 1 区間。同じ commit で出荷された複数 notice は merge 先が同じ区間が連続する(merge は 1 回目で完了し、2 回目以降は「既に最新」になるだけ。正常)。
5. 区間ごとに持つ情報: 番号 / merge 先(短 sha と、checkpoint ラベル or `HEAD`)/ 含まれる notice id / そこまでのコミット数。

## フルフロー
1. **偵察**: `git fetch <upstream>` → 未マージコミット数(`git rev-list --count HEAD..<upstream>/<branch>`)→ 上記「区間の組み立て」。working tree に未コミットの変更がある場合は先に報告し、stash してよいか確認する。
2. **一覧と計画**: 区間の見通しを日本語で一覧(区間番号 / merge 先 / notice id・severity・change / checkpoint ラベル)。継承済みとして除外した件数があれば 1 行添える。各 notice を全文読み(流入予定は `git show` で)、required_actions を**自リポの実情に写像した適用計画**(対象ファイル・コマンド・順序・`[user-run]` 合流点・verify 手順)として区間ごとに提示する。
   - 未適用ゼロ・未マージコミットもゼロなら「この fork の追随対応はすべて完了しています」で終了。未適用ゼロで未マージコミットだけある場合は merge のみの計画。
3. **承認を 1 回だけ取る**。以後は全区間を完走する(`next` なら 1 区間)。
4. **区間ループ**: 区間 0 → 1 → … の順に、各区間で手順 5〜7 を**完結**させてから次へ進む。区間の切り替わりで「区間 k/N 完了(checkpoint: <label>)」と 1 行報告する。失敗したら取り繕わず止める(fork は直前の checkpoint に整合した状態で残る。再実行すれば残り区間から続く)。
5. **merge**(区間 0 は省略): `git merge <区間の merge 先>`。コンフリクトが出たら自分で解消する(上流の意図と自 fork の改変の両立を判断。判断が本当に割れるものだけユーザーに確認)。merge 後にツリーの notice を再走査し、区間の想定と食い違えば報告して止める。
6. **実行**: その区間の計画の順に実施。
   - 通常ステップ: Claude が実行(コード修正、`pnpm dc:generate` 等のコマンド、バックフィル task、データ移行)。
   - `[user-run]` ステップ: 「プロンプトに `! <コマンド>` と打ってください」と依頼して待つ。`!` プレフィックスはセッション内実行で出力が会話に流れ込むので、**出力を確認し、成功を判定してから**後続を再開する。失敗していたら取り繕わず対処を提示する。
   - notice の `verify:` を自分で実行して確認する。
7. **記録とコミット**(途中確認なしで連続実行):
   a. 自 fork 台帳 `.notices/applied/<fork-id>.md` に追記(無ければヘッダごと作成。英語):
      ```
      # APPLIED LEDGER fork:<own origin url>
      - id:<notice id> | date:<ISO8601> | commit:<short sha or -> | notes:<deviations from required_actions, or ->
      ```
   b. 差分(適用実装+台帳)をコミット & プッシュ。メッセージ: 1行サマリ + 空行 + `downstream-notice: <id>`(区間内の全 id、1 行ずつ)+ 環境指定の Co-Authored-By トレーラー。ブランチ運用は自リポの方針に従う。push できない場合は取り繕わず報告し、台帳の `notes:` に正直に反映する。
   c. その区間の merge コミットも未 push なら一緒に push する。
8. **報告**(日本語): 区間ごとに merge 結果(取り込みコミット数)/ 適用した notice と verify 結果 / コミット sha。`next` なら残りの区間の見通しを添える。`manual_steps` があれば**最後にまとめてチェックリストとして提示**(ここだけは人間の宿題)。

## エッジケース
- 上流に `.notices/` が無い(この仕組み導入前の上流): 通常の merge として完走し、その旨だけ報告。
- notice のスキーマが読めない/欠損: その notice はスキップして報告に含める(黙殺しない)。
- 台帳にあるがツリーに無い id(上流が done/ へ移動済み): 正常。何もしない。
- checkpoint notice の追加 commit が既に HEAD の祖先(merge 済み)なのに台帳に無い: ツリー内の未適用として区間 0 で扱う(merge 不要)。
- 流入予定 notice に `checkpoint:` 欄が無い(旧スキーマ): 区切り扱い(安全側。`-` とみなしてはいけない)。
- 区間の merge 先が `<upstream>/<branch>` の祖先でない(上流が履歴を書き換えた等): その旨を報告して止める。勝手に全量 merge へ倒さない。

## 言語ルール
- ユーザーとの会話は日本語。台帳・notice への追記は英語。
