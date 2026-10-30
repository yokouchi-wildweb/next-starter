---
name: inbox
description: 自リポ宛てに届いた単発の指令(/order・評議会の legate から。自分宛ても含む)を一覧・読込・対応する。自リポの役目に照らして受理を判断し、他のリポの作業が要るものは中継する
argument-hint: "[指令の id / ファイル名 (省略で一覧)]"
---

あなたは今、自リポ宛てに届いた **ORDER**（`/order` で起票された単発の指令。評議会の legate が出したものも同じ形）を捌きます。誰から来たかは指令書の `from:` の先頭で分かる（リポ = origin URL、自リポ = 自分宛ての予約、チームの役職 = `<team> <instance> | role:<役職名> | repo:…`（fleet の提督・guild のアーキテクトなど。発行元はそのチームで、repo: は動いていたリポ）、評議会 = `council <議題id>`。書き方は `.claude/skills/order/SKILL.md` 手順 3）。どの指令も、自リポの役目に照らして受理するかを考えてから動く。

メールボックス: `~/.team/orders/`（共有フォルダ。実際の場所は `mailbox.mjs self` の `root:`。git 管理外。構成の説明は `.claude/skills/order/SKILL.md`）
- **自リポの受信箱** = `<置き場>/<自リポの fork-id>/`（fork-id = `.claude/rules/project.md` の `fork_id:`）。場所と中身は `node .claude/skills/order/mailbox.mjs inbox`（リポのルートで実行）で取得する。他のリポの受信箱は読まない
- 未対応 = 受信箱直下の `*.md` | 対応済み = 受信箱の `done/` に移動
- 未対応のうち `waiting_on:` 行がある指令 = 自リポが別のリポに依頼して結果を待っているもの（下記「中継」の依頼して待つ）。mailbox.mjs は待ちの先が開いていれば `waiting`、すべて対応済みなら `resumable` と出す
- 指令の `to:` が自リポでない（宛先違いで入った）ときは、着手せず下記「中継 / 差し戻す / 取り下げる」に従う
- **評議会からの指令** = `from: council <議題id> | legate:l<k> order:NN` の指令。評議会の legate（評議会の中で進む、指令を 1 件ずつ出して検証する仕組み）のうち、自リポでの作業が要る 1 歩。本文の `order:` に評議会の指令がそのまま入っている。扱いは通常の指令と同じで、違いは下の対応モードの各所に書く（境界で止まる・`output:`・RESOLUTION の findings / verify）。評議会は、この指令が `done/` に移ったのを見て RESOLUTION を取り込み、自分で検証する。legate の目次やフォルダは評議会のもので、このセッションは触らない

対象指定: $ARGUMENTS

## $ARGUMENTS が空のとき（一覧モード）
0. 自リポが Tier1(`src/lib/CATALOG.md` の先頭の節の持ち主)なら、`pnpm -s ownership:check` の 1 行目(upstream の負債の行の数)を一覧の先頭に 1 行で添える(負債 = upstream が core の中の編集を下流に案内している箇所。受け口づくりの指令が受信箱にある。src/lib/forkOwnership/README.md「受け口の一覧」)。Tier1 でなければ何もしない
1. `node .claude/skills/order/mailbox.mjs inbox` で、自リポ宛ての未対応（`open` / `waiting` / `resumable`）を取得する。
2. 指令は出力の `need:`・`from:` を使い、**1行サマリ（id / need / from）**を日本語で一覧表示（from がリポで自リポなら「自分宛て」、チームの役職なら「fleet の提督から」のようにチームと役職名を書く。mailbox.mjs の一覧はチームの指令を `from: <team> <instance> <役職名>` と出す。リポで動いていても自分宛てとは書かない）。`waiting` は「待ち（<待っている先>）」、`resumable` は「再開可」と添える。依頼元が自リポ以外のリポ（下流の fork）なら「下流の一時許可の元かもしれない → 出荷は resolves: 付き」と添える（`.notices/README.md`「解決(resolves)」。対応完了の /ship に `order:<id>` を必ず渡す）。
3. 件数で分岐（`waiting` は数えない）:
   - 0件: 「未対応の依頼はありません」と伝える。
   - **1件: 「どれに着手しますか？」とは聞かず、そのままその指令の対応モード（下記 1〜3）に進む**（全文読込 → 要約 → 実装方針提案まで。実装はしない）。
   - 2件以上: 「どれに着手しますか？」と尋ねる。

