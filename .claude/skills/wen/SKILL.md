---
name: wen
description: 下流(fork)で「出した依頼、もう終わった…?(wen?)」を確認する。自分が /upreq で上流(宛先はどの Tier でも)に出した依頼の状況(未対応/解決済/上へ回された)を追跡し、解決済は中身(RESOLUTION)まで即提示
argument-hint: "[request id / ファイル名 | all(全履歴) | 省略で未解決+直近解決の中身まで]"
---

あなたは今 **下流(fork)** として、自分が `/upreq` で上流に出した依頼が**もう終わったか(wen…?)**を確認します。

メールボックス: `~/.team/upstream-requests/`(共有フォルダ。構成の説明は `.claude/skills/upreq/SKILL.md`)
- 依頼は宛先リポの受信箱 `<fork-id>/` にあり、対応済みは `<fork-id>/done/` に移る。旧形式(直下の `*.md` と `done/`)も対象
- 「自分の依頼」= `from:` がこのリポの origin で始まるもの。上へ回された依頼も `from:` は元のまま
- 抽出は補助スクリプトで行う(リポのルートで実行): `node .claude/skills/upreq/mailbox.mjs mine`(未対応すべて + 7 日以内に対応済みになったもの)| `mine --all`(全履歴)
  - 出力は 1 件ごとに `open|done <path>` と from / to / need の行

対象指定(以下「引数」): $ARGUMENTS

## 引数が空のとき(既定: 未解決の一覧 + 直近解決分は中身まで即提示)
1. `node .claude/skills/upreq/mailbox.mjs mine` を実行する。
2. **未解決**(`open`): **id / 宛先(to) / need 要約 / 状態=まだ…** で一覧表示。本文 Read は不要。
3. **直近解決分**(`done`): **本文を Read し、その場で中身を提示する**(`/wen <id>` への誘導で済ませない。これがこのコマンドの主目的)。各チケットについて:
   - **RESOLUTION を要約**(implemented / consume / pushed)。
   - `status: relayed` = 宛先リポがさらに上流へ回した。`relayed_to:` の先を伝え、その新しい依頼の状況(同じ出力に open / done で出ている)を合わせて示す。
   - `status: rejected` = 差し戻し。`notes:` の理由と、自リポでどう持つかを示す。
   - **このコマンドが打たれた時点で upstream の merge は完了済みとみなす**。merge 状態の確認(git fetch / git log / branch --contains 等)や「merge してください」という案内は**行わない**。
   - merge 済み前提で「**この置き場の API をこう使う**」と、downstream 側での使い方を具体的に示す。
   - 例外: `pushed: no` の場合のみ「上流側がまだ push していないため、手元に入っていない可能性が高い」と注意喚起する。
   - 宛先が直上でない(祖父以上の)依頼は、間の Tier が取り込むまで自リポに届かない。`/flux status --chain` で確かめられることを添える。
4. 両方 0 件なら「未解決の依頼はありません(過去の全履歴は `/wen all`)」の一行で終える。
5. 他 fork の依頼・件数統計は混ぜない。

## 引数が `all` のとき(全履歴一覧)
`node .claude/skills/upreq/mailbox.mjs mine --all` を実行し、**id / 宛先 / need / 状態(open=まだ… / done=来た!)** を一覧表示。このモードでは本文 Read はしない(中身は id 指定で)。

## 引数が id/ファイル名を指すとき(詳細)
1. `mine --all` の出力から該当チケットを特定し、全文読む。
2. 日本語で状況を提示:
   - open の場合: まだ宛先リポで未対応である旨(まだ wen…)と宛先。
   - done の場合: 既定モードの手順 3 と同じ形式で RESOLUTION 要約 + 使い方を提示。

## 言語ルール
- ユーザーとの会話は日本語。
