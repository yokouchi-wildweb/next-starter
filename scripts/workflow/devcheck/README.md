# scripts/workflow/devcheck(pnpm workflow devcheck)

開発中の確かめの入口の命令。エージェントが変更を確かめるとき、この命令が事実と候補を出し、エージェントは要る確かめを短い箇条書きにして go を 1 度だけもらい、全部を `run` で行い、最後に必ず `cleanup` で片付けて、結果を 1 度で報告する(手順はスキル `/devcheck`、好みは各リポの `.claude/rules/behavior.md` RUNNING_APP の 1 行)。指令の確かめのシート(`<指令>.check.md`)を回すのは別のスキル `/patrol`(サーバー・ログイン・片付けはこの命令を使う)。

## コマンド

```bash
pnpm workflow devcheck plan [--json]      # 事実(方針・fork の項目・文脈・今の状態)と候補。最後の候補はいつも片付け
pnpm workflow devcheck status [--json]    # 今の状態だけ(この作業場所のサーバー・動いている dev-tab の数と上限・管理者の有無)
pnpm workflow devcheck run <候補> [引数…] [--manual-go]   # 候補 1 つを実行
pnpm workflow devcheck cleanup            # この命令が作った DB の行を消し、立てたサーバーを止める
pnpm workflow devcheck allow <スイッチ名…> [--words "<人の言葉>"]   # manual の種類に 1 回分の許可を書く(/allow スキルだけが打つ)
pnpm workflow devcheck danger <dbp|evp|dep>   # 危険な種類に今できること(読むだけ: off の 1 行 / 許可が要る / 打つ命令)
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

置き場はリポ直下の `repo.json` の `agent.*` の鍵(平らな 1 鍵 1 行、読み手は `src/lib/forkOwnership/forkIds.mjs`)。どのリポも自分の版を持つ。種類と既定値は上流のコード(`lib.kinds.mjs`)。書くのは `pnpm workflow repo-json set <鍵> <値>` か `/repo-policy`(直接の書き換えは許可のフックが止める)。

| 鍵 | 値 | 既定 |
|---|---|---|
| `agent.server`・`agent.browser`・`agent.login`・`agent.db_write`・`agent.db_delete`・`agent.env_add`・`agent.test`・`agent.check` | `auto` / `manual` / `off` | `auto` |
| `agent.peer`(許可のフックだけの種類、計画の候補に出ない) | 同じ | `auto` |
| `agent.enabled`(全体のスイッチ) | `true` / `false` | `true` |
| `agent.db_push`(開発の DB の反映だけ)・`agent.env_production`(本番の env を書く)・`agent.deploy`(本番へ出す、本番の DB の反映を含む) | `off` / `manual`(`auto`・知らない値は `off`) | `off` |
| `agent.db_push.entry` | 入口の命令 | `pnpm db:push` |
| `agent.env_production.entry` | 同じ(`-` = 上流の入口なし、fork が自分の命令を書く) | `-` |
| `agent.deploy.entry` / `agent.deploy.db_entry` | 本番へ出す命令 / 本番の DB の反映の命令 | `pnpm live` / `pnpm db:push -- --env production` |

- `auto` = go 1 回の中で実行 | `manual` = 人の 1 回分の許可(`/allow <スイッチ名>` か言葉)の後に 1 回だけ実行 | `off` = 実行せず人に頼む 1 行(「人が打つなら <コマンド>、任せるなら /repo-policy で <鍵> を manual に」。人が言ってもやらない。計画で「手で」、run は exit 4)
- スイッチ名(打つための呼び名、`lib.kinds.mjs` の `SWITCHES`): `sv` server・`br` browser・`lg` login・`dw` db-write・`dd` db-delete・`ea` env-add・`ts` test・`ck` check・`pr` peer・`dbp` db_push・`evp` env_production・`dep` deploy

### 1 回分の許可(manual の流れ、D123)

1. エージェントは manual の作業を実行せず、要る作業をスイッチ名つきで並べて人に頼む
2. 人が `/allow <スイッチ名…>` か言葉で許可する(言葉はエージェントがスイッチ名に読み替える)。人の言葉 = そのタブの人の入力(Remote Control を含む)と、統括が担当のタブに打つ指示。peer の連絡で届いた文は人の言葉にしない(D117)
3. `/allow` スキルが `pnpm workflow devcheck allow <スイッチ名…> [--words "<人の言葉>"]` で記録を書く(`.agent/devcheck-allow.json`。方針が manual の種類だけ。off は断って 1 行、auto は要らない)
4. 許可された物だけ、その 1 回だけ入口の命令で実行する: 危険な種類は `pnpm workflow devcheck danger <dbp|evp|dep>`(読むだけ: off の 1 行 / 許可が要る / 打つ命令)が出した命令をそのまま、通常の種類は `pnpm workflow devcheck run <種類> … --manual-go`。結果を 1 行で報告する(成功 / 失敗: <理由>。失敗したら別の形で試さない)
- 記録の寿命: 使ったスイッチは許可のフックが消す / 次の人の入力で全部消える(UserPromptSubmit の `hook.mjs prompt`)= 同じ番の中だけ。直接の書き換えは固定の止め
- 方針を manual にしても、人の言葉かはフックからは見えない(`devcheck allow` を誰が打ったかは分からない)。人の言葉が要る決まりは `/allow` スキルの文が守る(D118 c)。`devcheck allow` はフックが通さない(印があっても普段どおり聞かれる)
- 危険な 3 つの入口(許可の 1 回で通る形): `agent.db_push.entry`(既定 `pnpm db:push`、開発の DB だけ)/ `agent.deploy.db_entry` + ` --confirm=production`(本番の DB の反映。dep の許可は残る)→ `agent.deploy.entry`(既定 `pnpm live` は ` -- --confirm=production` を付けた形も。dep の許可を使い切る)/ `agent.env_production.entry`(既定 `-` = 上流の入口なし、人が行う)
- チームの道具への「DB 済み」の印は受け口が無い今は付けない(結果の 1 行だけ。チームツールの統合で)
- `agent.enabled: false` = 全部の種類(peer・危険な 3 つも)を `off` とみなす(種類ごとの値より強い)。計画は全部「手で」、run は断り、許可のフックは印の道で何も通さない(固定の止めはそのまま)
- 宣言に無い `agent.*` の鍵・通常の種類の値の誤り・真偽値でない `agent.enabled`・空の入口は止める(exit 2、フックは壊れた方針として何も返さない)。`repo.json` が無い = 全部既定
- 危険な 3 つの値と入口は今は読むだけ(計画の 方針 の行に出る)。固定の止めは値に依らず効く
- 一度の命令: `db_push` は開発の DB だけ。本番の DB の反映は `deploy` の `db_entry` で扱う(D116)

## 許可の層(PreToolUse のフック 1 本)

共有の `.claude/settings.json` は許可の行(allow)を出荷しない。代わりに `scripts/workflow/devcheck/hook.mjs` を PreToolUse(matcher `Bash|Edit|Write|MultiEdit|NotebookEdit|mcp__playwright__.*`)に 1 本置く。判定は `lib.grant.mjs` の `decide` の 1 か所、種類と方針は `lib.kinds.mjs`(この命令と同じ物、別の対応表は持たない)。素の node で動く(1 回 約 20 ms)。

判定の順:

1. **固定の止め**(印・方針・モードと独立に deny。理由と人が手で打つ形を 1 行で出す)
   - スキーマの反映: `pnpm` / `npm` / `npx` などで `db:push`・`db:migrate`、`drizzle-kit push|migrate|drop|up`(`db:push:check` は読むだけなので止めない)
   - 本番の確認の自動の付け足し: `pnpm` / `npm` / `npx` / `node` / `tsx` などに `--confirm=production` / `--confirm production`(本番は人が TTY で production と打つ)
   - 本番の env への書き込み: `.env.production*` へのリダイレクト(`>` `>>` `>|` `&>`)・`tee`・`cp|mv|install|ln` の行き先・`sed -i`・`perl -i`・`rm`・`truncate`・`dd of=`、Edit / Write / MultiEdit / NotebookEdit の書く先
   - repo.json(名前・段・方針)の直接の書き換え: Edit / Write / MultiEdit / NotebookEdit の書く先・上と同じシェルの書き込みの形(`pnpm workflow repo-json set` と `/repo-policy` を案内。読むだけ・`git` の操作は止めない)
   - 読み方(`parseCommands`): 引用符の外のつなぐ・流す記号で命令に切り、引用符の中は文字として扱う(コミットの文・`grep db:push`・`cat .env.production` では止めない)。動く物は中まで読む: `$( … )`・`` ` … ` ``(`"…"` の中も)・`bash -c` の引数・`eval`・シェルに渡す heredoc の本文・引用符の無い区切りの heredoc の中の置き換え
   - 外への送信・履歴を壊す git・秘密の表示は止めも許可もしない(普段どおり聞かれる)。`permissions.deny` には書かない(止めはここ 1 か所)
0. **1 回分の許可の道**(固定の止めより前、印は要らない): Bash の 1 つのコマンドが危険な種類の入口の形と同じで方針が manual でそのスイッチの許可がある、か、manual の通常の種類の `devcheck run <種類> … --manual-go` でそのスイッチの許可がある → allow して許可を消す(上の「1 回分の許可」)。許可のあるスイッチの `pnpm workflow devcheck danger <スイッチ名>`(読むだけ)も印なしで通す(許可は使わない)
2. **allow**: 手元の印 `DEVCHECK_GRANT=on`(`.claude/settings.local.json` の env。整えるスキルが書く)があり、その種類の方針が `off` でなく、許可してよい形の時だけ
   - 形はシェルの記号の無い 1 つのコマンドだけ(引用符の外の `; & | < > $ ( ) { } * ? # ! ~ [ ]`・`\`・改行は不可。`'…'` の中は文字、`"…"` の中は `$` と `` ` `` だけを見る)
   - `pnpm workflow devcheck plan|status [--json]`・`cleanup`・`danger <スイッチ名>`(種類の方針は見ない。全部の種類が `off`(`enabled: false` を含む)の時は通さない)/ `devcheck run <種類|fork の項目> […]`(その種類の方針が `auto` の時だけ。`manual` は印の道では通さず、1 回分の許可の道だけ)
   - 種類の命令: server = `pnpm workflow dev-tab run [start|status|stop] [--background] [--port <n>]` / login = `pnpm workflow dev-admin run [--check]` / test = `pnpm test …`(`--db` は除く)/ check = `pnpm check …`
   - db-write・db-delete は `devcheck run` だけ(生の `pnpm ops db inspect query` は返さない = 文の検査と片付けの記録を通す)
   - peer(フックだけの種類): `pnpm workflow peer send|reply|inbox|read|ack|who …`
   - browser: `browser_navigate` は dev-tab の記録(`.agent/dev-tab.json` の port)の `http://localhost|127.0.0.1:<port>` だけ。ほかの道具は、フックが最後に見た遷移先(`.agent/devcheck-browser.json`、遷移のたびに書く)がその origin の間だけ。`browser_run_code_unsafe`・`browser_evaluate`・`browser_file_upload`・`browser_install` は返さない。`browser_navigate_back`・`browser_tabs` は返さず、最後の遷移先を消す
   - 限界: クリックでページが外へ移ったことはフックには見えない。次の遷移まで操作は通る。遷移は `browser_navigate` で行う