## $ARGUMENTS が id/ファイル名を指すとき（対応モード）
1. その依頼ファイルを全文読む。
2. **日本語で要約**（need / why / done_when / constraints）。`resumable` の指令は、`waiting_on:` の先（`done/` に移ったファイル）の RESOLUTION も読んで要約に入れる。評議会からの指令は `order:` の本文（この歩がする決定事項・完了の条件・「まだやらないこと」）も要約に入れる。
3. **このリポとしての実装方針を提案**（CODE_PLACEMENT に沿った置き場、汎用化の観点、API設計）。
   - **まず自リポの役目に照らして受理を判断し、冒頭で判定を明示する**（評議会からの指令も同じ。ただし下の注意）: 自リポの project.md（役目・TIER・分担）と CLAUDE.md を読み、受理 / 修正受理 / 中継（引き渡し | 依頼して待つ）/ 差し戻し / 取り下げ のどれかにする。自分宛ての指令も同じように判断する（書いた後に不要・古くなっていれば取り下げ）。基準:
     - ① 自リポの持ち物か: 自リポ以外の作業が前提になる、または別のリポに引き継いだ方がよい → 中継（上流・下流・兄弟を問わない）。依頼元で持つべき → 差し戻し。手順は下記「中継 / 差し戻す / 取り下げる」
     - ② 自リポの役目・方針に反しないか
     - ③ 自リポに下流 fork がいるとき: 全 fork の自由度を狭めないか（データ・ロジック・セキュリティ境界は上流、画面・文言・デザインは downstream）、breaking なしで引き返せるか。ドメイン画面の UI 部品を求められても core には入れず、データレイヤー + README レシピで返す（CLAUDE.md core_domain_ui_boundary）
     - 依頼元が書いた API 案や実装案は仕様ではなく批評対象の提案
   - **自リポに下流 fork がいるとき（project.md の TIER 節）は、downstream 取り込み判定（見込み）を方針の冒頭に 1 行で示す**: `取り込み判定（見込み）: 安全 | 要注意（理由）| 危険（理由）`。危険 = そのまま merge すると fork のビルド・起動・既存動作が壊れる / fork 側の手作業（db:push・env・外部リソース準備など）が要る / 挙動・権限が黙って変わる。要注意 = merge の衝突が起きうる程度。`output: commit` で保留する歩は「出荷時に fork が受け取る場合」で判定する。下流がいなければ省く
   - **診断は再現してから**: 症状は信じてよいが、「原因は X」という主張は自分で最小再現するまで事実扱いしない（例: ルーティング欠落の主張は未認証 `curl -i` で確かめる。401/JSON = 到達、404 text/html = 本物の欠落。サーバー起動が要る確認はユーザーに curl を提示して結果をもらう）。前提が固まるまでスコープを広げない
   - **downstream 追従を判定する**（自リポに下流 fork がいるときだけ）: この対応で fork の既存コードが upstream 仕様とずれる（構造・ジェネレーター・規約・API の変更など）なら、fork の既存コードを新仕様へ揃える移行手順を `.notices/` で実装と同じコミットに出す前提で方針に含める。互換を残して放置させず、乖離のないクリーンな状態を優先する。notice には変更点と、fork 側で対象コードを探せる目印（grep パターン等）を書く。不要ならその理由を一言添える
   - **評議会からの指令**は評議会で結論済みの内容なので、判定は実装の妥当性に絞る。結論そのものに穴が見つかったら、勝手に設計し直さず「差し戻し（要再審議）」として理由を示す。加えて**指令の境界（「まだやらないこと」）で止まる**。範囲外で見つけた問題は直さず、完了時の RESOLUTION `findings:` に書く（評議会が次の指令を決める材料になる）。完了条件をどう確かめるか（実行するコマンド・テスト）も方針に含める。
   - **まだ実装しない**。ユーザーの承認を待つ。
   - チームセッション内（あなたが orchestrator）なら、この依頼を plan.md / handoff に落として通常のチーム手順に乗せる。
