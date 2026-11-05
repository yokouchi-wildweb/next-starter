# .notices/ — DOWNSTREAM NOTICE(上流追随通知)

上流リポの変更に伴い、下流 fork 側で追随作業(コード修正・DB マイグレーション・バックフィル・再生成など)が必要になるとき、その通知を **リポジトリ内のファイルとして**ここに置く仕組み。

配送インフラは git そのもの: 通知は変更本体と同じコミット/PR に含めて出荷され、**下流が上流を merge した瞬間に一緒に届く**。ローカルマシンの共有ディレクトリ等には依存しないため、リポジトリを fork した誰でもこの仕組みに乗れる。T1→T2 / T2→T3 など任意の上流→下流の多段構成でそのまま機能する。

## 構成

```
.notices/
├── README.md              # この文書(仕様)
├── <id>.md                # notice の本文(id = <YYYYMMDD-HHMMSS>-<slug>)。出荷後は書き換えない。区間が閉じたら消してよい
├── <id>.<name>.mjs        # その notice が使う codemod(uses: で名指す。notice と一緒に消す)
├── done/                  # 旧運用のアーカイブ(既存の 2 本だけ。新しくは作らない)
├── shipped/
│   └── <名前>.md          # 出荷索引(1 notice = 1 行、追記だけ。名前 = 出荷したリポの fork_id:。そのリポだけが書く)
└── applied/
    └── <名前>.md          # fork ごとの適用台帳(名前 = その fork の fork_id:。その fork だけがコミットする)
```

## 使い方

- **出荷(上流側)**: `/ship` スキル。コミット・push のたびに、検査 → 下流への影響の判定 → 要るなら notice を合成して `.notices/<id>.md` に書き出す(前に出荷したものの修正なら `fixes:` を付ける)→ 索引の行を `node scripts/notices/shippedIndex.mjs add <notice>` で足す → `pnpm test:notices` → 変更本体と同じコミットで push、までを行う。`/flux` と対になる(`/ship` が書く欄と `/flux` が読む欄はこの文書のスキーマで揃える。欄を足すときは両方のスキル・`scripts/notices/notices.test.mjs`・索引の欄の並び(`scripts/notices/shippedIndex.mjs` の `ROW_KEYS`)・読む側(`.claude/skills/flux/incoming.mjs`、`src/lib/forkOwnership/check.mjs`)を同じコミットで直す)。
- **中継(中間 Tier)**: 下流を持つ fork(`.claude/rules/project.md` の `downstream: yes`)の `/flux` が、適用した上流 notice ごとに中継の要否を git の差分で判定し、必要な区間だけ `covers:` 付きの中継 notice を下書きする(下記「中継(relay)」)。`/flux relay` はこの判定の導入前に適用した未判定の旧 notice の後始末用。
- **受領・適用(下流側)**: `/flux` スキル。upstream の fetch → 未適用 notice を checkpoint ごとの区間に分割 → 全区間の概観(1 行ずつ)と**次の区間だけ**の詳細な適用計画を提示 → 承認 → その区間の merge・コード修正・DB 操作・検証・台帳記録・コミット・push → 次の区間の計画を出して止まる。承認は区間ごと(区間の終わりの `go` = 次の区間の計画の承認)で、`/flux all` は最初の区間の承認の後、区間ごとに計画と実行を繰り返して最後まで進める(`/flux next` は既定の別名)。fork が移動元を編集した大きな `moved:` の移植を含む区間は、`all` の途中でも手前で止まる。`/flux status` で状態確認のみ。notice の有無にかかわらず区間の上流差分から使い方の変わった部品・lib・core を洗い出し、fork 側の使用箇所を同じ区間で揃え、区間ごとに typecheck / lint を通してから commit する(古い使い方を残すのはユーザーが判断したときだけ)。notice が無いのに追従が要った変更は「上流への所見」で notice 漏れとして返る。承認後でも、取り込む変更がその fork を壊す・db 差分が破壊的・notice と実態が食い違う等の**停止条件**に当たれば区間を commit せずに止まって選択肢を示す(押し切らない)。最終報告には「上流への所見」(上流のバグ・notice のズレ・/order <上流リポ> 候補)を常設。
- 対応が不要な通常の変更には notice を作らない。ただコミットされて merge で流れていくだけでよい。

## notice スキーマ(英語・機械間ファイル)

```
# DOWNSTREAM NOTICE id:<ts>-<slug>
from: <upstream repo> | branch:<branch> | commit:<short sha>
date: <ISO8601>
severity: breaking | action-required | info
checkpoint: <label | ->
moved: <old path> -> <new path>; ...   (only when the change moves/renames files or dirs; omit otherwise)
covers: <upstream notice id>, ...   (relay notices only: upstream notice ids this notice subsumes; omit otherwise)
fixes: <notice id | commit:<sha>>, ...   (only when this change fixes something shipped earlier; omit otherwise)
skip_checkpoint: <notice id>, ...   (only on a fix that cannot be picked ahead: treat these fixes: targets' checkpoint as -; omit otherwise)
uses: <path>, ...   (only when required_actions run a migration / codemod shipped in this commit; omit otherwise)
resolves: <order id>, ...   (only when this change resolves orders a downstream repo filed in this repo's inbox; omit otherwise)
hotfix: <why forks must take this ahead of other changes, one line>   (only when the owner declares it urgent; omit otherwise)
change: <what changed upstream, one line>
why: <why downstream must follow up>
required_actions:
1. <step executable by downstream Claude as-is>
2. [user-run] <interactive command (e.g. pnpm db:push)>
verify: <how downstream Claude verifies the result itself>
manual_steps: <steps outside Claude's reach | ->
refs: <upstream files / commits / docs>
notes: <anything else>
```

