# admin（管理の送信と送った回の読む口）

## Overview

管理者が送る・一括送信する・送った回を読む・回を操作する口（`/api/admin/messaging/**`）。管理者だけ: API の access `roleCategories: ["admin"]` と service の `assertAdmin`（監査の文脈の操作者の役割の分類を引く。`runAsSystem` の system も通す）の両方。操作は監査ログに 1 行。画面は ../../../components/README.md。

門:

- `messagingDispatches`（既定 開）: 回の読む口・回の操作・続きを送る（`/api/admin/messaging/dispatches/**`）と画面 `/admin/messaging`
- `messagingBroadcast`（`dependsOn: ["messagingDispatches"]`、既定 閉）: `/api/admin/messaging/send/**` と送るモーダルの口（回の一覧「新しく送る」・回の詳細「同じ内容で送る」。部品が `useGate` で出し分ける）。閉でも送る口と cron の予約の拾いは動く
- 一括送信 `/api/admin/messaging/bulk-send/**` はどの門にも入れない（管理一覧の一括操作が使うので、画面を閉じても送れる）

## API

### 管理の送信の形（freeText.ts・../sendMessage/templateDefinition.ts、D117・D125）

- どの送信も『テンプレートを選んで送る』1 つの流れ: 出どころ `template` = 白紙のシステムテンプレート `{ system: 鍵 }`（その場で書く連絡、受け口 `messaging/templates`）か DB のテンプレート `{ id, version }` + 欄の中身 `values`（ひな形の欄、汎用のお知らせ notice = 件名 + ブロックの並び）+ 直した印 `edited?`（DB のテンプレートだけ）。管理用の連絡の定義は無い
- **カテゴリーの種別と宛先の組は種別の性質 `adminFreeText`**: announcement = 全員・ロール・グループ・選んだ利用者 / direct = 選んだ利用者・グループ・一括（D109）/ promotion = 全部。誤りは 400。白紙はカテゴリーと同じ種別の物だけ（400）
- 宛名は `{{displayName}}`（enricher、種別 announcement・direct・promotion に当たる）。決まった挨拶・足元の文は無い（要るなら管理者が書く）。見た目は notice の描き方の `.replace` で替えられる
- 回は `message_key` null + 出どころ（`system_template` か `template_id`・`template_version`・`template_edited`）。前の管理の定義の鍵で送った回（`messaging.adminMessage` など）も当時の鍵・種別・カテゴリーで読める
- fork のコードからは `messagingService.sendTemplateMessage`（同じ形、../sendMessage/README.md「fork のコードから管理の送信」）

### `/api/admin/messaging/send/**`（send.ts、門 `messagingBroadcast`）

- `POST /send`（`AdminSendInputSchema`）: `template`（`{ system }` か `{ id, version }`）・`values`（ひな形の欄の中身）・`edited?`・`vars?`（専用の埋め込み情報の値 `{ 鍵: 値 }`、DB のテンプレートだけ。版の宣言の型で検査）・`category`（必須、種別 announcement・direct・promotion）・`channels?`（カテゴリーの経路の中の絞り、外・空は 400）・`target`・`scheduledAt?`（ISO 8601）・`idempotencyKey?`・`reason?` → `{ dispatchId, status, queuedCount, channelCounts }`。知らない鍵は 400。送り元 `messaging.adminSend`
  - `target` = `{ type: "all" }` / `{ type: "role", roles }` / `{ type: "group", groupId }`（使用中のユーザーグループ。門 `userGroups` が閉・無い = 404、しまった・壊れた・人数の上限 = 409）/ `{ type: "users", userIds }`（10,000 人まで）
- `POST /send/preview`: 経路ごとの差し込み済みの欄と経路の `preview`（メールは送る時と同じ HTML）。見本の受信者 = 操作した管理者、テンプレートは今の公開版
- `POST /send/estimate` `{ target }` → `{ count, fixedAtSend: true, memberLimit?, overLimit? }`（全員・ロールは数、グループは一員の数と上限、選んだ利用者は居る人の数。停止・宛先なしを引く前）
- `POST /send/test`: 宛先 = 操作した管理者だけ・`is_test`（集計と分母から外す）。予約しない。システムの操作は 400
- `GET /send/options`: 有効な経路 `{ key, label }`・ロール・`groups`（使用中のグループ `{ id, label, kindLabel }` を名前の順に 200 件、門 `userGroups` が閉なら空。id は値としてだけ使い画面に出さない）・公開したテンプレート（版の番号・種類・文言・変数）・`categories` `{ key, label, kind, channels, defaultChannels, targets, systemTemplate, catalog }`（`defaultChannels` = 送信方法の最初の入（カテゴリーの `defaultChannels`、無ければ `channels`）、`systemTemplate` = その種別の既定の白紙 `{ key, label, layout, values }` か null、`catalog` = そのカテゴリーで書ける埋め込み情報 = 共通 + 当たる enrichers）・`systemTemplates`（送れる種別のシステムテンプレート全部 `{ key, kind, label, layout, values, vars }`、D119）・`layouts`（白紙・システムテンプレートと並べたテンプレートが使うひな形の欄の宣言 `{ key, label, version, fields }`、門 `messagingTemplates` の外）・`maxScheduleDays`
- 監査: `messaging.dispatch.sent` / `messaging.dispatch.scheduled` / `messaging.dispatch.test_sent`（対象 `message_dispatch`、出どころ `source` = `system`（`systemTemplate`）か `template`（`templateId`・`templateVersion`・`edited`）、本文の値は残さない）