4. ユーザーが「対応完了」と言ったら（**完了報告とコミット&プッシュは必ずセットで実行する**。「対応完了」がコミット/プッシュへの明示的な指示を兼ねる。**以下 a〜d は途中でユーザーへの確認・質問・AskUserQuestion を一切挟まず連続実行する** — 「対応完了」が唯一かつ十分な承認であり、追加の承認待ちは禁止）:
   a. **`/ship` で出荷する**（RESOLUTION を出す前に実体を確定させ、commit sha を正確にするため）: `.claude/skills/ship/SKILL.md` の手順を引数 `order:<指令の id>` で行う（範囲の確定・検査・notice の判定と合成・コミット・push。止まるのは /ship の「止まるとき」に当たったときだけ）。方針で notice を出すと決めた対応では、/ship の判定もそれに合わせる。
      - 確認・調査だけで差分の無い指令は /ship を使わず commit を作らない（RESOLUTION は `commit:- | pushed:-`）。
      - 下流の fork から来た依頼を却下（rejected）するときは、RESOLUTION の notes に依頼元が一時許可をどうするか（元に戻す・受け口へ移す・別の方針で許可し直す）を書く（依頼元の /wen permits がそれを示す）。差分の無い解決でも、依頼元が下流の fork なら /ship の判定に従い resolves: の notice を出す
      - 既にチーム手順内でコミット済みなら新規コミットは作らず、現在の HEAD をそのまま使う。
      - ブランチはチーム/通常フローに従う（既にフィーチャーブランチ上ならそのまま。チームセッションなら orchestrator のブランチ方針に従う）。
      - **評議会からの指令に `output:` があるときは、それに従う**（指令の宣言が push についての明示的な指示になる）: `push` = 上のとおり | `commit` = **push しない**（/ship を `no-push` で）。指令の `held:` が名指すブランチに積み、作業の前に `git switch <branch>`（無ければ `git switch -c <branch> <指令の base:>`）、commit してから `git switch <main>` で main に戻る（`pushed: no (held)`）| `none` = commit しない（観測・計測の結果を RESOLUTION に書くだけ。`commit:-`）。
      - /ship の後、short sha を `git rev-parse --short HEAD`、branch を `git rev-parse --abbrev-ref HEAD` で取る。push できなかったら RESOLUTION の `pushed:` に正直に反映する（取り繕わない）。
   b. **RESOLUTION の本文**を一時ファイルに書く（リポの中には置かない。例: `mktemp`）。依頼元が `/wen` で消費する。英語・構造化。`resolved:` と `by:` の行は c のコマンドが書くので、本文には入れない:
      ```
      implemented: <what was actually done>
      consume: <how the requester uses it: path + API | ->>
      propagate: <how it reaches the requester | ->
      notice: <.notices/<id>.md — apply with /flux | ->
      notes: <anything the requester needs>
      ```
      - `propagate:` の書き方（依頼元のリポ = from: の先頭、チームの役職からの指令なら `repo:`）: 依頼元が自リポの下流 fork = `pushed to origin — fetch & merge upstream into your fork to receive it` | 自分宛て = `-` | それ以外 = 依頼元への届き方（依頼元に影響が無ければ `-`）
      **評議会からの指令のときは**、`status:` を `done | partial`（partial = 指令の一部で止めた。理由を findings に書く）とし、`notes:` の後に次の2行を必ず足す（評議会の検証の主な材料。日本語可）:
      ```
      findings: <作業中に見つけた問題・指令とのずれ・範囲外として残したこと・未確認の点 | none>
      verify: <指令の done_when をどう満たしたか: 実行したコマンド/テストとその結果。確かめていないことは「未確認」と書く>
      ```
   c. **答える**（RESOLUTION の追記と `done/` への移動を 1 回で行う。リポのルートで実行）:
      `node .claude/skills/order/mailbox.mjs resolve <該当ファイル> --status=done --pushed=<yes | no と理由 | -> --body=<b のファイル>`
      - `by:` の fork-id・url・branch・commit は実行したリポから取る（commit は a で確定した HEAD）。commit しなかった指令は `--commit=-`、別のリポで commit したときは `--commit=<sha と場所>` で渡す。評議会からの指令の一部で止めたときは `--status=partial`
      - 足りない行があれば何も書かずに止まる（エラーの指す行を本文に足して打ち直す）。書かれた形:
        ```
        ## RESOLUTION
        resolved: <ISO8601>   status: done
        by: <self fork-id> | <self repo url> | branch:<branch> | commit:<short sha or -> | pushed:<yes|no|->
        implemented: … （本文がそのまま続く）
        ```
   d. 日本語で報告（**冒頭に downstream 取り込み判定（実測）を 1 行**: 見込みと同じ書式で、実際の差分から判定し直す。見込みから変わったら理由を添える）: コミット sha / プッシュ先ブランチ / RESOLUTION 追記済み・done/ 移動済みであることを伝える。push できなかった場合はその旨も明示する。評議会からの指令のときは findings の要点、`output: commit` なら保留中のブランチ名（push していないこと）と、「評議会の議長タブで `check` と打つと結果を取り込んで検証します（議長タブを閉じていれば別ターミナルで `council <議題id>` を実行して再開し、`check`）」と伝え、次の歩を自分で先取りしない。