- `required_actions` は下流の Claude が計画の承認だけで区間の中を途中確認なしに実行できる具体度で書く(fail-auto)。対話プロンプトを出すコマンドのみ `[user-run]` マーカーを付け、/flux がセッション内ユーザー実行(`!` プレフィックス)で合流する。ドメイン再生成は `pnpm dc:generate <Domain>` / `pnpm dc:generate:all` が既定で対話なしなので `[user-run]` を付けない(`-i` は使わない。scripts/domain-config/README.md)。再生成は必要なカテゴリだけを `--only` で指定する(例: レジストリ書き換え = `pnpm dc:generate:all --only registry`)。全カテゴリ再生成は手編集した生成物を上書きするため、避けられない場合は一時 worktree での実行を指示する。
- 管理画面全体に効く変更の notice は、生成の管理画面の再生成だけで終わらせず、`"adminRoutes": false` のドメインの手書きの管理ページと fork の `_components/` を探す `git grep` と、揃える手順・確かめ方を required_actions に書く(書き方は `/ship`「notice の合成」の「管理画面全体に効く変更」)
- 人間にしかできない作業(Vercel 環境変数、外部ダッシュボード等)だけ `manual_steps` に分離する。
- `verify` の型チェックは `pnpm typecheck` と書く(`tsc --noEmit` は使わない)。`tsc --noEmit` は `tsconfig.json` の include にある `.next/dev/types` / `.next/types` まで読み、dev サーバーや過去の build が生成した古い `validator.ts`(移動・削除したページを import している)で TS2307 を出す。`pnpm typecheck`(`tsconfig.typecheck.json`)はこれらを外して型チェックし、ルート全体の型の検証は `next build` に任せる。
- `moved` はファイル・ディレクトリを移動・改名する notice では**必須**(それ以外は欄ごと省略)。下記「移動・改名(moved)」参照。
- `covers` は中間 Tier が上流の notice を下流へ中継する notice(relay notice)でだけ書く(それ以外は欄ごと省略)。下記「中継(relay)」参照。
- `fixes` は前に出荷した変更の不具合を直す notice でだけ書く(それ以外は欄ごと省略)。下記「修正(fixes)」参照。
- `pick` は本文には書かない。`fixes:` のある notice の**索引の行**に、/ship が `pnpm notices:pick-check` で書く(人は書かない)。下記「修正(fixes)」の「先に取れる印(pick)」参照。
- `uses` は notice の手順が実行する移行・codemod のパス(`,` 区切り)。下記「使う移行・codemod の欄(uses)」参照。
- `skip_checkpoint` は先に取れない修正の notice でだけ書く。下記「区切りを外す欄(skip_checkpoint)」参照。
- `notes` で特定の fork に触れるときは、その fork で実際に差分を取った結果だけを書く(推測で書かない。調べていない fork は `not checked`)。
- config のキーを足させる notice は、`required_actions` に「無ければ足す」だけでなく、fork が同じキーを既に持つ場合の手順も書く: fork の分を消して upstream の行に揃える(値を変えているなら upstream の行で値を持つ)、探し方は `git grep -n "<key>" -- <config のファイル>`。fork と upstream が別の位置に足すと、git は衝突なしに両方を取り込み、オブジェクトに同じキーが 2 つ残るので、衝突を手がかりにしない。
- fork が upstream の行に入れた振る舞いの無い編集(コメントだけの変更など)は、upstream の文面に戻してよい(残して次の取り込みで衝突させ、`pnpm ownership:check` の違反にもなるより、戻す方が安い)。出荷済みの notice の手順に「残して台帳に挙げる」とあっても同じで、戻したことを台帳の行に一言書く。
- 書式は `pnpm test:notices` で検査する(見出しの id とファイル名、必須の欄、checkpoint ラベルの重複、`fixes:` / `covers:` の参照先、`pick:` の値と `fixes:` の有無、出荷前の `moved:`、索引: 追記だけ・本文と行の一致・`uses:` の実在と区切り・`skip_checkpoint:` の条件)。`checkpoint:` と `manual_steps:` の必須は検査の導入以降の notice だけ(それより前は欄の無い旧 schema が残る)。
- `checkpoint` は**原則ラベル必須**(既定 = 区切り)。「この notice まで適用すれば fork は整合した休憩点にある」の宣言で、`-` は「後続 notice なしでは半端」という例外宣言(理由を `notes:` に)。欄が無い旧 schema の notice は区切り扱い。下記「区切り(checkpoint)」参照。

## 出荷索引と本文の読み方

notice の発見と区切りの判定には、今のツリーに残っている本文の一覧ではなく**出荷索引**(`shipped/<名前>.md`)を使う。本文は区間が閉じれば消してよいので、本文の有無では判断しない。

