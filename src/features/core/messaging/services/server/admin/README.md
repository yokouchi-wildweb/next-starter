# admin（管理の送信と送信の読む口）

## Overview

管理者が送る・一括送信する・送信を読む・送信を操作する口（`/api/admin/messaging/**`）。管理者だけ: API の access `roleCategories: ["admin"]` と service の `assertAdmin`（監査の文脈の操作者の役割の分類を引く。`runAsSystem` の system も通す）の両方。操作は監査ログに 1 行。画面は ../../../components/README.md。

門:

- `messagingDispatches`（既定 開）: 送信の読む口・送信の操作・続きを送る（`/api/admin/messaging/dispatches/**`）と画面 `/admin/messaging`
- `messagingBroadcast`（`dependsOn: ["messagingDispatches"]`、既定 閉）: `/api/admin/messaging/send/**` と送るモーダルの口（送信の一覧「新しく送る」・送信の詳細「同じ内容で送る」。部品が `useGate` で出し分ける）。閉でも送る口と cron の予約の拾いは動く
- 一括送信 `/api/admin/messaging/bulk-send/**` はどの門にも入れない（管理一覧の一括操作が使うので、画面を閉じても送れる）
- 送信の結果 `/api/admin/messaging/send-results/**` はどの門にも入れない（送れる所で結果も見られるよう、一括送信と同じ）
- 定義連絡の送る口 `/api/admin/messaging/definitions/**`: 記録の入口と記録の宛先の選択肢は門の外（一括送信と同じ）。全員・ロール・グループの入口は門 `messagingBroadcast` の中だが、同じ道なので道の印に載せず service が `gate.enabled` で見て閉なら 404（プレビュー・テストも）

## API

### 管理の送信の形（freeText.ts・../sendMessage/templateDefinition.ts、D117・D125・D171）

- 自由連絡 = カテゴリー + 出どころ `origin` = レイアウト `{ layout: 鍵 }`（管理画面で選べる `adminSelectable` で無効（`disabled`）でない物だけ、ほかは 400）か DB のテンプレート `{ id, version }`（無効のレイアウトのテンプレートは 400） + 欄の中身 `values`（レイアウトの欄、汎用のお知らせ notice = 件名 + ブロックの並び）+ 直した印 `edited?`（DB のテンプレートだけ）。管理用の連絡定義は無い
- **カテゴリーの種別と宛先の組は種別の性質 `adminFreeText`**: announcement = 全員・ロール・グループ・選んだ利用者 / direct = 選んだ利用者・グループ・一括（D109）/ promotion = 全部。誤りは 400。種別はカテゴリーから（レイアウトは種別を持たない）
- 宛名は `{{displayName}}`（enricher、種別 announcement・direct・promotion に当たる）。決まった挨拶・足元の文は無い（要るなら管理者が書く）。見た目は notice の描き方の `.replace` で替えられる
- 送信は `message_key` null + 出どころ（DB のテンプレートなら `template_id`・`template_version`・`template_edited`、レイアウトの送信は無し = `layout` だけ）。前の管理の定義の鍵での送信（`messaging.adminMessage` など）も当時の鍵・種別・カテゴリーで読める
- fork のコードからは `messagingService.sendFreeMessage`（同じ形、../sendMessage/README.md「fork のコードから管理の送信」）

### `/api/admin/messaging/send/**`（send.ts、門 `messagingBroadcast`）

- `POST /send`（`AdminSendInputSchema`）: `origin`（`{ layout }` か `{ id, version }`。廃止した `{ system }` など、ほかの形は 400）・`values`（レイアウトの欄の中身）・`edited?`（DB のテンプレートだけ、`{ layout }` では 400）・`vars?`（専用の埋め込み情報の値 `{ 鍵: 値 }`、DB のテンプレートだけ。版の宣言の型で検査）・`category`（必須、種別 announcement・direct・promotion）・`channels?`（カテゴリーの送信チャンネルの中の絞り、外・空は 400）・`target`・`scheduledAt?`（ISO 8601）・`idempotencyKey?`・`reason?` → `{ dispatchId, status, queuedCount, channelCounts }`。知らない鍵は 400。送り元 `messaging.adminSend`
  - `target` = `{ type: "all" }` / `{ type: "role", roles }` / `{ type: "group", groupId }`（使用中のユーザーグループ。門 `userGroups` が閉・無い = 404、しまった・壊れた・人数の上限 = 409）/ `{ type: "users", userIds }`（10,000 人まで）
