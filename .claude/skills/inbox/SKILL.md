---
name: inbox
description: 自リポ宛てに届いた単発の指令(/order・/upreq。自分宛ても含む)と評議会の束を一覧・読込・対応する。自リポの役目に照らして受理を判断し、他のリポの作業が要るものは中継する
argument-hint: "[指令の id / ファイル名 (省略で一覧)]"
---

あなたは今、自リポ宛てに届いた **ORDER**（`/order`・`/upreq` で起票された単発の指令）と評議会の束を捌きます。誰から来たかは指令書の `from:` で分かる（リポ = origin URL、評議会 = `council <議題id>`、自リポ = 自分宛ての予約）。どの指令も、自リポの役目に照らして受理するかを考えてから動く。

メールボックス: `~/.team/orders/`（共有フォルダ。実際の場所は `mailbox.mjs self` の `root:`。git 管理外。構成の説明は `.claude/skills/order/SKILL.md`）
- **自リポの受信箱** = `<置き場>/<自リポの repo-id>/`。場所と中身は `node .claude/skills/order/mailbox.mjs inbox`（リポのルートで実行）で取得する。他のリポの受信箱は読まない
- 未対応 = 受信箱直下の `*.md` | 対応済み = 受信箱の `done/` に移動
- 未対応のうち `waiting_on:` 行がある指令 = 自リポが別のリポに依頼して結果を待っているもの（下記「中継」の依頼して待つ）。mailbox.mjs は待ちの先が開いていれば `waiting`、すべて対応済みなら `resumable` と出す
- 指令の `to:` が自リポでない（宛先違いで入った）ときは、着手せず下記「中継 / 差し戻す / 取り下げる」に従う
- **評議会の束** = 置き場の直下の `edict-*/`・`legate-*/` のうち、`00-index.md` の `project:` が自リポのパスのもの（mailbox.mjs が `council <path>` として出す。`project:` の無い古い束は最上流宛て）
- **評議会の発行束（edict）** = 直下の `edict-<議題id>.<k>/` フォルダ。評議会が報告書から発行した修正チケットの束で、`00-index.md`（目次: 各チケットの依存と状態）・`report.snapshot.md`（元の報告書）・`NN-<slug>.md`（チケット本体）を持つ。束の中は連続した一連の作業なので、**依存（`depends:`）の解けた順に1件ずつ**対応する。完了した束は `done/edict-<議題id>.<k>/` に移る。
- **評議会の特使（legate）** = 直下の `legate-<議題id>.<k>/` フォルダ。評議会が**指令を1件ずつ**出し、その実行者が対応した後、評議会が議長タブの `check` で検証してから次の指令を出す往復型。指令はそれぞれ `executor:`（実行者。省略 = inbox）・`where:`・`output:`（push | commit | none。省略 = push）・`done_when:` を宣言する。`00-index.md`（目次: state / mission / outlook / 指令ごとの状態と評議会の判定）・`report.snapshot.md`・`NN-<slug>.md`（指令本体）を持つ。このセッションが対応できるのは、**`## ORDERS` の `status:open` の行のうち `exec:` が inbox を含むもの（`exec:` の無い古い行は inbox 扱い）**だけ。human / research / watch の指令は評議会側で結果を記録する。`exec:envoy` の指令は評議会の実装役タブ（Envoy）が議長の合図で処理するので、このセッションでは着手しない（/inbox の legate モードは、Envoy を置かない legate — fork や外部が作業場所、人が自分のセッションで進めたい場合 — のための手段）。指令の実行手順の正本は `~/.team/_bin/council.d/execution.md`（Envoy と共通）で、下の手順と食い違ったら execution.md に従う。指令ファイルは対応後も同じフォルダに残し、フォルダの移動は評議会が行う。

対象指定: $ARGUMENTS