- 索引は出荷したリポごとに 1 ファイル、notice ごとに 1 行。書くのはそのリポだけ(台帳 `applied/<名前>.md` を fork ごとに分けたのと同じ理由: 多段の merge で追記が重ならない)。ファイル名の fork 名は台帳と同じ例外。上流の索引は merge で下流に届くが、下流は書かない
- 行 = `- id:<id>` に本文の欄を決まった順で ` | key:value`(`severity`・`checkpoint`・`covers`・`moved`・`fixes`・`resolves`・`hotfix`・`uses`・`pick`・`skip_checkpoint`)。**本文にある欄だけ**を写す(`checkpoint:` の欄が無い旧 notice は行でも欄なし = 区切り。`-` で埋めない)。`hotfix:` は理由の文でなく `yes`。値に ` | ` は書けない
- 行は `/ship` が `node scripts/notices/shippedIndex.mjs add <notice>` で本文から作り、notice と同じ commit に入れる。手で書かない。出荷する commit 自身の sha は行に書かない(行を書く時に決まっていない)。notice を足した commit は履歴から引く
- 追記だけ: push した行は変えない・消さない・並べ替えない(`pnpm test:notices` が前に push した版と比べる)。push 前の行は直してよい(`pick:` の書き込み・本文を直した後の `refresh`。push 前の自分の commit は本体・notice・行とも自由に直す: 下記「区切り(checkpoint)と区間適用」)
- 正: 欄の値は索引、本文はその notice を**足した commit の版**(`git show <足した commit>:.notices/<id>.md`)。区間の merge 先や上流の先端の版で代用しない
- 読む側: `/flux` の流入の発見と区間(`.claude/skills/flux/incoming.mjs`)・`pnpm ownership:check` の「台帳に無い notice」と `resolves:`・`pnpm test:notices` は索引を読む。索引の無い版(導入前の上流・fork 成立点)は本文も読み、両方の和をとる
- 止まる: 浅い clone・索引に行があるのに足した commit が履歴に無い(履歴の書き換え・食い違い)ときは、未適用ゼロとして進まずに止まる
- 導入: 上流は今ある全 notice の行を `node scripts/notices/shippedIndex.mjs backfill` で 1 回起こした。自分の notice を出す fork は、最初に同じ backfill で自分の notice だけの索引を作る(他のリポの notice は飛ばす: 親の索引に載る・本文の `from:` が自分の origin でない・台帳に `picked:` = 親から先に取った修正)
- 片付け: 古い backfill が、親から先に pick した notice(その時の親の索引にまだ行が無かった物)を自分の索引に書いてしまった fork は、`node scripts/notices/shippedIndex.mjs repair` を 1 回走らせて commit する(自分の索引から他のリポの物の行だけを消す。何度走らせても同じ)。消えたその行は追記だけの検査が受け入れる(自分の notice の push 済みの行は今どおり書き換えない)

## 使う移行・codemod の欄(uses)

- 形式: `uses: <path>, <path>`。notice の手順が実行する DB 移行(ドメインの `src/features/<domain>/scripts/migrations/`)・codemod(`.notices/<id>.<名前>.mjs`)を列挙する。本文の説明だけを手がかりに探させない
- 列挙したファイルは notice を足した commit に実在すること(`pnpm test:notices`、中継 notice も同じ)。`.notices/` の下は `.notices/<その notice の id>.<名前>.mjs` の形
- `uses:` を持つ notice は区切り(`checkpoint: -` にしない)。後の `skip_checkpoint:` でも外せない(区間が後ろにずれると、添付が消えた木に merge しうる)
- 実行の手順は `required_actions`、確かめ方は `verify` に書く。後から取り込む fork は、添付を notice を足した commit の版から読む

## 区切りを外す欄(skip_checkpoint)

区切りの commit が動かないまま出荷され、その修正が先に取れない(`pick: -`)とき、修正元の区切りに止まる fork は型検査の通らない木で push することになる。そこで修正の notice が修正元の区切りを外す。

- 形式: `skip_checkpoint: <notice id>, ...`。修正の notice の欄で、各 id は同じ notice の `fixes:` にあること
- 意味: 名指した notice の `checkpoint` のラベルを `-` とみなす(その notice は次の区切りまで同じ区間に入る)。外す向きだけで、区切りを足す・戻すには使えない
- 条件(`pnpm test:notices`): 相手の checkpoint がラベル / 相手が `uses:` を持たない / 修正の notice 自身は区切り / 修正の行の `pick:` が `clean` でない(先に取れるなら外す理由が無い)
- `/ship` がこの欄を新しい notice の索引の行に写す(pick-check の後に足したら、push 前の行を `node scripts/notices/shippedIndex.mjs refresh <notice>` で作り直す)。修正元の本文と既存の行は書き換えない。`/flux` は上流の先端の索引のどの行の `skip_checkpoint:` も区間の組み立てに使う

## 区切り(checkpoint)と区間適用

長く追随していない fork や初回 merge の fork は、未適用 notice を一度に数十件抱えることがある。全量を 1 回の merge と 1 つの適用計画で進めると、途中で失敗したときに fork が中途半端な状態に残り(schema 変更が 3 つ混ざった merge の途中で db:push が落ちる等)、どこまで終わったかも分かりにくい。DB 規模が大きい fork や独自要素の多い fork ほど危険が増す。そこで **notice 1 件 = 休憩点 1 つを既定とし、/flux は未適用 notice を区切りごとの区間に分けて 1 変更ずつ閉じて進める**。