### `/api/admin/messaging/bulk-send`（bulkSend.ts、門の外）

- `GET`: `{ channels, categories, templates, layouts }`（経路は送る口の選択肢と同じ、カテゴリーは bulk で送れる種別で `/send/options` と同じ形（白紙・`catalog`）、テンプレートは門 `messagingTemplates` が開の時だけ、`layouts` = 白紙と並べたテンプレートのひな形の欄の宣言）
- `POST`: 宛先 `{ userIds }` か `{ target, recordIds }`（10,000 人まで）、中身は `/send` と同じ `template`・`values`・`edited?`・`vars?`・`category`・`channels?`、`idempotencyKey?`（8〜128 文字）・`source?`（既定 `<target>.bulk`、userIds なら `messaging.adminBulk`）・`reason?`・`isTest?`。予約は無い（`scheduledAt` は 400）。知らない鍵は 400
  - → `{ dispatchId, status, counts: { recipientCount, channelCounts, queuedCount }, afterSend: { ok: true } | { ok: false, error } | null }`
- `POST /preview`・`POST /test`: `/send` と同じ（テストの送り元 `messaging.adminBulk.test`）
- 対象の受け口 `bulkSendTargets/<名前>.ts`（`MessageBulkSendTarget`、`types.ts`）: `key`・`label`・`enabled?`・`resolveUserIds(recordIds)`・`afterSend?({ recordIds, dispatchId, counts, values, template })`（受け付けの直後に 1 回。`values` = 差し込む前の欄の中身、`template` = `{ system }` か `{ id, version, edited }`。投げても送信は戻らず結果と監査に失敗を残す）。上流 `bankTransferReview`（振込審査 → 申告した利用者、メールを送ったら管理メモに「YYYY/MM/DD「件名」メール送付」）
- 監査: `messaging.dispatch.bulk_sent`（送り元・種別・経路・数・状態・対象の鍵・afterSend）

### 回の読む口（readDispatches.ts・dispatchDto.ts、門 `messagingDispatches`）

汎用 CRUD の search には乗せない。

- `GET /dispatches/categories` → `{ items: { key, label, kind }[] }`（カテゴリーの受け口の全部）
- `GET /dispatches`: `from`・`to`（作った時刻）・`kind`・`category`・`channel`・`status`・`deleted`（`exclude` 既定 = 削除した回を出さない / `only` / `include`）・`cursor`・`limit`（既定 50、最大 100）→ `{ items: AdminDispatchSummary[], nextCursor }`（新しい順、keyset）。定義の鍵では絞らない
- `GET /dispatches/[id]` → `AdminDispatchDetail`: 回の中身・`operations`（下）・`targetGroup` `{ id, name }`（グループ宛ての回、id は値だけ。門 `userGroups` が閉なら名前は取れない）・「同じ内容で送る」が写す `templateEdited`・`templateDeleted`（テンプレートから送った回でそのテンプレートが消された = 版の番号はあり `templateId` が null、D137。画面は「削除されたテンプレート」と出し、同じ内容で送るはテンプレートにつながず中身だけ写す。送り直しは消したテンプレートの出どころのまま新しい回を作る）・`content`（回の中身 `{ layout, layoutVersion, values }`、欄の中身を残した回だけ。送るモーダルが写す: テンプレートの回は今の版を読み込み直して送った回なら直した文、ほかは種別の白紙のひな形と同じ時に values）・`embeddedValues`（専用の埋め込み情報の値、送るモーダルが写す）・`targetUserIds`（選んだ利用者の回の利用者 id。10,000 人を超える・ほかの宛先は null）
- `GET /dispatches/[id]/preview` → `AdminDispatchPreview` `{ dispatchId, layout, cannotRender, channels }`（`dispatchPreview.ts`）: 送った物を見せる。回だけから描く（`resolvedOfDispatch`、送った版を今の版へ読み替え、どのひな形でも）。差し込み = 回の `vars` ∪ `embedded_values` ∪ 共通の文脈（受信者ごとの値は字のまま）。経路ごとに `{ key, label, html, text, layout, values, summary, cannotRender }`（メール = 経路の `preview` の HTML、お知らせ = ひな形の描き方の材料）。中身を残していない回（`values` が無い）・ひな形が無い・版を読めない回は `cannotRender` に理由で経路は空
- `GET /dispatches/[id]/deliveries`: `status`・`channel`・`cursor`・`limit` → `{ items: AdminDeliveryRow[], nextCursor }`（古い順）
- 返す項目は `dispatchDto.ts` 1 か所: 鍵・種別・種類・送り元（`sourceLabel`）・状態・経路・件名 / 題・数・送った人（`actorName`、system は「システム」）・時刻・テストかは常に / 回の本文（rendered）と vars は記録の段が vars・full の時 / 配達の本文は full の時だけ / 宛先は出す（`userName`）/ provider の生の値と `last_error` の文は出さない（符号 `errorCode`、文は `constants/deliveryErrors.ts`）。`message_key` が null の前の回は件名・題・本文を `rendered` から

