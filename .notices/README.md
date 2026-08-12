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
- **受領・適用(下流側)**: `/flux` スキル。upstream の fetch/merge → ツリー内の notice と自 fork 台帳の突合 → 未適用の適用計画提示 → 承認1回でコード修正・DB 操作・検証・台帳記録・コミットまで完走する。`/flux status` で状態確認のみも可能。
- 対応が不要な通常の変更には notice を作らない。ただコミットされて merge で流れていくだけでよい。

## notice スキーマ(英語・機械間ファイル)

```
# DOWNSTREAM NOTICE id:<ts>-<slug>
from: <upstream repo> | branch:<branch> | commit:<short sha>
date: <ISO8601>
severity: breaking | action-required | info
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

## 適用状態の考え方

状態は「通知を受け取ったか」というイベントではなく、**ファイルと git 履歴の集合演算**で毎回導出する:

> ツリー内の現役 notice(done/ 以外)− 継承済み notice(fork 成立点から自動判定)− 自 fork 台帳に記録済みの id = 未適用

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
