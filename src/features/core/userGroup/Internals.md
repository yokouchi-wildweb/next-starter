# userGroup Internals

## Overview

ユーザーグループの表としくみ。使い方は `README.md`、口の形は `API.md`。

## Internals

### 表

- `user_groups`: id（uuid）・name・description・kind・owner_group_id（例外の人の持ち主のグループ）・status・current_version（定期計算の今の版の番号）・recompute_interval_minutes（定期計算の間隔の分、null = 設定の既定）・created_at・updated_at
- `user_group_definitions`: group_id（主キー）・tree（jsonb、条件の定義の木）・has_heavy・updated_at
- `user_group_members`: group_id × user_id（主キー）・created_at。静的グループの一員（利用者を消すと cascade）
- `user_group_versions`: id・group_id × version（一意）・status（computing / ready / failed）・started_at・computed_at・error・member_count・resume_after（書きかけの版の再開の位置 = 書き終えた最後の利用者 id）
- `user_group_version_members`: version_id × user_id（主キー）。定期計算の版ごとの一員と、静的グループの置き換えの下書き
- 持ち主のグループを消すと例外の人のグループも一緒に消える（FK cascade）

### 種類ごとの引き方

- 静的 = `user_group_members`
- 定期計算 = 今の版（`current_version`）の `user_group_version_members`。版が無ければ 409。連絡の送信の固定は送り始めの版を渡して読む（その版が片付けられていれば 409）
- 動的 = 保存した条件の木を users への 1 つの SQL の述語にして引く（`compileUserGroupDefinition`）。1 回の評価は 1 つの `now` を全部の部品に渡す
- どれも削除されていない利用者に絞る（users と結ぶ）
- 連絡の送信の固定（`memberWhere`）は、静的・定期計算を「users.id が一員の表にある」述語に、動的を条件の述語にして返す。使い手（連絡）はそれを利用できる利用者の述語・送り始めの時刻の線と合わせて 1 文の INSERT … SELECT に埋めるので、1 つの時点の一員になる

### 条件の木の検査と組み立て

- 部品の一覧は `activeCriteria`（`services/server/activeCriteria.ts`）: 生成の一覧（fork の `<名前>.override.ts` を重ねた後）から `enabled: false` と `available()` が false の部品を外して見せる（読むたびに `available` を確かめる）。部品の一覧の API・定義の検査・評価の口・定期計算はどれもこれを読む。`inStaticGroup` が `enabled: false` なら読み込みで投げる
- `checkUserGroupDefinition` が形（zod）・節の数と深さ（`definition.maxNodes` / `maxDepth`）・部品の鍵・引数（部品の `args` の zod）を確かめ、重い部品を含むかを返す。保存する時は `has_heavy` に残す
- 部品「固定グループのメンバー」（`inStaticGroup`）が指せるのは使用中の静的グループで、例外の持ち主付きでないものだけ（管理の service が保存の前に確かめる）
- 組み立ては and / or / not を SQL の and / or / not に、葉を部品の `where(args, { now })` にする。保存した木の部品が無い・引数が今の zod に合わない時は「壊れた条件」として 409

### 時間の上限

- 数え・見込み・列挙は取引の中で `SET LOCAL statement_timeout`（`evaluation.timeoutMs`）を掛けて読む。Postgres の取り消し（57014）は 503 にする
- 連絡の送信の固定は `memberWhere` が返す `timeoutMs` を連絡の側が savepoint の中で掛ける（時間切れなら回を取り消す）
- 管理画面の一覧の動的グループの人数は 1 件 `admin.listCountTimeoutMs`・1 ページ合計 `admin.listCountBudgetMs` で数え、超えた分は「未計算」

### 定期計算（cron `user-group-recompute`）

- 期限: 使用中の定期計算のグループのうち、書きかけの版があるか、最後の版の計算の開始から間隔（`recompute_interval_minutes`、null = `recompute.defaultIntervalMinutes`）が過ぎたもの。版が無ければすぐ。条件の定義（例外の人の変更を含む、`user_group_definitions.updated_at`）を最後の版の開始より後に直したグループもすぐ（書きかけの古い版は捨てて新しい版から）
- 計算: 条件の木を SQL にし（重い部品も使える）、削除されていない利用者を id の昇順に束ごと（`recompute.batchSize`）に新しい版へ書く。条件の時刻は版の計算の開始（何回に分けても 1 つの時点の一員）。締切（`recompute.budgetMs`）で止まれば次の回に `resume_after` から続ける。版の行を `FOR UPDATE SKIP LOCKED` で取るので並走する実行と重ならない
- 切り替え: 書き終えたら 1 つの取引で版を ready（`computed_at`・`member_count`）にし、`current_version` を切り替え、今の版と 1 つ前の版を残して他の版を消す。読む側は切り替えの commit まで前の版を読む
- 失敗: 条件が壊れた・人数の上限を超えた・書く途中の誤り = 版を failed（理由を `error`）、今の版はそのまま。失敗の版は一番新しい 1 つだけ残し、次の期限でもう一度計算する
- 結果 `{ checked, due, switched, failed, incomplete, budgetExhausted }` は `task_runs` に残る。門 `userGroups` が閉なら cron の門番が飛ばす

### 静的グループの置き換え

- 新しい一員を下書き（`user_group_versions` の computing の行 + `user_group_version_members`）へ利用者 id の昇順に束ごと（`write.batchSize`）に書き、書き終えたら 1 つの取引で `user_group_members` と入れ替えて下書きを消す。読む側（評価の口・部品「固定グループのメンバー」）は入れ替えの commit まで前の一員を見る。残る一員の `created_at` は変わらない
- 締切で止まれば下書きは残り、次の呼び出しが `resume_after` から続ける。人数の上限を超えた束で止め、下書きを消して 409
- 足す・外すは 1 つの取引（グループの行を FOR UPDATE、置き換えの入れ替えと重ならない）
- 管理画面の「固定」（`/static` と `[id]/members` の replace）は 1 回の要求の予算 `admin.freezeBudgetMs` で書き、`incomplete` の間は画面が同じ元で送り直す（元は選んだ利用者・別のグループの今の一員・タグの今の持ち主を keyset の供給にしたもの）

### 例外の人

- 初めて例外の人を書く時に、持ち主付きの静的グループを 2 つ（「<名前> の足す人」「<名前> の外す人」、`owner_group_id` = グループ）作り、保存する定義を `(元の定義 or 足す人の一員) and not 外す人の一員` に包む。どれが足す人・外す人かは包んだ木だけが持つ（列は足さない）
- 読む時は包みを外して元の定義を返す（`unwrapExceptions`、持ち主のグループの id と照らす）。定義を直しても包みは保つ
- 足す人に入れた人は外す人から外し、逆も同じ。人数の上限は静的グループと同じ
- 定期計算のグループは例外の人を変えると定義の時刻を進めるので、次の cron で計算し直す

### 登録

- `services/server/domainEntry.ts`（手書き）: `userGroup` = 表 `user_groups`、access `INTERNAL_ONLY`（管理の API は専用の口）
- 表は `pnpm generate registry` が schemaRegistry に入れる。表・列・索引を足したら `pnpm db:push` の後に `pnpm db:push:check` = 0
- サーバーの口は部品（db・部品の一覧・設定・門・時刻）を受けて作り、本物の結びは各フォルダの `index.ts`（門は `gate.enabled("userGroups")`）