### 回の操作（operations.ts、`DELETE /dispatches/[id]`・`/dispatches/bulk-delete`・`/dispatches/delete-summary`・`/dispatches/[id]/resend`）

どの操作も回の行を `FOR UPDATE` で持った 1 つの取引（`operationsStore.ts`）。できない操作は 409 と理由の符号（DomainError の `code`）。符号と文は `constants/dispatchOperations.ts`（`DISPATCH_OPERATION_REASONS` / `DISPATCH_OPERATION_REASON_TEXT`）の 1 か所で、回の 1 件の `operations`（`canDelete` / `canResend` / `canContinue` ごとに `{ allowed, reason }`、canResend は `mode`・`failed`・`unknown` も、判定 `operationFlags`）と 409 の文が同じ物を読む。

- `DELETE /dispatches/[id]`（D88、予約の取り消し・取り下げを置き換えた）: どの状態の回も消す。取引で `queued` の配達を `canceled`・送り直しの予定を止め、展開を終わりにして `deleted_at`（**status は変えない**。予約の回も cron が拾わない）。commit の後に消せる経路の `remove`（経路の項目、上流は inApp = お知らせの行・共有の行・画像を外す）を呼ぶ。送ったメール・LINE は残る。削除済みにもう一度 = `remove` だけ呼び直す（`alreadyDeleted: true`、監査なし）。`remove` の失敗は `failedChannels` に残す（もう一度消せば呼び直す）→ `AdminDeleteResult { dispatchId, alreadyDeleted, canceledDeliveries, removed: [{ channel, removed }], failedChannels }`。戻す操作は無い。監査 `messaging.dispatch.deleted`
- `POST /dispatches/bulk-delete` `{ ids }`（1〜100 件、`ADMIN_DELETE_MAX_IDS`）→ `{ results: [{ dispatchId, ok: true, result } | { dispatchId, ok: false, reason, message }] }`。回ごとに 1 件の削除と同じ（回ごとの取引・監査）
- `POST /dispatches/delete-summary` `{ ids }`（同じ上限、書かない）→ `{ found, deleted, scheduled, unsent, channels: [{ key, label, removable, sent }], sharedInbox }`。`removable` = 経路が `remove` を持つ（受け取った人から消える）/ false = 届いた物は残る。`sharedInbox` = 全員・ロール宛ての共有のお知らせの行を持つ回の数（配達の行が無い分）
- `POST /resend` `{ includeUnknown? }`: required でない回の `failed` の配達だけ（`unknown` は `includeUnknown: true` の時だけ、回の `metadata.possibleDuplicate` に残す）。履歴 `metadata.resends`
  - record `vars` / `full`: 同じ回のまま行を `queued` に戻す（attempts 0、冪等の鍵は同じ）。回は `processing` に戻り、最初の 1 束を続きを送るで、残りは cron。`sending` の行は触らない
  - record `meta`: 回の vars の写しで失敗の宛先へ新しい回（`metadata.resendOf`、テンプレートは同じ版、送った id は `metadata.resentDeliveryIds`）。写しが無い = `no_input_copy`
  - 409: `secret`（送り手のコードからもう一度送る）・`required`・`definition_missing`・`deleted`・`cancelled`・`scheduled`・`no_failed`。監査 `messaging.dispatch.resent`

### 続きを送る・利用者ごとの履歴

- `POST /dispatches/[id]/continue`（continueSending.ts）: 1 束だけ進める（展開 1 束 + 送る 1 束 + 閉じられるなら閉じる）。`processing` 以外は 409 → `{ expanded, claimed, sent, failed, completed }`。監査 `messaging.dispatch.continued`
- `messagingService.listUserMessageHistory(userId, { cursor, limit })`（`../history`）→ `{ items, nextCursor }`: その利用者の配達（1 行 = 1 経路）を回と結び新しい順。`dispatchId`・`messageKey`・`kind`・`source`・`channel`・`status`・`headings`・`createdAt`・`sentAt`（本文・宛先・provider の値は出さない）。server だけ・route なし・管理者を確かめない（呼び手が読める人を決める）。全員・ロールの共有のお知らせと消した利用者の配達は出ない

## Verification

- `pnpm test src/features/core/messaging/services/server/admin`（`admin` / `send` / `operations`）と `pnpm test src/features/core/messaging/services/server/history`
