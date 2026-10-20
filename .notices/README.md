# .notices/ — DOWNSTREAM NOTICE(上流追随通知)

上流リポの変更に伴い、下流 fork 側で追随作業(コード修正・DB マイグレーション・バックフィル・再生成など)が必要になるとき、その通知を **リポジトリ内のファイルとして**ここに置く仕組み。

配送インフラは git そのもの: 通知は変更本体と同じコミット/PR に含めて出荷され、**下流が上流を merge した瞬間に一緒に届く**。ローカルマシンの共有ディレクトリ等には依存しないため、リポジトリを fork した誰でもこの仕組みに乗れる。T1→T2 / T2→T3 など任意の上流→下流の多段構成でそのまま機能する。

## 構成

```
.notices/
├── README.md              # この文書(仕様)
├── <id>.md                # 現役の notice(id = <YYYYMMDD-HHMMSS>-<slug>)
├── done/                  # 上流がアーカイブした notice(全fork適用済み・陳腐化)
└── applied/
    └── <fork-id>.md       # fork ごとの適用台帳(その fork だけがコミットする)
```

## 使い方

- **起票(上流側)**: `/downreq` スキル。会話文脈から notice を合成して `.notices/<id>.md` に書き出す。変更本体と同じコミット/PR に含めて出荷する。
- **中継(中間 Tier)**: `/downreq relay`。自分が適用した上流 notice を `covers:` にまとめた中継 notice を下書きする(下記「中継(relay)」)。
- **受領・適用(下流側)**: `/flux` スキル。upstream の fetch → 未適用 notice を checkpoint ごとの区間に分割 → 適用計画提示 → 承認1回で区間ごとに merge・コード修正・DB 操作・検証・台帳記録・コミット・push を完走する。`/flux status` で状態確認のみ、`/flux next` で次の 1 区間だけ。承認後でも、取り込む変更がその fork を壊す・db 差分が破壊的・notice と実態が食い違う等の**停止条件**に当たれば区間を commit せずに止まって選択肢を示す(押し切らない)。最終報告には「上流への所見」(上流のバグ・notice のズレ・/upreq 候補)を常設。
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

- `required_actions` は下流の Claude が承認1回でノンストップ実行できる具体度で書く(fail-auto)。対話プロンプトを出すコマンドのみ `[user-run]` マーカーを付け、/flux がセッション内ユーザー実行(`!` プレフィックス)で合流する。
- 人間にしかできない作業(Vercel 環境変数、外部ダッシュボード等)だけ `manual_steps` に分離する。
- `moved` はファイル・ディレクトリを移動・改名する notice では**必須**(それ以外は欄ごと省略)。下記「移動・改名(moved)」参照。
- `covers` は中間 Tier が上流の notice を下流へ中継する notice(relay notice)でだけ書く(それ以外は欄ごと省略)。下記「中継(relay)」参照。
- `notes` で特定の fork に触れるときは、その fork で実際に差分を取った結果だけを書く(推測で書かない。調べていない fork は `not checked`)。
- `checkpoint` は**原則ラベル必須**(既定 = 区切り)。「この notice まで適用すれば fork は整合した休憩点にある」の宣言で、`-` は「後続 notice なしでは半端」という例外宣言(理由を `notes:` に)。欄が無い旧 schema の notice は区切り扱い。下記「区切り(checkpoint)」参照。

## 区切り(checkpoint)と区間適用

長く追随していない fork や初回 merge の fork は、未適用 notice を一度に数十件抱えることがある。全量を 1 回の merge と 1 つの適用計画で進めると、途中で失敗したときに fork が中途半端な状態に残り(schema 変更が 3 つ混ざった merge の途中で db:push が落ちる等)、どこまで終わったかも分かりにくい。DB 規模が大きい fork や独自要素の多い fork ほど危険が増す。そこで **notice 1 件 = 休憩点 1 つを既定とし、/flux は未適用 notice を区切りごとの区間に分けて 1 変更ずつ閉じて進める**。

