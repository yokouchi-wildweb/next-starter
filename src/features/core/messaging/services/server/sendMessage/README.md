# sendMessage（送る口）

## Overview

連絡の定義（`defineMessage`）を受けて回と配達を書き、経路の項目で送る口。公開の入口は `messagingService`（`../messagingService.ts`）の `sendMessage` / `sendMessageToMany` / `sendAuthored` / `previewMessage` / `estimateRecipients`。使い方と宛先の線はドメインの README（../../../README.md）。

## API

- `sendMessage(definition, { recipient, vars, idempotencyKey?, scheduledAt?, source?, … })`: 1 人（`{ userId }` か `{ channel, address }`）
- `sendMessageToMany(definition, { target | recipients, vars, … })`: `target` = `MessageTargetSpec`（`{ type: "all" }` / `{ type: "role", roles }` / `{ type: "group", groupId }`）か `recipients: [{ userId }, …]`
- `sendAuthored({ content, category, template?: { templateId, version }, vars?, recipients | target, channels?, scheduledAt?, … })`: 管理者が書いた文面で送る（その場で書いた文面もテンプレートを読み込んで直した文面も同じ口、`template` の有無だけが違う）
- `previewMessage`（経路ごとの組んだ中身 `fields` と描いた結果）・`estimateRecipients({ target })` → `{ count, fixedAtSend: true, memberLimit?, overLimit? }`（グループは一員の数と人数の上限、利用できない人を外す前の数。送る時に展開で数え直す）
- 戻り値は回の id・状態・数。選んだ宛先で宛先の無い受信者・止めた受信者は理由つきで返る
- 定義の誤りは 500、`enabled: false` は回を作らず `status: "disabled"`、vars の誤り・知らない鍵は 400、冪等の鍵の重複は 409
- 連絡はその定義のフォルダのドメインに属する（生成の一覧の鍵 `<ドメインのフォルダ名>.<ファイル名>`）。ドメインが門で閉じていれば（そのフォルダを載せた機能が全部閉、`gate.domainOpen`）、送る口は回も配達も作らず `status: "disabled"` を返す（投げない = 呼び手の業務は止めない、警告を 1 行）。上流のドメインも fork のドメインも同じで、fork は自分の規則の入切で自分の連絡を止められる（`domainGate.ts`、D77）
  - cron（掃き出し）は閉じたドメインの連絡の置いてある行を送らず、状態を戻して 1 時間先送りする（開けば送る。保持の掃除の日数を過ぎれば消える）
  - 文言の編集（管理画面の上書き）も閉じたドメインの連絡を一覧に出さず、1 件・保存・戻すは 404

## Internals

### 流れ

1. 生成の一覧（`messageRegistry`）の定義に上書きを `applyMessageOverride` で重ね、`validateMessageDefinition` で検査（ひな形・欄の中身・`{{鍵}}`）。管理画面の文言は今は重ねない（『経路.欄』の鍵が ひな形の欄に当たらないため。TODO 指令 56: ひな形の欄の鍵へ替えて `resolveDefinition` の 1 か所で重ね直す）
   - 中身の組み立ては `content.ts` の 1 つ（`buildContent` / `buildContents`）: 定義の欄の中身に差し込む → 経路ごとに描き方の 3 段（lib/messaging `buildChannelContent`: ひな形の描き方 > 経路の汎用 > 要約）→ 中身と見出し（要約の題）。email = `MessageLayoutContent`（経路が宛先ごとに描く）、inApp = 要約から（お知らせの行の title・body・image・link、S6 まで）、line = 要約から。どの段でも描けない経路は回を書く前に 500（経路と理由）
   - 組み立てを通る所: 回の見出し（秘密の鍵は差し込まない）・全員同文の描画（`rendered`）・その場の行・プレビュー・まとめ送りの描き直し・cron の共有のお知らせの行・cron の送る行・上書きのプレビュー
   - enrichers は当て先（連絡の鍵・種類・種別・全部、D127）で選ぶ。使える鍵の検査（`enricherKeysFor`）と実行（`context.ts`）が同じ `enrichersFor`