- `POST /send/preview`: 送信チャンネルごとの差し込み済みの欄と送信チャンネルの `preview`（メールは送る時と同じ HTML）。見本の受信者 = 操作した管理者、テンプレートは今の公開版
- `POST /send/estimate` `{ target }` → `{ count, fixedAtSend: true, memberLimit?, overLimit? }`（全員・ロールは数、グループは一員の数と上限、選んだ利用者は居る人の数。停止・宛先なしを引く前）
- `POST /send/test`: 宛先 = 操作した管理者だけ・`is_test`（集計と分母から外す）。予約しない。システムの操作は 400
- `GET /send/options`: 有効な送信チャンネル `{ key, label }`・ロール・`groups`（使用中のグループ `{ id, label, kindLabel }` を名前の順に 200 件、門 `userGroups` が閉なら空。id は値としてだけ使い画面に出さない）・公開したテンプレート（版の番号・カテゴリー・文言・変数）・`categories` `{ key, label, kind, channels, defaultChannels, targets, catalog }`（`defaultChannels` = 送信方法の最初の入（カテゴリーの `defaultChannels`、無ければ `channels`）、`catalog` = そのカテゴリーで書ける埋め込み情報 = 共通 + 当たる enrichers）・`layouts`（レイアウトの欄の宣言 `{ key, label, version, fields, selectable }`、門 `messagingTemplates` の外: 管理画面で選べるレイアウト（受け口の順、`selectable: true`）→ 並べたテンプレートが使うほかのレイアウト（`selectable: false`、読み込んだテンプレートを描くだけ）。無効のレイアウトは出さず、そのテンプレートも並べない）・`initialLayout`（送る画面が最初に開くレイアウトの鍵 = config の `initialLayout`。管理画面で選べる使えるレイアウトであることは連絡の一覧の検査が見る）・`maxScheduleDays`
- 監査: `messaging.dispatch.sent` / `messaging.dispatch.scheduled` / `messaging.dispatch.test_sent`（対象 `message_dispatch`、出どころ `source` = `layout`（`layout`）か `template`（`templateId`・`templateVersion`・`edited`）、本文の値は残さない）

### `/api/admin/messaging/bulk-send`（bulkSend.ts、門の外）

- `GET`: `{ channels, categories, templates, layouts }`（送信チャンネルは送る口の選択肢と同じ、カテゴリーは bulk で送れる種別で `/send/options` と同じ形（`catalog`）、テンプレートは門 `messagingTemplates` が開の時だけ、`layouts` = `/send/options` と同じ（選べるレイアウト → 並べたテンプレートのレイアウト））
- `POST`: 宛先 `{ userIds }` か `{ target, recordIds }`（10,000 人まで）、中身は `/send` と同じ `origin`・`values`・`edited?`・`vars?`・`category`・`channels?`、`idempotencyKey?`（8〜128 文字）・`source?`（既定 `<target>.bulk`、userIds なら `messaging.adminBulk`）・`reason?`・`isTest?`。予約は無い（`scheduledAt` は 400）。知らない鍵は 400
  - → `{ dispatchId, status, counts: { recipientCount, channelCounts, queuedCount } }`
- `POST /preview`・`POST /test`: `/send` と同じ（テストの送り元 `messaging.adminBulk.test`）
- 記録の宛先 `<domain>/recordTargets/<名前>.ts`（`MessageRecordTarget`、lib/messaging。生成の一覧 `src/registry/recordTargetRegistry.ts`、読み手は門番 `loadRecordTarget` = 無い鍵・閉じたドメイン・`enabled()` が false は 400）: `key`（= `<ドメインのフォルダ名>.<ファイル名>`）・`label`・`enabled?`・`resolveRecipients(recordIds)` → `[{ userId, vars, recordIds }]`（自由連絡の一括送信は userId だけを使う。記録の値 vars と項目の `afterSend` は定義連絡の送る口の記録の入口だけ、D196: 下の「/api/admin/messaging/definitions」）
- 監査: `messaging.dispatch.bulk_sent`（送り元・種別・送信チャンネル・数・状態・対象の鍵）

### `/api/admin/messaging/definitions/**`（definitionSend.ts、D190・D195・D196・D202）