- `checkpoint: <label>` が既定(notice は追随作業の単位で出荷されるので、適用し終えた時点で fork が整合しているのが普通)。`checkpoint: -` は「後続 notice を適用しないと fork が動かない中間点」という上流からの例外宣言で、理由を `notes:` に書く。欄が無い旧 schema の notice は区切り扱い(安全側)。
- 各 notice は上流履歴上の 1 点に対応づく: notice ファイルを追加した commit(`git log --diff-filter=A --format=%H <upstream>/<branch> -- .notices/<id>.md`)。`from: commit:` 欄は参考情報で、判定には使わない。
- 区間 = 履歴順に並べた未適用 notice を、区切り notice(`checkpoint` が `-` 以外、または欄なし)の直後で切ったもの。`-` の notice は次の区切りまで同じ区間に入る。最後の区切り以降〜上流 HEAD が末尾区間(空のこともある)。同じ commit で出荷された複数 notice は merge 先が同じ区間が連続するだけで問題ない。
- /flux は区間ごとに「その区間の merge 先(区切り notice の追加 commit、末尾区間は上流 HEAD)まで merge → 区間内 notice を適用 → verify → 台帳 → commit → push」を繰り返す。途中で止まっても fork は直前の区切りに居るので、再実行すれば続きから進む(状態は下記の集合演算で毎回導出されるため、追加の記録は不要)。`/flux next` は次の 1 区間だけ進めて止まる。
- merge commit は区間数ぶん増える。これは意図した代償(区切りごとに fork が整合する)。追随を小刻みに続けている fork は今までと同じ。
- 上流側の責務: notice は、その区切りに含めたい変更本体と同じ commit かそれより後の commit に含める(notice を先に出すと、merge 先に変更本体が含まれない)。追随作業が無い区切りは `severity: info` + `required_actions: none` + `checkpoint:` の notice で宣言する。

## 移動・改名(moved)

`git merge` は「merge-base → merge 先」の差分をまとめて見るため、上流が「新しいパスに新規作成 + 古いパスを互換 shim に置き換え」を行うと、git はこれを改名と認識しない(古いパスは「変更」、新しいパスは「追加」に見える)。fork が古いパスで編集していた内容は、shim との衝突になるか、気づかれずに上流版で上書きされる。上流のコミットを mv だけと中身変更に分けても、区間の merge 先が両方を含めばまとめて見られるので解決しない。

そこで移動の対応表を notice に書き、fork の編集の移植は /flux が行う:

- 形式: `moved: <old> -> <new>; <old> -> <new>` 。リポジトリルートからの相対パス。ディレクトリも可(配下をまとめて対応づける)。
- /flux は計画時に、各組について fork が移動元を編集しているか(`git diff <merge-base> HEAD -- <old>`)を調べて計画に出す。merge 後、その差分のパスを新しいパスに書き換えて `git apply --3way` で当て直す。古いパス側の衝突は上流版(shim または削除)を採る。当て直せなかった部分は停止条件として止まる。
- 欄が無い旧 notice・`moved:` を知らない旧 /flux では今までどおりの動作(merge するだけ)。

### 削除・移動は notice と同じ commit で出す(必須)

fork が手を入れうるファイル(docs・README・registry・config 等)を削除・移動する commit には、その notice(移動なら `moved:`、移動先の無い削除なら `notes:` に削除したパスと「fork 独自の内容の移し先」)を**同じ commit に含める**。後の commit で notice を出すと、/flux はその notice の追加 commit で区間を切るため、削除だけが先の区間で fork に届き、fork は案内の無い modify/delete コンフリクトを自力で解くことになる。

- 起票前に `git diff --name-status --diff-filter=DR <変更前> <変更後>` で削除・改名を全て洗い出し、notice に漏れなく載せる(/downreq が行う)
- fork が編集していないと分かっているファイル(upstream 専用の内部実装等)だけの削除なら notice は不要

## 中継(relay)— 3 段以上の Tier

T1→T2→T3 の構成では、T1 の notice は T2 が merge した時点で T2 のツリーに入り、T3 が T2 を merge すると T3 にも届く。T3 から見るとこれは `from:` が自分の origin でも直上 upstream(T2)でもない notice(= **祖父 notice**)で、そのままでは未適用と判定される。しかも追加 commit は T1 の生 commit(T2 の衝突解消を含まない)なので、そこで区間を切ると T3 は T2 が解いた衝突をもう一度解くことになり、さらに T2 の merge commit とも衝突する。そこで次の 2 つで扱う。

### 1. 祖父 notice の区切り(中継 notice が無くても常に効く)
- 判定: `from:` の repo が自分の origin とも直上 upstream の URL とも一致しない notice = 祖父 notice。
- **祖父 notice の追加 commit は区切りにしない**。代わりに、直上 Tier の台帳(`.notices/applied/<中間 fork-id>.md`、merge で流れてくる)にその id が記録された commit を区切り点とする: `git log -S"id:<id>" --format=%H <upstream>/<branch> -- .notices/applied/<中間 fork-id>.md` の最古。台帳の `commit:` 欄は `-` のことが多いので使わない。これで、中間 Tier が衝突を解いて適用し終えた点まで merge される。
- 直上 Tier の台帳に記録が無い(中間 Tier が手動 merge だけして未適用等)祖父 notice は、従来どおり追加 commit を区切りとし、/flux が警告を出す。
- 中継 notice(下記)に covered されていない祖父 notice は、required_actions が中間 Tier の状態を前提に書かれている。/flux は計画にその旨を注記し、中間 Tier の台帳 `notes:` を参考に自 fork の実情へ写像する。