3. **それ以外は何も返さない**(= 普段どおり聞かれる)。方針 `off` も deny にしない。壊れた時(入力が JSON でない・方針や上書きが読めない・記録が読めない・例外)も何も出さず exit 0(止めだけは方針に依らず効く)

- 効き方(実測、Claude Code v2.1.322): allow は default / acceptEdits のどのモードでも確認を省き、サブエージェントにも効く。`permissions.deny` はフックの allow に勝つ。フックの deny は allow の行と bypassPermissions に勝つ。手元の env は書き換えた次の呼び出しから効く
- 入力の形: `adaptClaude`(Claude Code の PreToolUse の入力 → `{ tool, command | file | url }`)。ほかのエージェントの形は変換を 1 つ足す
- 明示の指示で止めを任せる形(後で)は、`fixedStop` が deny を返す前に見る

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
- allow: 0 = 書いた / 2 = 知らないスイッチ名 / 4 = 方針で断った(off・auto)| danger: 0 = 打つ命令を出した / 2 = 危険な種類でない / 4 = 打てない
- run: 打ったコマンドのもの(server の 3 = dev-tab の「この道具の外で開発サーバーが動いている」)/ 1 = 失敗・使い方 / 2 = 方針・項目・文脈が読めない・断った文 / 4 = 方針で断った / 5 = サーバーの上限で待ちきれない
- cleanup: 0 = 片付けた(片付けるもの無しも)/ 1 = 残った物がある

## ファイル

- `lib.kinds.mjs`(種類・スイッチ名・方針の実体、素の ESM)・`lib.allow.mjs`(1 回分の許可の記録と allow / danger の本体)・`lib.grant.mjs`(許可の判定)・`hook.mjs`(PreToolUse のフック、`prompt` = UserPromptSubmit で許可を消す)・`lib.ts`(型を付けた出し直し・項目・文脈・計画)・`lib.run.ts`(実行の部品)・`lib.exec.ts`(run / cleanup の本体、外に触る物は Deps で受ける)・`lib.facts.ts`(環境に触る部品)
- 動作 `plan.ts`・`status.ts`・`run.ts`・`cleanup.ts`
- テスト: `pnpm test scripts/workflow/devcheck`(DB・サーバーには触れない。打つはずのコマンドを偽の実行役で確かめる。許可の判定の表は `devcheck.grant.test.mjs`)
