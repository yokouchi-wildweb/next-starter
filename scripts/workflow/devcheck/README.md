# scripts/workflow/devcheck(pnpm workflow devcheck)

開発中の確かめの入口の命令。エージェントが変更を確かめるとき、この命令が事実と候補を出し、エージェントは要る確かめを短い箇条書きにして go を 1 度だけもらい、全部を `run` で行い、最後に必ず `cleanup` で片付けて、結果を 1 度で報告する(手順はスキル `/devcheck`、好みは各リポの `.claude/rules/behavior.md` RUNNING_APP の 1 行)。指令の確かめのシート(`<指令>.check.md`)を回すのは別のスキル `/patrol`(サーバー・ログイン・片付けはこの命令を使う)。

## コマンド

```bash
pnpm workflow devcheck plan [--json]      # 事実(方針・fork の項目・文脈・今の状態)と候補。最後の候補はいつも片付け
pnpm workflow devcheck status [--json]    # 今の状態だけ(この作業場所のサーバー・動いている dev-tab の数と上限・管理者の有無)
pnpm workflow devcheck run <候補> [引数…] [--manual-go]   # 候補 1 つを実行
pnpm workflow devcheck cleanup            # この命令が作った DB の行を消し、立てたサーバーを止める
```

plan と status は何も書かない(記録を消さない。管理者の有無は `pnpm workflow dev-admin run --check` の読む入口)。

## 種類(上流のコード `lib.ts` の KINDS)

| 種類 | run の形 | 打つコマンド |
|---|---|---|
| server | `run server` | `pnpm workflow dev-tab run`(文脈が server=background なら `--background`)。立てる前に動いている dev-tab の数を数え、上限(dev_max)以上なら 5 秒ごとに数え直して待つ(`DEVCHECK_WAIT` 秒、既定 300) |
| browser | (run しない) | エージェントが Playwright MCP で行う。データは画面からだけ作る |
| login | `run login` | `pnpm workflow dev-admin run`(確認用の管理者。JSON をそのまま出す) |
| db-write | `run db-write "INSERT INTO <表> … RETURNING <列>"` | `pnpm ops db inspect query "<SQL>" --json`。返った id を記録し、cleanup で消す |
| db-delete | `run db-delete "DELETE FROM <表> WHERE …"` | 同じ入口 |
| env-add | `run env-add <鍵>`(値は標準入力) | `.env.development` だけに 1 行足す。もうある鍵は書き換えない。値は表示しない |
| test | `run test <path…>` | `pnpm test <path…>` |
| check | `run check <target…>` | `pnpm check <target…>` |
| fork の項目 | `run <項目の名前>` | 項目のファイルのコマンド(引数は取らない) |

- スキーマの push(`pnpm db:push`)・本番(`--env production`・`--confirm`)はどの種類にも無い(テストで固定)
- DB の種類は **開発のテスト用データ専用**。guard を通る入口(`pnpm ops db inspect query`: 書く入口として guard を通り、既定は開発、本番は人の確認が要る)を `--env` を付けずに使う。workflow の道具は DB を直接書けない(lint `tools-no-db-write`)
  - 生の SQL なのでサービスを通らない(監査・リクエストの記憶・日付の扱い)。user・setting(リクエストの記憶を持つ表)の行は画面から作る
  - 1 文だけ: `INSERT INTO <表> … RETURNING <列>`(作った行を消すため RETURNING が要る)/ `DELETE FROM <表> WHERE …`。DDL・UPDATE・複数の文・WHERE の無い削除・スキーマつきの表は断る
- シェルを通さずに打つ(引数を分けて渡す)

## 方針(policy)

- `policy.default.json`(上流、全部 `auto`)に `policy.override.json`(fork が足す。上流は出さない、受け口)を種類ごとに重ねる
- `auto` = go 1 回の中で実行 | `manual` = その項目だけ別に go を取り、`--manual-go` を付けた時だけ実行 | `off` = この命令は実行しない(計画で「手で」、run は exit 4)
- 知らない種類・値は止める(exit 2)

## fork の項目

- `items/<名前>.json` = `{ name, kind, command, what }`(書式は `items/README.md`)。受け口(上流は README だけ)
- command はこのリポの入口(`pnpm <script>` / `pnpm workflow <対象> <動作>` / `pnpm ops <対象> <動作>` の実在する物)だけ。シェルの記号・`--env`・`--confirm`・`db:push` は断り、plan に理由を出す
- 方針はその項目の種類のものが効く

## この命令の記録と片付け

- `<チェックアウト>/.agent/devcheck.json` = `{ v: 1, startedServer, rows: [{ table, column, ids }] }`。この命令だけが書く
- server は dev-tab が「立てました / 起動中」と答えた時だけ「立てた」と記録する(もう動いていた・外のサーバーは記録しない = 止めない)
- `cleanup`: 記録の行を消し(`DELETE FROM "<表>" WHERE "<列>" IN (…)` を同じ入口で)、立てたサーバーを止め(`pnpm workflow dev-tab run stop`)、記録を消す。消せない・止められない物は記録に残して exit 1
- 画面から作った行はこの命令では分からない: 確かめの報告に「残した行」として書く

## 文脈(DEVCHECK_CONTEXT)の約束

ほかの道具(エージェントを束ねる道具など)がこの命令に条件を渡す口。鍵にどの道具の名前も入れない。

- 環境変数 `DEVCHECK_CONTEXT=<絶対パス>` のファイルを、命令が呼ばれるたびに読む
- 中身 = 版つきの key=value(1 行 1 つ、`#` から後は注釈):

```
v=1                     # 版(必須。今は 1)
approval=each|auto      # each = 毎回 go を取る / auto = go を取らずに進める(スキルが読む)
server=tab|background   # 開発サーバーの置き方(background = dev-tab --background)
dev_max=<n>             # 同時に動かしてよい dev-tab の数(このリポのワークツリー全部)
workdir=<絶対パス>      # 作業場所(繰り返してよい)
```

- 変数が無い・空 = 単体(approval=each、server はタブ = dev-tab の決め方、dev_max なし)
- 変数があるのにファイルが読めない・版が無い / 違う・知らない鍵・悪い値 = 止める(exit 2、ファイルと鍵を名指す 1 行)。新しい鍵は版を上げる

## 終了コード

- plan / status: 0 = 出した / 2 = 方針・項目・文脈が読めない
- run: 打ったコマンドのもの(server の 3 = dev-tab の「この道具の外で開発サーバーが動いている」)/ 1 = 失敗・使い方 / 2 = 方針・項目・文脈が読めない・断った文 / 4 = 方針で断った / 5 = サーバーの上限で待ちきれない
- cleanup: 0 = 片付けた(片付けるもの無しも)/ 1 = 残った物がある

## ファイル

- `lib.ts`(種類・方針・項目・文脈・計画)・`lib.run.ts`(実行の部品)・`lib.exec.ts`(run / cleanup の本体、外に触る物は Deps で受ける)・`lib.facts.ts`(環境に触る部品)
- 動作 `plan.ts`・`status.ts`・`run.ts`・`cleanup.ts`
- テスト: `pnpm test scripts/workflow/devcheck`(DB・サーバーには触れない。打つはずのコマンドを偽の実行役で確かめる)