### 2. `covers:`(中間 Tier が書く中継 notice)
- 中間 Tier は、自分が適用した上流 notice のうち下流にも追随作業が要るものを、自分の変更・衝突解消・移動の内容とあわせて 1 件の notice にまとめて起票する(`/downreq relay`)。`covers: <id>, <id>` にまとめた上流 notice の id を書く。
- /flux の扱い:
  - covered された id は、covers 側の notice を適用した時点で適用済みになる。台帳には covered id も `notes: covered by <covers 側 id>` で自動記録する。
  - covered された notice の追加 commit・台帳記録 commit は区切りにしない。区間は covers 側 notice の追加 commit まで伸び、covered notice が履歴上先に届いていても単独の区間を作らない。
  - 区間内の covers 側・covered 側の `moved:` はすべて合わせて移植に使う(中継 notice 側にも合わせたものを書くのが原則だが、書き漏れの保険)。
  - `covers:` に書かれた id が merge 後のツリー(現役・`done/`)のどこにも無ければ報告する(黙って飛ばさない)。
- 中間 Tier の /flux は、全区間の後に「適用済みだが中継していない」id(自台帳の id のうち、`from:` が自分の origin でなく、自分の origin の notice のどの `covers:` にも無いもの)を数えて報告する。ツリー内に自分の origin の notice が 1 件以上ある(= 上流として振る舞った)fork だけが対象で、末端 fork には出さない。追随作業の無い上流 notice も、中継 notice の `covers:` に含めて閉じる(`required_actions` の該当箇所は none でよい)。
- 後方互換: `covers:` を知らない旧 /flux でも中継 notice が安全に動くよう、`/downreq relay` は中継 notice の required_actions に「この notice の commit まで 1 区間で merge し、covered notice の commit で止まらない」「covered id を台帳に記録する」の 2 行を必ず入れる(新 /flux では no-op)。
- 状態の見える化: `/flux status --chain` が祖父 notice ごとに「中間 Tier が適用済みか → 中継 notice に covered されているか → 自分が適用済みか」を 1 行ずつ出す。

## 適用状態の考え方

状態は「通知を受け取ったか」というイベントではなく、**ファイルと git 履歴の集合演算**で毎回導出する:

> ツリー内の現役 notice(done/ 以外)− 継承済み notice(fork 成立点から自動判定)− 自 fork 台帳に記録済みの id = 未適用

(covered id は covers 側の適用時に台帳へ自動記録されるので、この式のままで扱える。)

このため、merge を誰がどの経路で行ったか(手動 / GitHub / /flux)に関係なく、いつ実行しても正確な未対応リストが得られる。

### 継承済み(pre-fork)の自動判定

notice は「変更前から存在していた fork」向けの差分指示であり、**fork は最新コードごと clone して始まるため、fork 成立点のツリーに既にあった notice は定義上すべて適用済み**。新規 fork がセットアップ手順なしでこの状態になるよう、/flux は実行のたびに次を導出して未適用判定から除外する(台帳への記録も不要):

1. fork 固有の最初のコミット = `git rev-list --reverse HEAD ^upstream/<branch>` の先頭
2. その第一親(無ければそのコミット自身。GitHub テンプレート起源のルートコミット等)= fork 成立点
3. fork 成立点のツリー(`git ls-tree`)に存在する notice = 継承済み

fork 固有コミットがまだ無い場合は現役 notice 全件が継承済み。shallow clone だけは履歴を辿れないため /flux がユーザーに確認する。

継承済み notice を下流側で**ファイル削除してはいけない**: 上流がその notice を後から編集・done/ へ移動すると merge で modify/delete コンフリクトになる。除外は判定式で行うのが正。

## 台帳(applied/)が fork ごとに別ファイルである理由

台帳を単一ファイルにすると、多段 Tier で中間 Tier の台帳が下流に merge で流れ込み、双方の追記がコンフリクトする。fork ごとにファイル名を分ける(`<fork-id>` = origin URL のパス部分を `--` 連結・小文字化。例 `acme--shop.md`)ことで merge 衝突が構造的に起きない。副産物として、下流からは中間 Tier がどこまで適用したかも見える。台帳は上流へは流れないため、上流側からの完了追跡は行わない(往復不要)。

## アーカイブ

全 fork 適用済み・陳腐化したと上流が判断した notice は、上流側で手動で `done/` へ `git mv` する。merge で下流にも伝播し、/flux の走査対象から外れる(台帳に記録済み id がツリーから消えるのは正常)。
