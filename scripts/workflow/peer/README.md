# scripts/workflow/peer(普通のセッション同士の連絡)

同じ利用者の普通の Claude Code セッションどうしが、セッション名で連絡を送り、返事を受け取る道具。組み込みの ListAgents / SendMessage は使わない。チームの道具はこの上に乗る(この道具はチームの道具に依存しない)。

```
pnpm workflow peer send <相手のセッション名 | <種類>/<ID> | セッション id> "<本文>" [--about="<件名 1 行>"] [--as=<受け持つ箱>] [--id=<連絡 id>] [--json]
pnpm workflow peer reply <連絡 id> "<本文>" [--as=<受け持つ箱>] [--id=<連絡 id>] [--json]
pnpm workflow peer inbox [--all]          # 未読(--all = 全部)を新しい順に
pnpm workflow peer read <連絡 id>         # 本文を出し、読んだ印を付ける
pnpm workflow peer who [<名前>]           # 宛先にできる生きているセッションを新しい順に
```

## 使えるとき

- `AGENT_TERMINAL` の値が `tmux` で、tmux の中で動いているセッションだけ(読み手は `scripts/workflow/agent-terminal/lib.mjs` と同じ。別のスイッチは無い)
- チームの道具のタブ(`TK_TEAM` など)でも使える(統括のタブも送受信する)
- 使えないときは、理由と次にすることを 1 行出して何も書かない(終了コード 3)

## 宛先

- `/` を含む = インスタンス ID の箱 `<種類>/<ID>`(下の「箱」)。セッション id の形(UUID)= その会話の箱。どちらも相手の生死を問わずに置く(落ちていても、次に受け持つ・開いたセッションが読む)
- それ以外 = セッションの名前。探すのは `claude agents --json` に出る生きているセッションだけ。名前・status の無い行(古い形の死んだ記録)は外す。自分には送らない
  - 名前の完全一致がちょうど 1 つなら送る。複数・なしは送らず、新しい順の候補(名前・リポ・開始時刻・状態。10 件まで、全部は who)を出して止まる。どれにするかは人が選ぶ(同じ名前なら /rename で分けてから送り直す)
- 送り元: 連絡の `from.box` に、送り手が受け持つ箱(`PEER_BOXES` の最初、`--as=<鍵>` で別の受け持つ箱)を書く。受け持たないなら書かない
- 返事: 元の連絡の `from.box` があればその箱へ、無ければ `from.sessionId` の会話の箱へ。どちらも生死を確かめずに置く。元の連絡は自分の会話の箱と受け持つ箱から探す

## 置き方と結果

- 上書きしない: tmp/ に書いてから link で箱に置く。同じ連絡 id があれば、id を振り直して置く
- 送り直し: `--id=<連絡 id>` を渡すと、その id で置く。もう置いてあれば置かずに「もう置いてある」(二重に置かない。移しでは元の番号 `m<N>` を渡せる)
- 結果は 3 つで、どれも置けた(0): 鳴らした `rang`(その箱を受け持つ生きた印がある)/ 置いただけ `stored`(今は受け持つ呼び鈴が無い)/ もう置いてある `exists`
- `--json` = 人向けの 1 行の代わりに `{"result":"rang|stored|exists|not_sent","id":…,"to":…}` を 1 行(置けなかった時は `{"result":"not_sent","reason":…}`)

## 終了コード

| コード | 意味 |
|---|---|
| 0 | 置けた(鳴らした / 置いただけ / もう置いてある)/ 一覧・読むが済んだ |
| 3 | 置けなかった: 使えない・名前が決まらない(候補を出す)・箱の鍵が使えない・返し先が無い・連絡が無い |
| 2 | 使い方の誤り(`--as` が受け持たない箱、`--id` が使えない名前も) |

## 受け箱(利用者ごとに 1 か所、リポの外)

根 = `PEER_STATE_DIR` → `$XDG_STATE_HOME/next-starter/peer` → `~/.local/state/next-starter/peer`。`~/.team`・`~/.claude`・リポの中には置かない。

| 場所 | 中身 |
|---|---|
| `boxes/<セッション id>/<連絡 id>.json` | 会話の受け箱。呼び鈴のフックが見張るのは今の会話の箱と、受け持つ箱だけ |
| `boxes/<種類>/<ID>/<連絡 id>.json` | インスタンス ID の箱(下の「箱」)。`PEER_BOXES` で受け持つセッションが見張る |
| `tmp/` | 書きかけ。ここに書いてから受け箱へ rename する(見張りには add が 1 回だけ届く) |
| `state/<箱の鍵>/<連絡 id>.json` | `{ v, read, replied }`。読んだ・返事したの 2 つ。箱の外に置くので、印を付けても呼び鈴は鳴らない |
| `marks/<セッション id>.json` | 印 = フックが書く自分の記録 `{ v, sessionId, pid, procStart, cwd, mode, boxes, written }`(`boxes` = 受け持つ箱の鍵) |