## $ARGUMENTS が空のとき（一覧モード）
1. `node .claude/skills/order/mailbox.mjs inbox` で、自リポ宛ての未対応（`open` / `waiting` / `resumable`）と評議会の束（`council`）を取得する。
2. 指令は出力の `need:`・`from:` を使い、**1行サマリ（id / need / from）**を日本語で一覧表示（from が自リポなら「自分宛て」と書く）。`waiting` は「待ち（<待っている先>）」、`resumable` は「再開可」と添える。発行束は各 `00-index.md` を読み、**束ごとに1行**（束名 / `summary:` / 完了数/件数 / 次に着手できるチケット番号）で、通常の依頼とは分けて表示する。`state:` が `drafting`（評議会が起草中）・`abandoned` の束は一覧から外す。
   - 次に着手できるチケット = `## TICKETS` の行のうち `status:open` で、`depends:` の番号がすべて `done`（または `withdrawn`）のもの。上から最初の1件。
   - 特使は各 `00-index.md` を読み、**特使ごとに1行**（フォルダ名 / `mission:` / 状態）で、さらに分けて表示する。状態 = `status:open` で `exec:` が inbox を含む（または `exec:` 無し）行がある → 「指令 NN 対応可」、`status:open` が inbox 以外だけ → 「<executor> の指令 NN 進行中（評議会側）」、`status:done` で `check:-` → 「評議会の検証待ち（議長タブで check）」、それ以外・`state: halted` → 「評議会の次の指令待ち」。`state:` が `drafting` の特使は外す。
3. 件数で分岐（`waiting` は数えない。発行束は1束 = 1件、特使は「指令 NN 対応可」のものだけを1件と数える）:
   - 0件: 「未対応の依頼はありません」と伝える。
   - **1件: 「どれに着手しますか？」とは聞かず、そのままそのチケットの対応モード（下記 1〜3）に進む**（全文読込 → 要約 → 実装方針提案まで。実装はしない）。
   - 2件以上: 「どれに着手しますか？」と尋ねる。

## $ARGUMENTS が id/ファイル名を指すとき（対応モード）
0. **発行束（edict）のとき**:
   - 束名（`edict-<議題id>.<k>`）を指したら: `00-index.md` を読み、次に着手できるチケット（一覧モードの定義）を対象にする。無ければ「着手できるチケットはありません（残り: <番号と、待っている依存>）」と伝えて終了。
   - 束の中のチケットを直接指したら: 目次でその行の `depends:` を確かめ、未完了の依存があれば「依存 <番号> が未完了のため着手不可」と伝えて終了。`withdrawn` のチケットにも着手しない。
   - 対象チケットに加え、`00-index.md`（束の全体像と自分の位置）を読む。根拠が要るときは `report.snapshot.md` や本文が挙げるファイルも読む。
0'. **特使（legate）のとき**（フォルダ名 `legate-<議題id>.<k>` か、その中の指令を指したら）:
   - `00-index.md` を読み、`## ORDERS` で `status:open` かつ `exec:` が inbox を含む（または `exec:` 無し）行があればその指令を対象にする。無ければ着手せず、一覧モードの状態（評議会の検証待ち / 次の指令待ち）をそのまま伝えて終了。過去の指令（done 済み）を指したときも着手しない。
   - 対象の指令に加え、`00-index.md`（mission / outlook / これまでの指令と判定 `## CHECKS` / 細部の決定 `## DECISIONS` / `held:`）を読む。指令の `output:`・`where:`・`held:`・`done_when:` を方針に反映する（下記 4a の出力別の扱い）。前の指令の判定が rework なら、その指令の RESOLUTION と CHECKS の行も読む。根拠が要るときは `report.snapshot.md` や本文が挙げるファイルも読む。