- `checkpoint: <label>` が既定(notice は追随作業の単位で出荷されるので、適用し終えた時点で fork が整合しているのが普通)。`checkpoint: -` は「後続 notice を適用しないと fork が動かない中間点」という上流からの例外宣言で、理由を `notes:` に書く。欄が無い旧 schema の notice は区切り扱い(安全側)。
- 各 notice は上流履歴上の 1 点に対応づく: notice ファイルを追加した commit(`git log --diff-filter=A --format=%H <upstream>/<branch> -- .notices/<id>.md`。本文を消した後も履歴に残る)。`from: commit:` 欄は参考情報で、判定には使わない。/flux は索引の行とこの commit を `.claude/skills/flux/incoming.mjs` で読む。
- 区間 = 履歴順に並べた未適用 notice を、区切り notice(索引の行の `checkpoint` が `-` 以外、または欄なし。ただし `skip_checkpoint:` に名指された notice は `-` とみなす)の直後で切ったもの。`-` の notice は次の区切りまで同じ区間に入る。最後の区切り以降〜上流 HEAD が末尾区間(空のこともある)。同じ commit で出荷された複数 notice は merge 先が同じ区間が連続するだけで問題ない。
- /flux は区間ごとに「その区間の merge 先(区切り notice の追加 commit、末尾区間は上流 HEAD)まで merge → 区間内 notice を適用 → verify → 台帳 → commit → push」を繰り返す。途中で止まっても fork は直前の区切りに居るので、再実行すれば続きから進む(状態は下記の集合演算で毎回導出されるため、追加の記録は不要)。詳しく計画するのは次の区間だけで、区間の終わりごとに次の区間の計画を出して止まる(`all` で止まらずに進む)。区間の終わりの報告は次の区間に必要なこと(ここまでの sha・人間の判断・次の merge 先・残作業)だけを持つので、セッションを閉じても `/flux` で続きから計画し直せる。
- merge commit は区間数ぶん増える。これは意図した代償(区切りごとに fork が整合する)。追随を小刻みに続けている fork は今までと同じ。
- 上流側の責務: notice は、その区切りに含めたい変更本体と同じ commit かそれより後の commit に含める(notice を先に出すと、merge 先に変更本体が含まれない)。区切りの commit は動く状態であること: その commit で `pnpm typecheck` と `pnpm test:config-module-load` が通る(push 前の自分の commit なら、その commit を直して(amend・rebase)通し直す。通らない区切りを push してしまったら、出荷済みの本文と索引の行は書き換えず、修正の notice を出す。修正が先に取れれば `pick: clean` で修正元の区間の直後に取られ、取れなければ修正の notice に `skip_checkpoint: <その notice の id>` を書いて修正元の区切りを外す: 上記「区切りを外す欄」、下記「修正(fixes)」)。追随作業が無い区切りは `severity: info` + `required_actions: none` + `checkpoint:` の notice で宣言する。
- 途中の区切りの検査(`node scripts/notices/checkpointCheck.mjs <from>..<to>`、/ship が push の前に走らせる): ふだんの検査は先端の木しか見ないので、出荷する範囲の途中の区切りが壊れていても気づかない(脇のブランチを main に載せ直して出した範囲で、途中の区切りが型検査に落ちていた)。この道具は区切りを /flux と同じ順(先端の `rev-list --topo-order`)に並べ、範囲の起点から各区切りの commit を順に merge した木 = fork がその区間で実際に持つ木(直線の履歴ではその commit の木、脇のブランチを merge した範囲では先に並ぶ側を merge 済みの木)で、`pnpm typecheck`・`test:config-module-load`・`test:core-rules`・`registry:check` を通す。merge の衝突も壊れたと数える(出荷索引だけの衝突は除く)。fork が区切りの直後に取る `pick: clean` の修正(出荷の先端 `--at` の索引から、土台がその区切りかそれより前の物)は取ってから検査し、取った修正の区切りは merge しない(`--no-picks` で区切りだけを見る)。最初に壊れた区切りで止まる(`--all` で続ける)。壊れた区切りが push 前の自分の commit なら、その commit を直して通し直す。push 済み(脇の commit を他のリポが持つ等で sha を保つ必要がある時を含む)なら、`fixes: <その notice>` の修正を出し、pick-check で `pick: clean` になる形にする

## 移動・改名(moved)

`git merge` は「merge-base → merge 先」の差分をまとめて見るため、上流が「新しいパスに新規作成 + 古いパスを互換 shim に置き換え」を行うと、git はこれを改名と認識しない(古いパスは「変更」、新しいパスは「追加」に見える)。fork が古いパスで編集していた内容は、shim との衝突になるか、気づかれずに上流版で上書きされる。上流のコミットを mv だけと中身変更に分けても、区間の merge 先が両方を含めばまとめて見られるので解決しない。

そこで移動の対応表を notice に書き、fork の編集の移植は /flux が行う:

- 形式: `moved: <old> -> <new>; <old> -> <new>` 。リポジトリルートからの相対パス。ディレクトリも可(配下をまとめて対応づける)。
- /flux は計画時に、各組について fork が移動元を編集しているか(`git diff <merge-base> HEAD -- <old>`)を調べて計画に出す。merge 後、その差分のパスを新しいパスに書き換えて `git apply --3way` で当て直す。古いパス側の衝突は上流版(shim または削除)を採る。当て直せなかった部分は停止条件として止まる。
- 欄が無い旧 notice・`moved:` を知らない旧 /flux では今までどおりの動作(merge するだけ)。

### 削除・移動は notice と同じ commit で出す(必須)

fork が手を入れうるファイル(docs・README・registry・config 等)を削除・移動する commit には、その notice(移動なら `moved:`、移動先の無い削除なら `notes:` に削除したパスと「fork 独自の内容の移し先」)を**同じ commit に含める**。後の commit で notice を出すと、/flux はその notice の追加 commit で区間を切るため、削除だけが先の区間で fork に届き、fork は案内の無い modify/delete コンフリクトを自力で解くことになる。

- 起票前に `git diff --name-status --diff-filter=DR <変更前> <変更後>` で削除・改名を全て洗い出し、notice に漏れなく載せる(/ship が行う)
- fork が編集していないと分かっているファイル(upstream 専用の内部実装等)だけの削除なら notice は不要

