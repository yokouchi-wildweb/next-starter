# scripts/workflow/peer(普通のセッション同士の連絡)

同じ利用者の普通の Claude Code セッションどうしが、セッション名で連絡を送り、返事を受け取る道具。組み込みの ListAgents / SendMessage は使わない。チームの道具はこの上に乗る(この道具はチームの道具に依存しない)。

```
pnpm workflow peer send <相手のセッション名> "<本文>" [--about="<件名 1 行>"]
pnpm workflow peer reply <連絡 id> "<本文>"
pnpm workflow peer inbox [--all]          # 未読(--all = 全部)を新しい順に
pnpm workflow peer read <連絡 id>         # 本文を出し、読んだ印を付ける
pnpm workflow peer who [<名前>]           # 宛先にできる生きているセッションを新しい順に
```

## 使えるとき

- `AGENT_TERMINAL` の値が `tmux` で、tmux の中で動いているセッションだけ(読み手は `scripts/workflow/agent-terminal/lib.mjs` と同じ。別のスイッチは無い)
- チームの道具のタブ(`TK_TEAM` など)では使わない。連絡はそのチームの道具が受け持つ
- 使えないときは、理由と次にすることを 1 行出して何も書かない(終了コード 3)

## 宛先

- 探すのは `claude agents --json` に出る生きているセッションだけ。名前・status の無い行(古い形の死んだ記録)は外す。自分には送らない
- 名前の完全一致がちょうど 1 つなら送る。複数・なしは送らず、新しい順の候補(名前・リポ・開始時刻・状態。10 件まで、全部は who)を出して止まる。どれにするかは人が選ぶ(同じ名前なら /rename で分けてから送り直す)
- 返事は送り元のセッション id へ。送る前に、そのセッションが今も生きているかを確かめる

## 終了コード

| コード | 意味 |
|---|---|
| 0 | 送った(相手は呼び鈴で起きる)/ 一覧・読むが済んだ |
| 3 | 送らなかった: 使えない・宛先が決まらない・相手がもういない・相手に印が無く受け箱に置いただけ・連絡が無い |
| 2 | 使い方の誤り |

## 受け箱(利用者ごとに 1 か所、リポの外)

根 = `PEER_STATE_DIR` → `$XDG_STATE_HOME/next-starter/peer` → `~/.local/state/next-starter/peer`。`~/.team`・`~/.claude`・リポの中には置かない。

| 場所 | 中身 |
|---|---|
| `boxes/<セッション id>/<連絡 id>.json` | 受け箱。呼び鈴のフックが見張るのは今の会話の箱だけ |
| `tmp/` | 書きかけ。ここに書いてから受け箱へ rename する(見張りには add が 1 回だけ届く) |
| `state/<セッション id>/<連絡 id>.json` | `{ v, read, replied }`。読んだ・返事したの 2 つ。箱の外に置くので、印を付けても呼び鈴は鳴らない |
| `marks/<セッション id>.json` | 印 = フックが書く自分の記録 `{ v, sessionId, pid, procStart, cwd, mode, written }` |

- 連絡 = `{ v, id, from: { name, sessionId, cwd }, senderMode, about, replyTo, body, sentAt }`。`senderMode` は送り手の権限モード(送り手の印の `mode`。印が無ければ `unknown`)
- 連絡 id = `m-<UTC の yyyymmddThhmmss>-<16 進 4 桁>`。名前の順が送った順
- どのファイルも版 `v` を持つ(今は 1)。知らない版は読まない。形を変えたら版を上げる
- 印は、その `pid` のプロセスが同じ起動の時刻(`/proc/<pid>/stat` の starttime = `procStart`)で生きていて、`claude agents --json` の行の pid とも合う時だけ有効(pid の使い回しを除く)。印の無い相手には受け箱に置くだけにして、送り手にそう返す

## 部品

- `lib.store.mjs` 受け箱・状態・印の読み書き
- `lib.agents.mjs` `claude agents --json` の読み取りと名前の解決
- `lib.gate.mjs` 使えるかの判定と自分のセッション id(`CLAUDE_CODE_SESSION_ID`)
- `lib.cli.mjs` 動作の本体(動作のファイル `send.mjs` などはこれを呼ぶだけ)
- テスト: `pnpm test scripts/workflow/peer`