2. 冪等の鍵を `message_dispatches` と `message_idempotency_keys` の両方で確かめる（重複・INSERT の UNIQUE 違反は 409）
3. 回を 1 行書く（`message_key`・`kind`・`category`・`target`・`record`・`headings`・`channel_counts` など）
4. 小さな送信（選んだ宛先が `smallSendMaxRecipients` 人以下）: 受信者 × 経路に展開して配達の行を作り、最初の束（`inRequestBatchSize`）を経路の `send(targets)` へ。残りは `queued` + `next_attempt_at` で cron が送る
5. 大きな送信と `target`（全員・ロール・グループ）: 回だけを書き（`processing`）、展開と送信は cron が束ごとに行う（`expand.ts` の `expandBroadcastChunk`・`resolveTargetChunk`、グループの固定は ../sweep/README.md）
6. 予約（`scheduledAt`）: 回だけを `scheduled` + `scheduled_at` で書く（選んだ宛先の一覧も回の `target` に）。cron が時刻に `processing` にして 5 と同じく送る。粒度は cron の周期

### 管理者が書いた文面（authoredDefinition.ts・dispatchDefinition.ts）

- 定義の鍵 = 送るカテゴリーの種別の authored の定義（`messaging.adminAnnouncement` / `adminDirect` / `adminPromotion`）。種別が announcement・direct・promotion でないカテゴリーは 400（送る時も cron の組み直しも）
- **経路 = 種類の経路 ∩ その回の絞り（`channels`）。その中に文面の無い経路が 1 つでもあれば 400**（黙って落とさない）。欄は経路の受け口の zod で検査。`{{鍵}}` = 当たる enrichers の鍵 + テンプレートの版の変数（文面の全部で見る）、知らない鍵は 400。authored の定義は上書きと管理画面の文言を重ねない
- 経路ごとの文面（管理画面・テンプレートの形、S4・S5 まで）は送る時にひな形 notice の欄の中身にする（`authoredNoticeValues`）: email の欄が先（件名 → subject、見出し・段落・ボタン・フッター → ブロック）、無ければ inApp（題・画像・本文・行き先）、無ければ line。経路ごとに別に書いた文（お知らせだけの文など）は S5 まで使わない
- 文面は回の `authored_content` に残し、予約・cron の組み直し・再送はその文面で組む（後でテンプレートを直しても送った文面のまま）
- テンプレートを読み込んだ時: 今の公開版を回の `template_id`・`template_version` に固定（今の公開版でない・取り下げ済み・未公開は 409、無いテンプレートは 404）。版から直したかを `template_edited` に残す
- 変数の値 `vars`（回に 1 組、`template` がある時だけ。無いのに渡すと 400）は版の変数で検査（必須の欠け・型の違いは 400）。cron は送る時にもう一度検査し、合わなければ配達を `failed`（`template_vars_invalid`、版が消えた = `template_missing`、文面の無い前の回 = `authored_missing`）。受信者ごとの変数（`source: recipient`）は既定値を全員に使う（既定値が無いテンプレートは 400）
- 画像（`storage://`）: お知らせの行を書く時に回へ結ぶ（../inbox/README.md「画像」）。テンプレートの画像も回ごとに複製して回が持つ

### 宛先の引き方

- 利用者の宛先は経路の `resolveAddresses`、無ければ端末の帳簿（`message_endpoints` の有効な行）。宛先が複数なら 1 行の `targets` にまとめ、1 つでも送れたら `sent`
- 選んだ宛先で宛先の無い受信者は `suppressed` + `no_address` の行。全員・ロール・グループは行を作らず `channel_counts.<経路>.skipped_no_address` に数える
- 経路の項目が無い・`enabled: false` は `channel_off`。受信者の鍵は `user:<id>` か `addr:<正規化した宛先の sha256>`
- 帳簿を読む経路で送れた宛先の `last_used_at` を経路ごとに 1 回の UPDATE で記録（失敗しても結果は変えない）

### 配信停止の確かめ（stops.ts）