定義連絡（`messages/<名前>.ts`）を管理者が送る。中身はコードの定義が持ち、画面から受けるのは次だけ: `edits?`（テキストの編集 = レイアウトの欄の鍵 → 値。直せる欄は管理画面のテキストの編集と同じ `adminEditableFields`、required の連絡は 400）・`channels?`（送信チャンネルの絞り: 定義の固定 on はいつも入る、off・カテゴリーの外・空は 400。required は email を外せない）・`vars?`（管理者の値 = 定義の `adminVars` の鍵だけ。入力の型で変換（`adminVarValueOf`、数は数）してから定義の vars の zod で検査、合わない・宣言に無い鍵は 400）・`idempotencyKey`。埋まらない必須の vars は 400

- `POST /definitions/send`（`AdminDefinitionSendInputSchema`）: `entry` = 次のどれか、`edits?`・`channels?`・`vars?`・`idempotencyKey`（必須、8〜128 文字）・`scheduledAt?`・`reason?`。知らない鍵は 400
  - 記録 `{ recordTarget, recordIds, message }`: 項目（門番 `loadRecordTarget`、無い・閉じた = 400）の `messages` の中の連絡定義だけ（外は 400）、定義の `adminTargets` に `records`。宛先 = `resolveRecipients` の返す形（1 人 1 件、記録ごとかまとめるかは項目、D204。10,000 人まで）、受信者ごとの値 = 記録の値のうち定義の `recordVars` の鍵だけ（定義の zod で検査）。予約は無い（400）。送り元 `<項目の鍵>.bulk`
  - 全員・ロール・グループ `{ message, target: { type: "all" } | { type: "role", roles } | { type: "group", groupId } }`: 定義の `adminTargets` にその種類。予約は自由連絡と同じ決まり。送り元 `messaging.adminSend`
  - 連絡定義が無い・連絡のドメインが閉じた = 404、定義が止められている（上書きの enabled: false）= 400
  - → `{ dispatchId, status, counts: { recipientCount, channelCounts, queuedCount }, afterSend: { ok: true } | { ok: false, error } | null }`（`afterSend` = 記録の入口で項目が持つ時だけ）
  - 送信の記録: `message_key` + テキストを編集した欄 `edited_fields`（無ければ null、編集の後の字は記録の段が残す時の `values`）。失敗の再送は同じ印を写す
  - 項目の `afterSend({ recordIds, dispatchId, counts, channels, message, fields })`（記録の入口の送信の受け付けの直後に 1 回。`channels` = 使うと決めた送信チャンネル、`message` = 連絡定義の鍵、`fields` = テキストの編集の後の欄の中身（差し込む前の字）。投げても送信は戻らず結果と監査に失敗を残す）
- `POST /definitions/preview`: 送ると同じ検査。見本の受信者 = 操作した管理者、記録の入口は選んだ最初の記録の値で組む
- `POST /definitions/test`: 宛先 = 操作した管理者だけ・`is_test`、記録の入口は最初の記録の値。`afterSend` は呼ばない。送り元 `<送る時の送り元>.test`
- `GET /definitions/record-targets` → `[{ key, label, messages: [{ key, label }] }]`（門番を通った項目と、読める連絡定義だけ）
- 監査: `messaging.dispatch.sent` / `scheduled` / `test_sent`（`message`・`entry`（`{ recordTarget, recordCount }` か宛先の指定）・`editedFields`・`channels`・`category`・`kind`・状態・記録の入口は `afterSend`）

### `/api/admin/messaging/send-results`（sendResults.ts、門の外、D214 (1)）

自由連絡・定義連絡・一括送信の結果に同じ口。送る画面が送った後に出す結果の材料だけで、送信の詳細（下の読む口）の代わりにはしない。

- `GET /send-results/[dispatchId]`: `cursor`・`limit`（既定 50、最大 100）→ `AdminSendResults` `{ channels, failed: { items, nextCursor } }`。無い・削除した送信は 404
- `channels` = 送信の `channel_counts`（送信チャンネルごとの `targeted`・`sent`・`failed`・`skipped_no_address`・`skipped_throttled`・`suppressed`。まだ数の無い送信は `{}`）。どのページも返す
- `failed.items` = 届かなかった配達 `{ userId, name, channel, status, reason }`（`status` = `failed` / `bounced`（失敗）か `suppressed`（送らなかった）。`canceled`・`unknown`・送る前の行は入れない）。古い順の keyset（印は読む口と同じ形）。`name` = users.name（無い・消えた利用者は null）。`reason` = `suppressed` は配達の理由（`no_address`・`preference`・`suppression`・`throttled`・`channel_off`）、`failed` / `bounced` は `last_error` の符号（文は `constants/deliveryErrors.ts`、分からなければ null）。宛先と provider の文は返さない
- 全員・ロール宛てのお知らせは配達の行が無いので `failed` に出ない（数は `channels` にある）