## 中継 / 差し戻す / 取り下げる（通常の指令のみ。ユーザーが提案を承認したら、確認を挟まず続けて行う）
- **中継する場面**: 自リポ以外の作業が前提になる、または別のリポに引き継いだ方がよい（上流・下流・兄弟を問わない）。宛先は、自リポの役目と相手の役目（`node .claude/skills/order/mailbox.mjs repos` の `rules:` の project.md）から自分で決める
- **どちらで中継するか**（提案のときに、どちらかと理由を添える）: 元の指令の `done_when` を中継先の作業だけで満たせる → **引き渡し** | 中継先の結果を受けて自リポにも続きの作業がある → **依頼して待つ**
- **引き渡し**（元の指令を閉じる）:
  a. 元の指令をもとに、新しい指令を宛先の受信箱に書く: 新しい id（`date +%Y%m%d-%H%M%S`）、`from:` は元の依頼元のまま、`to:` は宛先に合わせて書き直し、`relayed_from: <元の id> | via:<自リポの fork-id>` の行を `to:` の次に足す。他の欄は元のまま（自リポで分かったことは `notes:` に足す）。
  b. 元の指令に答える: 本文（`relayed_to: <宛先の fork-id>/<新しい id>.md` と `notes: <なぜ宛先の持ち物と判断したか>`）を一時ファイルに書き、`node .claude/skills/order/mailbox.mjs resolve <元の指令> --status=relayed --body=<ファイル>`（`by: <self fork-id> | commit:- | pushed:-` を書いて `done/` へ移す）
  c. 日本語で報告: 引き渡した先と新しい指令のパス。
- **依頼して待つ**（元の指令は開いたまま）:
  a. `.claude/skills/order/SKILL.md` の手順で、宛先の受信箱に新しい指令を書く。`from:` は `mailbox.mjs from` の値（自リポ。チームのタブならそのチーム）、`need:` は宛先にやってほしい部分だけ、`refs:` に元の指令のパスを入れる。
  b. 元の指令の末尾に `waiting_on: <新しい指令のフルパス>` を 1 行足す。待つ先が複数なら行を増やす。元の指令は受信箱に残す（`done/` に移さない）。
  c. 日本語で報告: 依頼した先と新しい指令のパス、元の指令は待ちとして一覧に出ること。待つ先がすべて対応済みになると、一覧で「再開可」になる。
  d. 再開するときは対応モードで、`waiting_on:` の先の RESOLUTION を読んでから方針を出す。中継先が差し戻した・取り下げたときは、元の指令をどうするか（別の宛先に頼む・自リポでやる・差し戻す）を提案し直す。
- **差し戻す**（依頼元で持つべき、または指令として成り立たない）: 本文 `notes: <理由と依頼元でどう持てばよいか>` で `node .claude/skills/order/mailbox.mjs resolve <元の指令> --status=rejected --body=<ファイル>`。commit は作らない。
- **取り下げる**（不要・古くなった。自分宛ての予定に多い）: 本文 `notes: <理由>` で `node .claude/skills/order/mailbox.mjs resolve <元の指令> --status=withdrawn --body=<ファイル>`。commit は作らない。

## 言語ルール
- ユーザーとの会話は日本語。