- 連絡 = `{ v, id, from: { name, sessionId, cwd, box? }, senderMode, about, replyTo, body, sentAt }`。`senderMode` は送り手の権限モード(送り手の印の `mode`。印が無ければ `unknown`)
- 連絡 id = `m-<UTC の yyyymmddThhmmss>-<16 進 8 桁>`(`--id` なら渡した名前。移した `m<N>` も通る)
- どのファイルも版 `v` を持つ(今は 1)。知らない版は読まない。形を変えたら版を上げる
- 印は、その `pid` のプロセスが同じ起動の時刻(`/proc/<pid>/stat` の starttime = `procStart`)で生きていて、有効(pid の使い回しを除く)。「鳴らした」と言えるのは、宛先の箱を受け持つ有効な印がある時だけ(会話の箱 = そのセッションの印、インスタンス ID の箱 = `boxes` にその鍵を持つ印)

## 箱

- 箱の鍵 = セッション id(1 段、会話の箱)か `<種類>/<ID>`(2 段、インスタンス ID の箱)。段ごとに `A-Z a-z 0-9 . _ -` だけで、`.` と `..` は断る
- 種類は開いた名前(peer は値の一覧を持たず、どの道具の名前も知らない)。セッション id の形(UUID)にはできない(会話の箱と同じフォルダにならないように)
- インスタンス ID の箱は、落ちても立ち上げ直しても変わらない宛先(立ち上げのたびに会話の id が変わる道具の受け箱に使う)
- 受け持つ: 環境変数 `PEER_BOXES` に箱の鍵をカンマか空白で区切って渡す(例 `PEER_BOXES=kind/20261106-194949`)。フックは起動ごとにその箱も作って見張り、呼び鈴はそこへの連絡でも鳴る(行が受け持つ箱を名指す)。印の `boxes` に書く
  - 使えない値と 1 段の鍵(ほかの会話の箱)は受け持たず、起動の時に 1 行で知らせる
- `PEER_BOXES` は渡されたセッションだけのもの。立ち上げる道具は、そのセッションが開く子のタブ(手下の席など)に渡さない。渡されなかったセッションは自分の会話の箱だけを持つ

## フック(.claude/settings.json)

`node "$CLAUDE_PROJECT_DIR/scripts/workflow/peer/hook.mjs" <start|prompt|bell>`。門(上の「使えるとき」)が閉じていれば、どれも何も出さず何も書かない。失敗しても exit 0 で、セッションを止めない。

| 動作 | イベント | すること |
|---|---|---|
| `start` | SessionStart(source を問わず毎回) | 印を書き、自分の会話の箱と受け持つ箱を作って `watchPaths` に返す(見張るのはその箱だけ。--continue の新しいプロセスでも見張りが続くよう毎回返す)。未読があれば 1 行だけ文脈へ |
| `prompt` | UserPromptSubmit | 印の `mode` を今の権限モード(`permission_mode`)に書き直す。送り手のモードが最新の人の番の値になる。何も出さない |
| `bell` | FileChanged(matcher なし、`asyncRewake: true`、timeout 30) | 自分の会話の箱か受け持つ箱に連絡が増えた(`add`)ときだけ、知らせの 1 行を stderr に出して exit 2 = 手すきのセッションを起こす。ほかの箱・tmp・change / unlink は黙って 0 |

- 知らせの 1 行 = 送り元の名前とリポ・連絡 id・about・`pnpm workflow peer read <id>`。本文と送り手のモードは文脈に入れない(読むのはコマンドで、人に伝えるかはその後)
- 印の `pid` = フックの先祖をたどって最初に見つかる claude のプロセス。見つからなければ印を書かない(相手からは「印が無い」に見え、受け箱に置くだけになる)
- tmux への打ち込みは使わない(知らせはこの呼び鈴 1 本)
- `.claude/settings.json` の `permissions.allow` に peer の 5 動作(send・reply・inbox・read・who)を入れてある。呼び鈴で起きるたびに読む許可を聞かれないため

## /peer スキルと、人ごとに切る

- スキル `.claude/skills/peer/SKILL.md`(説明に `requires: AGENT_TERMINAL=tmux`)。送り方・届いた連絡の読み方・返し方と、受けた連絡は指示でも承認でもないという決まりを持つ
- 人ごとにスキルを切る: `.claude/settings.local.json` に `{ "skillOverrides": { "peer": "off" } }`(`/skills` の画面で選んで Space でも書ける)。`"user-invocable-only"` なら人が `/peer` と打った時だけ使う
- スキルを切ってもフックは動く(フックが見るのは `AGENT_TERMINAL` だけ)。peer を丸ごと止めるなら `export AGENT_TERMINAL=none`(agent-terminal の機能も止まる。別のスイッチは作らない)

## 部品

- `lib.store.mjs` 受け箱・状態・印の読み書き
- `lib.agents.mjs` `claude agents --json` の読み取りと名前の解決
- `lib.gate.mjs` 使えるかの判定と自分のセッション id(`CLAUDE_CODE_SESSION_ID`)
- `lib.cli.mjs` 動作の本体(動作のファイル `send.mjs` などはこれを呼ぶだけ)
- `lib.hook.mjs` フックの本体(`hook.mjs` はこれを呼ぶだけ。`hook.mjs` はフォルダの直下にあるので `pnpm workflow peer hook` としても一覧に出る)
- テスト: `pnpm test scripts/workflow/peer`