### 送信の読む口（readDispatches.ts・dispatchDto.ts、門 `messagingDispatches`）

汎用 CRUD の search には乗せない。

- `GET /dispatches/categories` → `{ items: { key, label, kind }[] }`（カテゴリーの受け口の全部）
- `GET /dispatches`: `from`・`to`（作った時刻）・`kind`・`category`・`channel`・`status`・`deleted`（`exclude` 既定 = 削除した送信を出さない / `only` / `include`）・`cursor`・`limit`（既定 50、最大 100）→ `{ items: AdminDispatchSummary[], nextCursor }`（新しい順、keyset）。定義の鍵では絞らない
- `GET /dispatches/[id]` → `AdminDispatchDetail`: 送信の中身・`operations`（下）・`targetGroup` `{ id, name }`（グループ宛ての送信、id は値だけ。門 `userGroups` が閉なら名前は取れない）・「同じ内容で送る」が写す `templateEdited`・`templateDeleted`（テンプレートからの送信でそのテンプレートが消された = 版の番号はあり `templateId` が null、D137。画面は「削除されたテンプレート」と出し、同じ内容で送るはテンプレートにつながず中身だけ写す。送り直しは消したテンプレートの出どころのまま新しい送信を作る）・`content`（送信の中身 `{ layout, layoutVersion, values }`、欄の中身を残した送信だけ。詳細のプレビュー）・`sameAs`（「同じ内容で送る」の写し `{ layout, layoutVersion, values, vars, template: { id, version, edited } | null }`。自由連絡 = `message_key` が無く中身を残した送信だけ、定義連絡の送信・前の送る口の送信・中身の無い送信は null、D193。`vars` は記録の段が vars / full の時だけ写す。送るモーダルが写す: テンプレートの送信は今の版を読み込み直してからの送信なら直した文、ほかは管理画面で選べるレイアウトの時に values）・`vars`（送信に 1 組の埋め込み情報の値 = 定義連絡の vars と DB のテンプレートの専用の値、記録の段が vars / full の時だけ）・`targetUserIds`（選んだ利用者の送信の利用者 id。10,000 人を超える・ほかの宛先は null）
- `GET /dispatches/[id]/preview` → `AdminDispatchPreview` `{ dispatchId, layout, cannotRender, channels }`（`dispatchPreview.ts`）: 送った物を見せる。送信だけから描く（`resolvedOfDispatch`、送った版を今の版へ読み替え、どのレイアウトでも）。差し込み = 送信の `vars` ∪ 共通の文脈（受信者ごとの値は字のまま）。送信チャンネルごとに `{ key, label, html, text, layout, values, summary, cannotRender }`（メール = 送信チャンネルの `preview` の HTML、お知らせ = レイアウトの描き方の材料）。中身を残していない送信（`values` が無い）・レイアウトが無い・版を読めない送信は `cannotRender` に理由で送信チャンネルは空
- `GET /dispatches/[id]/deliveries`: `status`・`channel`・`cursor`・`limit` → `{ items: AdminDeliveryRow[], nextCursor }`（古い順）
- 返す項目は `dispatchDto.ts` 1 か所: 鍵・種別・カテゴリー・送り元（`sourceLabel`）・状態・送信チャンネル・件名 / 題・数・送った人（`actorName`、system は「システム」）・時刻・テストかは常に / 送信の本文（rendered）と vars は記録の段が vars・full の時 / 配達の本文は full の時だけ / 宛先は出す（`userName`）/ provider の生の値と `last_error` の文は出さない（符号 `errorCode`、文は `constants/deliveryErrors.ts`）。`message_key` が null の前の送信は件名・題・本文を `rendered` から

### 送信の操作（operations.ts、`DELETE /dispatches/[id]`・`/dispatches/bulk-delete`・`/dispatches/delete-summary`・`/dispatches/[id]/resend`）