1. その依頼ファイルを全文読む。
2. **日本語で要約**（need / why / done_when / constraints）。`resumable` の指令は、`waiting_on:` の先（`done/` に移ったファイル）の RESOLUTION も読んで要約に入れる。発行束のチケットは書式が自由なので、need と本文の要点（実装する決定事項・合格の条件・束の中での位置）を要約する。
3. **このリポとしての実装方針を提案**（CODE_PLACEMENT に沿った置き場、汎用化の観点、API設計）。
   - **まず自リポの役目に照らして受理を判断し、冒頭で判定を明示する**（通常の指令のみ。評議会の束は下の発行束・特使の項に従う）: 自リポの project.md（役目・TIER・分担）と CLAUDE.md を読み、受理 / 修正受理 / 中継（引き渡し | 依頼して待つ）/ 差し戻し / 取り下げ のどれかにする。自分宛ての指令も同じように判断する（書いた後に不要・古くなっていれば取り下げ）。基準:
     - ① 自リポの持ち物か: 自リポ以外の作業が前提になる、または別のリポに引き継いだ方がよい → 中継（上流・下流・兄弟を問わない）。依頼元で持つべき → 差し戻し。手順は下記「中継 / 差し戻す / 取り下げる」
     - ② 自リポの役目・方針に反しないか
     - ③ 自リポに下流 fork がいるとき: 全 fork の自由度を狭めないか（データ・ロジック・セキュリティ境界は上流、画面・文言・デザインは downstream）、breaking なしで引き返せるか。ドメイン画面の UI 部品を求められても core には入れず、データレイヤー + README レシピで返す（CLAUDE.md core_domain_ui_boundary）
     - 依頼元が書いた API 案や実装案は仕様ではなく批評対象の提案
   - **自リポに下流 fork がいるとき（project.md の TIER 節）は、downstream 取り込み判定（見込み）を方針の冒頭に 1 行で示す**: `取り込み判定（見込み）: 安全 | 要注意（理由）| 危険（理由）`。危険 = そのまま merge すると fork のビルド・起動・既存動作が壊れる / fork 側の手作業（db:push・env・外部リソース準備など）が要る / 挙動・権限が黙って変わる。要注意 = merge の衝突が起きうる程度。`output: commit` で保留する歩は「出荷時に fork が受け取る場合」で判定する。下流がいなければ省く
   - **診断は再現してから**: 症状は信じてよいが、「原因は X」という主張は自分で最小再現するまで事実扱いしない（例: ルーティング欠落の主張は未認証 `curl -i` で確かめる。401/JSON = 到達、404 text/html = 本物の欠落。サーバー起動が要る確認はユーザーに curl を提示して結果をもらう）。前提が固まるまでスコープを広げない
   - **downstream 追従を判定する**（自リポに下流 fork がいるときだけ）: この対応で fork の既存コードが upstream 仕様とずれる（構造・ジェネレーター・規約・API の変更など）なら、fork の既存コードを新仕様へ揃える移行手順を `.notices/` で実装と同じコミットに出す前提で方針に含める。互換を残して放置させず、乖離のないクリーンな状態を優先する。notice には変更点と、fork 側で対象コードを探せる目印（grep パターン等）を書く。不要ならその理由を一言添える
   - 発行束のチケットは評議会で結論済みの内容なので、判定は実装の妥当性に絞る。結論そのものに穴が見つかったら、勝手に設計し直さず「差し戻し（要再審議）」として理由を示す。
   - 特使の指令も同じ扱いに加え、**指令の境界（「まだやらないこと」）で止まる**。範囲外で見つけた問題は直さず、完了時の RESOLUTION `findings:` に書く（評議会が次の指令を決める材料になる）。完了条件をどう確かめるか（実行するコマンド・テスト）も方針に含める。
   - **まだ実装しない**。ユーザーの承認を待つ。
   - チームセッション内（あなたが orchestrator）なら、この依頼を plan.md / handoff に落として通常のチーム手順に乗せる。