## 修正(fixes)— 前に出荷したものの不具合を直す

出荷した変更に後から不具合が見つかり修正を出すと、まだ修正元の区間を通っていない fork は、修正が先に控えていることを知らないまま修正元の区切りで止まり、検査の失敗を自前で直したり、同じ不具合を上流へ依頼し直したりする。そこで修正側の notice が「何を直したか」を宣言し、/flux がそれを先読みする。

- 形式: `fixes: <notice id>, commit:<sha>`。修正元に notice があればその id、notice の無い変更なら commit(短 sha 可)。複数可。
- 書くのは修正側だけ。修正元の notice は編集しない(出荷済みの notice を書き換えず、判断の根拠を 1 か所に保つ)。
- 前後の検査(`pnpm test:notices`): `fixes:` の参照先は履歴で修正より前に足した notice であること。足した commit は全部見る(修正元を親から先に pick した fork では、上流の元の add と fork の cherry-pick の 2 本がある)ので、参照先のどれかの add が修正の add の祖先なら前とみなす。前を指す(参照先がどれも祖先でない)`fixes:` は止める。
- 修正に fork 側の追随作業が無くても、`fixes:` を伝えるために `severity: info` + `required_actions: none` の notice を出す。
- 修正かどうかは出荷する側(/ship)が決める。/flux は宣言を信じ、自分では判定しない。
- /flux の扱い:
  - 区間の組み立てで全 notice の見出し行と一緒に `fixes:` を読み、修正元(id ならその notice の区間、commit ならその commit を merge 先の範囲に含む区間)と修正の区間を対応づけて、概観に出す。全文は読まない。
  - 修正元を含む区間の計画では、先頭に「この区間の <修正元> は区間 K の <修正 notice> で修正される」と出して止まり、1 区間ずつ進めるか、ここで止めるかをユーザーに聞く(`all` / `light` の途中でも止まる)。修正が `pick: clean` なら聞かずに区間の直後に取る(下の「先に取れる印(pick)」)。区間は自動でまとめない: 本番へのデプロイ方法(push で出るか、コマンドで出すか)は fork ごとに違い、ユーザーが知っているため。
  - 修正元の区間で検査が落ち、修正 notice のコミットが触るファイルに当たるものは「既知(修正は区間 K)」として台帳 `notes:` に書き、自前では直さない。修正を先回りして同じ実装をしない(後の merge で衝突し、fork 独自版が残る)。
  - 修正元が適用済みなら止まらず、概観で修正の区間に「適用済み <修正元> の修正」と印を付ける。その区間では台帳の修正元の行の `notes:` から当時の回避策を探して外す。
  - 「上流への所見」で依頼の文案を出す前に、流入予定の `fixes:` と上流の履歴で修正済みかを確かめる(修正済みなら文案を出さず「上流で修正済み(区間 K)」と書く)。

### 先に取れる印(pick)

修正元の区切りで止まった fork は、修正の区間に着くまで既知の不具合を抱えたまま push する。上流が出荷のときに「壊れた地点に修正だけを載せても通るか」を機械で試し、通った修正に印を付ければ、/flux は修正元の区間を取り込んだ直後にその修正を cherry-pick して、壊れた区切りのまま push せずに済む。

- 欄: 索引の行の `pick:clean | -`。`fixes:` のある notice にだけ付く(`pnpm test:notices` が検査)。欄なし(古い notice・判定できなかった notice)は `-` と同じ扱いで、今の動き(上の /flux の扱い)のまま
- 書くのは /ship: `fixes:` の notice と索引の行を含む commit の後、push の前に `pnpm notices:pick-check <commit>` が判定して**索引のその notice の行**に書き(本文には書かない)、/ship がそれを同じ commit に入れる(`git commit --amend`)。人の宣言は要らない。古い版の pick-check が本文に書いた `pick:` も読む側は受ける
- 試す土台 = 壊れた地点(修正元の区切りのコミット): 修正元(notice id ならその追加 commit、`commit:<sha>` ならその commit)から履歴を進んで最初に来る区切りの notice の追加 commit。修正の前に区切りが無ければ修正元と修正は同じ区間で届くので `-`。修正元が複数なら最も古い壊れた地点。fork の位置では試さない(上流からは見えない。fork 側の衝突は /flux が戻して今の動きに落とす)
- clean の条件(全部): 本体と notice が同じ 1 commit / `pnpm-lock.yaml`・`src/app/route-map.jsonl` を含まない / 手順(required_actions 〜 manual_steps)が壊れた地点より後の notice を名指さない / 壊れた地点で cherry-pick が衝突しない / 載せた木で `pnpm typecheck`・`pnpm test:config-module-load`・`pnpm registry:check` が通る(その木に無い script は未実行として飛ばす)/ 遅れた fork 向けの前提の検査(`notices:hotfix-check` と同じ: 足した・変えたルールの `paths:`・手順の `pnpm <script>`・名指すパス)が何も挙げない。cherry-pick が通っても間の commit に意味で依存する修正は壊れるので、型検査まで通して付ける
- 修正の修正(`fixes:` の先が修正): 前の修正が `pick: clean` のときだけ、その土台に前の修正を載せた木で試す。前の修正が clean でなければ `-`(fork も前の修正を先に取っていない)
- 別の notice の clean な修正も先に載せる: 出荷済み(出荷する先端の索引にある。壊れた地点の脇の commit で出した修正も含む)で修正の後の履歴にない `pick: clean` の修正のうち、その土台が壊れた地点かその祖先で、壊れた地点の祖先でないもの(fork が壊れた地点に着くまでに先に取っているもの)を、履歴順に壊れた地点へ先に載せてから試す(土台 + 先に載せた修正 = fork の実際の木)。載らなければ `-`。載せた修正は pick-check の出力(土台の説明)に出し、索引の行には残さない(/flux も同じ順で取るので同じ木になる)
- /flux: 直接の親が出した `pick: clean` の修正を、`fixes:` の参照先のどれかが適用済みになった直後(修正元の区間の commit の後、push の前)に `git cherry-pick -x` で取り、修正の verify と区間の検査を通してから区間と一緒に push する。台帳は緊急修正と同じ `picked:` の行。修正元の区間の手前の問い(進めるか止めるか)はしない。衝突・検査の失敗は戻して、その問いに戻る。多段では祖父 notice の `pick:` は読まない(`.claude/skills/flux/relay.md`)
- 出荷索引は pick の外: 修正の commit は notice の索引の行(`.notices/shipped/<fork_id>.md`)を含むが、索引は追記だけの上流の帳簿で、索引の無い・短い土台では必ず衝突する。pick-check・hotfix-check は索引の変更を捨てて載せ(`scripts/notices/pickDroppingIndex.mjs`)、/flux も衝突が `.notices/shipped/` だけなら fork 側を採って続ける(fork が無ければ消す)。fork は pick の時点で上流の索引を要らない(未適用の判定は上流の先端の索引を読む)。索引は後の merge で届く
- 脇の commit で出した修正: 修正を壊れた地点の脇の commit で出して merge すると、その修正を取らなかった fork では脇の commit が区間の merge 先になり、merge すると上流との merge-base が 2 つになる(所有の検査が判定できない)。/flux はその区間を見つけ(`incoming.mjs` の `offLine`)、merge の前に止まって取り方(修正を pick する・ユーザーに聞く)を出す。所有の検査はこの形を判定するように作り直さない(fork は常に pick する前提)
- 緊急修正との違い: `hotfix:` は人が宣言して全部の区間の前に割り込む。`pick: clean` は機械の印で、修正元の区間の直後に取るだけで前には出ない