どの操作も送信の行を `FOR UPDATE` で持った 1 つの取引（`operationsStore.ts`）。できない操作は 409 と理由の符号（DomainError の `code`）。符号と文は `constants/dispatchOperations.ts`（`DISPATCH_OPERATION_REASONS` / `DISPATCH_OPERATION_REASON_TEXT`）の 1 か所で、送信の 1 件の `operations`（`canDelete` / `canResend` / `canContinue` ごとに `{ allowed, reason }`、canResend は `mode`・`failed`・`unknown` も、判定 `operationFlags`）と 409 の文が同じ物を読む。

- `DELETE /dispatches/[id]`（D88、予約の取り消し・取り下げを置き換えた）: どの状態の送信も消す。取引で `queued` の配達を `canceled`・送り直しの予定を止め、展開を終わりにして `deleted_at`（**status は変えない**。予約の送信も cron が拾わない）。commit の後に消せる送信チャンネルの `remove`（送信チャンネルの項目、上流は inApp = お知らせの行・共有の行・画像を外す）を呼ぶ。送ったメール・LINE は残る。削除済みにもう一度 = `remove` だけ呼び直す（`alreadyDeleted: true`、監査なし）。`remove` の失敗は `failedChannels` に残す（もう一度消せば呼び直す）→ `AdminDeleteResult { dispatchId, alreadyDeleted, canceledDeliveries, removed: [{ channel, removed }], failedChannels }`。戻す操作は無い。監査 `messaging.dispatch.deleted`
- `POST /dispatches/bulk-delete` `{ ids }`（1〜100 件、`ADMIN_DELETE_MAX_IDS`）→ `{ results: [{ dispatchId, ok: true, result } | { dispatchId, ok: false, reason, message }] }`。送信ごとに 1 件の削除と同じ（送信ごとの取引・監査）
- `POST /dispatches/delete-summary` `{ ids }`（同じ上限、書かない）→ `{ found, deleted, scheduled, unsent, channels: [{ key, label, removable, sent }], sharedInbox }`。`removable` = 送信チャンネルが `remove` を持つ（受け取った人から消える）/ false = 届いた物は残る。`sharedInbox` = 全員・ロール宛ての共有のお知らせの行を持つ送信の数（配達の行が無い分）
- `POST /resend` `{ includeUnknown? }`: required でない送信の `failed` の配達だけ（`unknown` は `includeUnknown: true` の時だけ、送信の `metadata.possibleDuplicate` に残す）。履歴 `metadata.resends`
  - record `vars` / `full`: 同じ送信のまま行を `queued` に戻す（attempts 0、冪等の鍵は同じ）。送信は `processing` に戻り、最初の 1 束を続きを送るで、残りは cron。`sending` の行は触らない
  - record `meta`: 送信の vars の写しで失敗の宛先へ新しい送信（`metadata.resendOf`、テンプレートは同じ版、送った id は `metadata.resentDeliveryIds`）。写しが無い = `no_input_copy`
  - 409: `secret`（送り手のコードからもう一度送る）・`required`・`definition_missing`・`deleted`・`cancelled`・`scheduled`・`no_failed`。監査 `messaging.dispatch.resent`

### 続きを送る・利用者ごとの履歴

- `POST /dispatches/[id]/continue`（continueSending.ts）: 1 束だけ進める（展開 1 束 + 送る 1 束 + 閉じられるなら閉じる）。`processing` 以外は 409 → `{ expanded, claimed, sent, failed, completed }`。監査 `messaging.dispatch.continued`
- `messagingService.listUserMessageHistory(userId, { cursor, limit })`（`../history`）→ `{ items, nextCursor }`: その利用者の配達（1 行 = 1 送信チャンネル）を送信と結び新しい順。`dispatchId`・`messageKey`・`kind`・`source`・`channel`・`status`・`headings`・`createdAt`・`sentAt`（本文・宛先・provider の値は出さない）。server だけ・route なし・管理者を確かめない（呼び手が読める人を決める）。全員・ロールの共有のお知らせと消した利用者の配達は出ない

## Verification

- `pnpm test src/features/core/messaging/services/server/admin`（`admin` / `send` / `operations` / `sendResults`）と `pnpm test src/features/core/messaging/services/server/history`