4. ユーザーが「対応完了」と言ったら（**完了報告とコミット&プッシュは必ずセットで実行する**。「対応完了」がコミット/プッシュへの明示的な指示を兼ねる。**以下 a〜d は途中でユーザーへの確認・質問・AskUserQuestion を一切挟まず連続実行する** — 「対応完了」が唯一かつ十分な承認であり、追加の承認待ちは禁止）:
   a. **実装差分を自リポにコミット & プッシュ**する（RESOLUTION を出す前に実体を確定させ、commit sha を正確にするため）:
      - `git status --short` で実装差分を確認する。
      - 未コミットの実装差分があればステージしてコミットする。メールボックスは git 管理外なので対象外。コミット対象は自リポ本体の実装のみ。確認・調査だけで差分の無い指令は commit を作らず、RESOLUTION を `commit:- | pushed:-` にする。
        - コミットメッセージ: 1行サマリ（実装内容を反映） + 空行 + `order: <id>`（指令の id を必ず含める）。
        - 末尾に環境指定の Co-Authored-By トレーラーを付ける。
        - ブランチ運用はチーム/通常フローに従う（既にフィーチャーブランチ上ならそのまま。チームセッションなら orchestrator のブランチ方針に従う）。
      - 方針で notice を出すと決めた対応では、`.notices/<id>.md` が同じコミットに入っていることを確かめる（無ければ書いてから含める）。
      - 既にチーム手順内でコミット済みなら新規コミットは作らず、現在の HEAD をそのまま使う。
      - `git push`（現在のブランチを origin へ）。remote 無し等で push できない場合は、その事実を日本語でユーザーに報告し、RESOLUTION の `pushed:` に正直に反映する（取り繕わない）。
      - コミット/プッシュ後の short sha を取得: `git rev-parse --short HEAD`、branch は `git rev-parse --abbrev-ref HEAD`。
      - **特使の指令・発行束のチケットに `output:` があるときは、それに従う**（指令の宣言が push についての明示的な指示になる）。対象リポは `where:`（省略 = 目次の `project:`）:
        - `output: commit` = **push しない**。commit は main ではなく、指令の `held:` が名指すブランチ（既定 `legate/<議題id>.<k>`）に積む。**worktree は作らず、同じ checkout でブランチを切り替える**（作業を始める前に行う）: 作業ツリーがクリーンなことを確かめて `git switch <branch>`（無ければ `git switch -c <branch> <指令の base:>`）→ 作業・検証もそのブランチで行う → commit → 作業ツリーをクリーンにして `git switch <main>` で **main に戻る**（他セッションの commit が保留ブランチに入らないようにするため）。特使の実行中はそのリポジトリで他の作業が無い前提。目次の `held:` は `<branch>` だけにする。RESOLUTION の `pushed:` は `no (held)`。
          - 目次の `held:` に worktree path が残っている（古い形）ときは、指令が worktree を保つと書いていない限り、最初に移す: `git -C <path> status --short` が空なのを確かめて `git worktree remove <path>`（ブランチと commit は残る）→ `held: <branch>` → LOG に1行。空でなければ移さずに止めて findings に書く。指令が worktree を保つと書いていればその worktree で作業する。
          - 保留ブランチにしか無いスキーマがある間は、main で db:push しない（登録外のテーブルに DROP が提案される）。該当するなら notes に書く。
        - `output: push` で held がある = 区間の出荷。保留ブランチで最後の commit → main が進んでいれば `git rebase <main>` → `git switch <main>` → `git merge --ff-only <branch>` → `git push` → `git branch -d <branch>`（worktree 方式なら先に `git worktree remove <path>`）→ 目次の `held:` を `-` に戻す。rebase で衝突したら止めて partial にし、findings に書く。
        - `output: none` = commit しない。観測・計測の結果を RESOLUTION に書くだけ（`commit:-`）。
   b. 依頼ファイルの末尾に **RESOLUTION ブロック**を追記する（依頼元が `/wen` で消費する。英語・構造化。commit は a で確定した sha、push 可否を `pushed:` に明記）:
      ```
      ## RESOLUTION
      resolved: <ISO8601>   status: done
      by: <self repo-id> | <self repo url> | branch:<branch> | commit:<short sha or -> | pushed:<yes|no|->
      implemented: <what was actually done>
      consume: <how the requester uses it: path + API | ->>
      propagate: <how it reaches the requester | ->
      notice: <.notices/<id>.md — apply with /flux | ->
      notes: <anything the requester needs>
      ```
      - `propagate:` の書き方: 依頼元が自リポの下流 fork = `pushed to origin — fetch & merge upstream into your fork to receive it` | 自分宛て = `-` | それ以外 = 依頼元への届き方（依頼元に影響が無ければ `-`）
      **特使の指令のときは**、`status:` を `done | partial`（partial = 指令の一部で止めた。理由を findings に書く）とし、`by:` は legate.md の形 `by: inbox | <repo> | branch:<branch> | commit:<short sha | -> | pushed:<yes | no (held) | no>` にし（worktree の path は書かない）、`notes:` の後に次の2行を必ず足す（評議会の `check` の主な材料。日本語可）:
      ```
      findings: <作業中に見つけた問題・指令とのずれ・範囲外として残したこと・未確認の点 | none>
      verify: <指令の done_when をどう満たしたか: 実行したコマンド/テストとその結果。確かめていないことは「未確認」と書く>
      ```
   c. 処理済みへ移動:
      `mkdir -p <自リポの受信箱>/done` → `mv <該当ファイル> <自リポの受信箱>/done/`
      **発行束のチケットのときは代わりに**（評議会が再開時にこの目次で進捗を知るので、必ず行う）:
      1. `00-index.md` の該当行の `status:open` を `status:done sha:<a の short sha>` に書き換え、`## LOG` に `- <ISO8601> NN done by /inbox commit:<sha>` を1行追記する。
      2. `mkdir -p <置き場>/done/<束名>` → `mv <チケット> <置き場>/done/<束名>/`（評議会の束は受信箱ではなく直下の `done/` が置き場）
      3. 目次に `status:open` の行が残っていなければ、束の残り（`00-index.md`・`report.snapshot.md`・withdrawn のチケット）も `done/<束名>/` に移し、空になったフォルダを `rmdir` する。
      **特使の指令のときは代わりに**（評議会の `check` がこの目次で完了を知るので、必ず行う）: `00-index.md` の該当行の `status:open` を `status:done sha:<a の short sha | ->` に書き換え（`check:-` はそのまま。`exec:` が `human+inbox` のような組み合わせなら、自分の分を RESOLUTION に書くだけで行は open のまま残し、評議会が他の分を記録してから done にする）、`## LOG` に `- <ISO8601> NN done by /inbox commit:<sha>` を1行追記する。**指令ファイルもフォルダも移動しない**（評議会が読む。完了時の移動は評議会が行う）。
   d. 日本語で報告（**冒頭に downstream 取り込み判定（実測）を 1 行**: 見込みと同じ書式で、実際の差分から判定し直す。見込みから変わったら理由を添える）: コミット sha / プッシュ先ブランチ / RESOLUTION 追記済み・done/ 移動済みであることを伝える。push できなかった場合はその旨も明示する。発行束のときは、束の進み具合（完了数/件数）と次に着手できるチケットも伝える。特使のときは findings の要点、`output: commit` なら保留中のブランチ名（push していないこと）と、「評議会の議長タブで `check` と打つと検証と次の指令が出ます（議長タブを閉じていれば別ターミナルで `council <議題id>` を実行して再開し、`check`）」と伝え、次の指令を自分で先取りしない。