## 緊急修正(hotfix)— 間の変更を飛ばして先に届ける

区間の merge は履歴の順に進むので、遅れている fork には修正がすぐ届かない。本番が壊れているとき、または壊れていなくても人間が先に届けると宣言したときだけ、上流が `hotfix:` を宣言した notice の commit を `/flux` が cherry-pick する。任意の commit は取らない(区間の merge を崩さないため)。

- 宣言: `/ship hotfix`。人間が指示したときだけ付ける(全 fork の作業に割り込むため)
- 上流の条件: 本体と notice を同じ 1 commit に入れる / `pnpm-lock.yaml`・`src/app/route-map.jsonl` を含めない / `required_actions` は後の notice を前提にしない / `fixes:` があれば `pnpm notices:pick-check` で壊れた地点に載ることを確かめる(`/ship`。衝突・検査の失敗なら出さない。出荷索引だけの衝突は数えない: 上の「先に取れる印」)/ 遅れた fork の位置に載せた木で、足した・変えたルールの `paths:`・notice の手順の `pnpm <script>`・名指すパスが揃うことを確かめる(`pnpm notices:hotfix-check`。揃わなければ依存を外すか、その fork で何が通らないかを required_actions に書く)
- 受け取り: 通常の `/flux` が未適用の `hotfix:` を見つけて通常の区間より先に計画する。専用のコマンドは無い。次の区間に入っているなら merge で届くので pick しない。`fixes:` の修正元が未適用の fork には不具合がまだ無いので pick しない
- 台帳: `upstream:` は今の merge-base のまま、`picked:<元の commit>` を足す。記録済みなので後の区間の区切りにならない。後の merge では同じ変更が自動で解決される
- 所有の検査: `picked:` の分は基準 + pick と同じ中身なら合格(`src/lib/forkOwnership/README.md`「緊急修正の pick」)。衝突を手で解いたファイルや違反になったファイルは 1 ファイル 1 行の一時許可で通し、後の区間がそのファイルに触れたら許可を取り直す
- 多段: 取れるのは直接の親の commit だけ。上の段から順に進む(`.claude/skills/flux/relay.md`)

## 解決(resolves)— 下流から届いた依頼を片付けた

下流の fork は、受け口の外の書き換えを「直接の親への依頼が片付くまで」の一時許可で通す(`src/lib/forkOwnership/README.md`「一時許可」)。許可は依頼の番号を持ち、その番号が解決したら失効する。解決を下流へ伝えるのがこの欄。

- 形式: `resolves: <指令 id>, ...`。指令 id = 受信箱のファイル名(`<YYYYMMDD-HHMMSS>-<slug>`)。複数可
- 書く条件: `/ship` が `/inbox` から来た指令(`order:<id>`)を出荷し、その指令の依頼元(requester)が自リポ以外のリポ(下流の fork)のとき。上流からは、下流がその依頼に一時許可を書いているかが見えないので、**他に notice が要らなくても** `severity: info` + `required_actions: none` + `checkpoint:` の notice を出して `resolves:` を伝える
- 却下(rejected)・取り下げで閉じた依頼にも書く(閉じた = その番号の一時許可は失効する)。結果は `done/` の RESOLUTION にあり、下流は `/wen` で却下を知って、元に戻す・受け口へ移す・別の方針で許可し直す(失効した許可は `pnpm ownership:check` が違反に戻すので放置されない)
- 下流の使い方: `pnpm ownership:check` が基準(取り込み済み)の索引の行と本文(直下と `done/`)の `resolves:` を集め(本文が消えても索引の行で失効は変わらない)、すべての番号が解決した一時許可を失効(expired-resolved)にする。`/flux` は区間の計画で、流入する `resolves:` のうち自分の一時許可に当たる行を示す
- 書式は `pnpm test:notices` が検査する(id の形・重複)。参照先の実在は見ない(受信箱は git の外)