- 確かめる所: 小さな送信の展開・cron の展開・cron が送る直前（キューの後で止めた人も外す。宛先の 1 つにもう送れた行は sent のまま送り直しをやめる）
- 判定（`findOptOuts` → `checkStops`）は好みの見え方・受け取り箱の見え方と同じ（../preferences/README.md）
- 外した受信者: 選んだ宛先は `suppressed` + `preference` / `suppression` の行、全員・ロール・グループは行を作らない。どちらも `channel_counts.<経路>.suppressed` に数え、どの経路でも止められた受信者は `recipient_count` から引く
- メール: 好みに従う連絡の宛先に送る口が `category` と `List-Unsubscribe`・`List-Unsubscribe-Post`（RFC 8058）を付ける。**`category` があるのに鍵 `MESSAGING_UNSUBSCRIBE_SECRET` が無い = 送らず permanent（`unsubscribe_key_missing`）**

### 送信の結果

- ChannelError の分類: `sent` → `sent` / `permanent` → `failed` / `unknown` と send が投げた例外 → `unknown`（自動で送り直さない）/ `transient` → 非 required は `queued` のまま `next_attempt_at` を広げて cron（`transientRetry`、尽きたら `failed`）
- 経路の冪等の鍵 = 配達の行の id（宛先が複数なら `<id>:<番号>`）

### 本文の残し方（定義の `record`、既定 `vars`）

- `meta` = 件名・題（`headings`）だけ / `vars` = + 回の vars の写しと全員同文の描画結果（`rendered`）+ 受信者ごとの値 / `full` = + 受信者ごとの本文（配達の `body`）
- required と `secretVar` の鍵を持つ連絡は本文をどこにも残さない（`full` でも、誤りの文も理由の符号だけ）。秘密の鍵は vars の写し・件名・題に入れない。required は vars の写しも残さない
- これらの連絡はキューに置けないので要求の中で送り切る（一時の失敗は `requiredRetry` の回数だけ短く再送）。全員・ロール・グループ宛てと大きな送信は 400
- 送り残しがある回は cron のために vars を持ち、`meta` なら回を閉じる時に消す
- 受信者ごとの監査ログは書かない（配達の行で追う。管理者の操作は管理の口が監査）

### 間引き（throttle.ts）

定義か上書きの `throttle: { by, mode, seconds }` を持つ連絡は、経路の send の前に受信者ごとに間引く（要求の中の送りも cron も同じ処理）。上流の定義は宣言しない。

- 鍵 = 受信者の鍵 × `message_key` × `by` の値（回の vars）の sha256。配達の行と受信者ごとのお知らせの `throttle_key` に入る
- `untilRead`（経路に inApp）: 同じ鍵の未読のお知らせがあれば置き換える（中身を最新に、`collapsed_count` + 1、前の回を `collapsed_dispatch_ids` に、`dispatch_id` は今の回、`published_at` = 今）。inApp の配達は `sent` + `throttled`、ほかの経路は `suppressed` + `throttled`（回の `skipped_throttled`）
- `window`（と inApp の無い `untilRead`）: 同じ鍵の前の送り（`seconds` 以内に sent か送る途中）があれば間引く。inApp は未読なら置き換え、既読なら新しいお知らせ。間引いた行は window の起点にしない
- 最初の 1 通・window の後・既読の後はふつうに送る。`{{collapsedCount}}` = ふつうは 1、置き換えた時はその回数（throttle のある連絡だけの鍵）
- 排他: 鍵の `pg_advisory_xact_lock` を持った取引の中で回 × 受信者の行を読み直して 1 度だけ決め、その受信者の全部の行に書く（要求の中と cron が重なっても 2 通にならない。経路の呼び出しの間は lock を持たない）。お知らせの行はこの取引の中で書く（形は `channels/inApp` の `inAppItemRow`）
- 間引くのは受信者ごとの行だけ: 全員・ロール宛て（共有の 1 行）は間引かない。グループ宛てと選んだ宛先は間引く
- `collapsed_dispatch_ids` は FK を持たない。削除・保持・画像はお知らせの今の `dispatch_id` に従う

## Verification

- `pnpm test src/features/core/messaging/services/server/sendMessage`（`sender` / `content` / `stops` / `throttle` / `authoredSend` / `schedule`）
- `messageRegistry.test.ts`: 生成の一覧の全件を上書きを重ねた後に検査（`checkMessageRegistry`、鍵の一致・種類の経路の全部で描けるか）。出荷の前に通す
- `store.db.test.ts` は `DATABASE_URL` がある時だけ