## 中継 / 差し戻す / 取り下げる（通常の指令のみ。ユーザーが提案を承認したら、確認を挟まず続けて行う）
- **中継する場面**: 自リポ以外の作業が前提になる、または別のリポに引き継いだ方がよい（上流・下流・兄弟を問わない）。宛先は、自リポの役目と相手の役目（`node .claude/skills/order/mailbox.mjs repos` の `rules:` の project.md）から自分で決める
- **どちらで中継するか**（提案のときに、どちらかと理由を添える）: 元の指令の `done_when` を中継先の作業だけで満たせる → **引き渡し** | 中継先の結果を受けて自リポにも続きの作業がある → **依頼して待つ**
- **引き渡し**（元の指令を閉じる）:
  a. 元の指令をもとに、新しい指令を宛先の受信箱に書く: 新しい id（`date +%Y%m%d-%H%M%S`）、`from:` は元の依頼元のまま、`to:` は宛先に合わせて書き直し、`relayed_from: <元の id> | via:<自リポの repo-id>` の行を `to:` の次に足す。他の欄は元のまま（自リポで分かったことは `notes:` に足す）。
  b. 元の指令の末尾に RESOLUTION を追記し、自リポの受信箱の `done/` へ移す:
     ```
     ## RESOLUTION
     resolved: <ISO8601>   status: relayed
     by: <self repo-id> | commit:- | pushed:-
     relayed_to: <宛先の repo-id>/<新しい id>.md
     notes: <なぜ宛先の持ち物と判断したか>
     ```
  c. 日本語で報告: 引き渡した先と新しい指令のパス。
- **依頼して待つ**（元の指令は開いたまま）:
  a. `.claude/skills/order/SKILL.md` の手順で、宛先の受信箱に新しい指令を書く。`from:` は自リポ、`need:` は宛先にやってほしい部分だけ、`refs:` に元の指令のパスを入れる。
  b. 元の指令の末尾に `waiting_on: <新しい指令のフルパス>` を 1 行足す。待つ先が複数なら行を増やす。元の指令は受信箱に残す（`done/` に移さない）。
  c. 日本語で報告: 依頼した先と新しい指令のパス、元の指令は待ちとして一覧に出ること。待つ先がすべて対応済みになると、一覧で「再開可」になる。
  d. 再開するときは対応モードで、`waiting_on:` の先の RESOLUTION を読んでから方針を出す。中継先が差し戻した・取り下げたときは、元の指令をどうするか（別の宛先に頼む・自リポでやる・差し戻す）を提案し直す。
- **差し戻す**（依頼元で持つべき、または指令として成り立たない）: 元の指令の末尾に RESOLUTION（`status: rejected`、`notes:` に理由と依頼元でどう持てばよいか）を追記し、自リポの受信箱の `done/` へ移す。commit は作らない。
- **取り下げる**（不要・古くなった。自分宛ての予定に多い）: 元の指令の末尾に RESOLUTION（`status: withdrawn`、`notes:` に理由）を追記し、自リポの受信箱の `done/` へ移す。commit は作らない。

## 言語ルール
- ユーザーとの会話は日本語。