## 中継(relay)— 3 段以上の Tier

T1→T2→T3 の構成では、T1 の notice は T2 が merge した時点で T2 のツリーに入り、T3 が T2 を merge すると T3 にも届く。T3 から見るとこれは `from:` が自分の origin でも直上 upstream(T2)でもない notice(= **祖父 notice**)で、そのままでは未適用と判定される。しかも追加 commit は T1 の生 commit(T2 の衝突解消を含まない)なので、そこで区間を切ると T3 は T2 が解いた衝突をもう一度解くことになり、さらに T2 の merge commit とも衝突する。そこで次の 3 つで扱う。

### 1. 祖父 notice の区切り(中継 notice が無くても常に効く)
- 判定: 自分の索引でも直上 Tier の索引でもない索引の行(`shipped/<名前>.md` のファイル名で分かる)= 祖父 notice。索引の無い上流では `from:` の repo が自分の origin とも直上 upstream の URL とも一致しない notice。
- **祖父 notice の追加 commit は区切りにしない**。代わりに、直上 Tier の台帳(`.notices/applied/<中間 Tier の名前>.md`、merge で流れてくる。名前 = 直上 Tier の fork_id:)にその id が記録された commit を区切り点とする: `git log -S"id:<id>" --format=%H <upstream>/<branch> -- .notices/applied/<中間 Tier の名前>.md` の最古。台帳の `commit:` 欄は `-` のことが多いので使わない。これで、中間 Tier が衝突を解いて適用し終えた点まで merge される。
- 直上 Tier の台帳に記録が無い(中間 Tier が手動 merge だけして未適用等)祖父 notice は、従来どおり追加 commit を区切りとし、/flux が警告を出す。
- 中継 notice(下記)に covered されていない祖父 notice は、中間 Tier の台帳のその id の行の `relay:` 欄で扱いを分ける:
  - `relay:none`: 中間 Tier が差分で「中継不要」と判定済み(下記 3)。下流が受け取るコードは上流と同じなので、上流 notice をそのまま適用する。
  - 欄が無い(判定導入前の旧台帳): required_actions が中間 Tier の状態を前提に書かれている。/flux は計画にその旨を注記し、中間 Tier の台帳 `notes:` を参考に自 fork の実情へ写像する。

### 2. `covers:`(中間 Tier が書く中継 notice)
- 中間 Tier は、下記 3 の判定で中継が必要になった上流 notice を、自分の変更・衝突解消・移動の内容とあわせて区間ごとに 1 件の notice にまとめる(/flux が下書きする)。`covers: <id>, <id>` にまとめた上流 notice の id を書く。
- /flux の扱い:
  - covered された id は、covers 側の notice を適用した時点で適用済みになる。台帳には covered id も `notes: covered by <covers 側 id>` で自動記録する。
  - covered された notice の追加 commit・台帳記録 commit は区切りにしない。区間は covers 側 notice の追加 commit まで伸び、covered notice が履歴上先に届いていても単独の区間を作らない。
  - 区間内の covers 側・covered 側の `moved:` はすべて合わせて移植に使う(中継 notice 側にも合わせたものを書くのが原則だが、書き漏れの保険)。
  - `covers:` に書かれた id が上流の先端のどの索引にも無ければ報告する(黙って飛ばさない)。
- 後方互換: `covers:` を知らない旧 /flux でも中継 notice が安全に動くよう、中継 notice の合成(`.claude/skills/flux/relay.md`「中継 notice の合成」)は required_actions に「この notice の commit まで 1 区間で merge し、covered notice の commit で止まらない」「covered id を台帳に記録する」の 2 行を必ず入れる(新 /flux では no-op)。
- 状態の見える化: `/flux status --chain` が祖父 notice ごとに「中間 Tier が適用済みか → 中継 notice に covered されているか(または `relay:none`)→ 自分が適用済みか」を 1 行ずつ出す。

### 3. 中継判定(中間 Tier の /flux が区間ごとに行う)
中継が要るかどうかは文面の解釈ではなく **git の差分と適用の事実だけ**で決める。下流に補足が要るのは「上流が変えた箇所が中間 Tier で食い違う」「中間 Tier が適用作業で上流の外まで変えた」「中間 Tier が手順から外れた」ときだけで、どれも無ければ下流が中間 Tier から受け取るコードと作業は上流 notice どおりで済むため。
- 対象 fork: `.claude/rules/project.md` の `downstream: yes` の fork(読み手は `src/lib/forkOwnership/forkIds.mjs` だけ。宣言が無い・誤りは止まる)。`downstream: none` の末端 fork は判定しない。
- 中継の義務(CLAUDE.md DOWNSTREAM_NOTICES relay): `/flux` の中継未判定の報告が 0 でない間は flux 未完(助言ではない)。中継を忘れたら次の commit で他の作業より先に入れる。
- 対象 notice: 区間内で適用した、自分の索引に無い notice(covered id は covers 側と一緒に判定)。
- 判定(区間の verify 後、commit 前): `Q` = その notice の区切り点、`P` = 上流履歴上で直前の notice の区切り点(無ければ fork 成立点。どちらも `incoming.mjs` の出力の `point`)、`A` = 区間の merge 直後の HEAD。次のどれか 1 つで中継が必要、どれも無ければ中継不要(①② は `.claude/skills/flux/relay-check.mjs` が出す。詳細と限界は `.claude/skills/flux/relay.md`「中継判定」):
  - ① ハンクの重なり: 上流が P→Q で変えた行範囲と、作業ツリーが Q と食い違う行範囲が重なるか接する。同じファイルでも離れた場所の fork 独自の追加は数えない。
  - ② 適用作業での上流変更ファイル外の変更: A から作業ツリーまでに、上流が変えていないファイルを変えた(掃討・改名など)。
  - ③ required_actions からの逸脱: 手順を実行しなかった・変えて実行した(台帳 `notes:` に書く逸脱)。差分の有無を問わない。
  - `.notices/` と lock ファイルは ①② の対象外。
- 結果は台帳の各行の `relay:` 欄に明示する: `relay:none`(中継不要)/ `relay:<中継 notice id>`(中継した)。欄が無い = 判定導入前の未判定。
- 中継が必要な notice が区間に 1 件以上あれば、/flux がその区間で中継 notice を 1 件下書きし(合成規則は `.claude/skills/flux/relay.md`「中継 notice の合成」、判定の根拠 = ①② の該当ファイル・行範囲と ③ の逸脱を `notes:` に載せる)、区間の適用コミットに含める。中継 notice の追加 commit と台帳記録 commit が同じになるので、下流の区切り点がぶれない。
- 中身の無い中継 notice は作らない。中継不要の notice は `relay:none` だけで閉じる。
- 未判定の旧台帳行(`relay:` 欄が無く、どの `covers:` にも無い)は /flux が件数を報告し、`/flux relay` でまとめて中継 notice に covers して閉じる(基準点が古く差分判定できないため)。

## 適用状態の考え方

状態は「通知を受け取ったか」というイベントではなく、**ファイルと git 履歴の集合演算**で毎回導出する:

> 上流の先端の全索引の行 − 自分の索引の行 − 継承済み notice(fork 成立点から自動判定)− 自 fork 台帳に記録済みの id = 未適用

(索引の無い上流では、索引の行の代わりにツリーの本文(現役と `done/`)を読む。`/flux` は `.claude/skills/flux/incoming.mjs` で、`pnpm ownership:check` は同じ式を基準の版で求める。)

(covered id は covers 側の適用時に台帳へ自動記録されるので、この式のままで扱える。中継の要否(`relay:` 欄)は適用状態とは別の記録で、この式には影響しない。)

このため、merge を誰がどの経路で行ったか(手動 / GitHub / /flux)に関係なく、いつ実行しても正確な未対応リストが得られる。

### 継承済み(pre-fork)の自動判定

notice は「変更前から存在していた fork」向けの差分指示であり、**fork は最新コードごと clone して始まるため、fork 成立点のツリーに既にあった notice は定義上すべて適用済み**。新規 fork がセットアップ手順なしでこの状態になるよう、/flux は実行のたびに次を導出して未適用判定から除外する(台帳への記録も不要):

1. fork 固有の最初のコミット = `git rev-list --reverse HEAD ^upstream/<branch>` の先頭
2. その第一親(無ければそのコミット自身。GitHub テンプレート起源のルートコミット等)= fork 成立点
3. fork 成立点の索引の行 ∪ そのツリー(`git ls-tree`)に存在する notice の本文 = 継承済み(索引の導入前に成立した fork のため両方を見る)

fork 固有コミットがまだ無い場合は現役 notice 全件が継承済み。shallow clone だけは履歴を辿れないため /flux がユーザーに確認する。

継承済み notice を下流側で**ファイル削除してはいけない**: 上流の本文の片付けと merge で衝突しうる。除外は判定式で行うのが正。本文の片付けは上流(出荷したリポ)がする。

## 台帳(applied/)が fork ごとに別ファイルである理由

台帳を単一ファイルにすると、多段 Tier で中間 Tier の台帳が下流に merge で流れ込み、双方の追記がコンフリクトする。fork ごとにファイル名を分ける(名前 = その fork の `.claude/rules/project.md` の `fork_id:`。例 `oripa-do.md`)ことで merge 衝突が構造的に起きない。台帳の各行は取り込んだ上流の版 `upstream:<sha>` を持ち、`pnpm ownership:check` が Tier1 の版をここからたどる(`src/lib/forkOwnership/README.md`「多段の Tier」)。副産物として、下流からは中間 Tier がどこまで適用したかも見える。台帳は上流へは流れないため、上流側からの完了追跡は行わない(往復不要)。

## 本文と添付物の片付け

- 出荷済み(push 済み)の本文は書き換えない(push 前の自分の commit は直してよい。書き間違いでも、手順が実態と合わないなら新しい notice の `fixes:` で直す)。索引の行も書き換えない
- 本文は区間が閉じた(後ろに区切りの行がある)ものから消してよい。期限はなく、全 fork の適用を待たない(遅れた fork は足した commit の版を履歴から読む)。消すのは出荷したリポだけ。片付けだけの削除に notice は要らない
- 移行・codemod を使う notice: ① コード変更・移行 / codemod・案内の notice を同じ commit で出荷 → ② 自分の DB で移行を実行 → ③ 次の commit で添付と本文を消す(① を squash しない)
- `done/` への移動の運用はやめた(発見と適用状態は索引・履歴・台帳から決まるので、本文を移して対象外にする必要がない)。既存の `done/` の 2 本はそのまま読まれる
- 上流は、読む側(この文書の索引を読む `/flux`・所有の検査)が全 fork に届くまで既存の本文を消さない
