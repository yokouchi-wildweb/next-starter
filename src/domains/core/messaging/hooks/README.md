# messaging/hooks

## Overview

連絡のドメインの hook(画面の流れとデータ)。**公開 = `hooks/index.ts` が出す物だけ**(D191): 部品・画面・fork はここから読み、中のファイルを直に import しない。index に無い物(二重送信の鍵を作る関数など)は公開ではない。
送る画面の hook は公開の部品として小さく分けてあり、上流の送るモーダル(自由連絡の `useMessageSendModal`、定義連絡の汎用のモーダルの `useDefinitionSendModal`)もこれだけで組む。fork は上流のモーダルを使わず、同じ hook と部品で目的に合う送る画面を組める(勧める)。どの画面にどれを使うかは ../components/README.md「送る画面の使い分け」、受け取り箱・好み・管理の一覧・テンプレート・テキストの編集の hook は同じ README のそれぞれの節。

## Usage

送る画面の公開の hook(どの送る画面にも共通の部品):

- 進行 `useSendSteps({ open, editing })`: 書く → 確認 → 結果(`toConfirm` / `backToEdit` / `finish(result)` / `reset`)。書きかけ(開いていて結果の段でなく `editing`)の間はページを離れる前に確かめ、Modal の `confirmOnClose` に渡す `closeConfirm` を返す
- 二重送信の鍵 `useIdempotencyKey()`: 開いた時に 1 つ、送るのに成功したら `renew`。鍵を作る関数は入口から出さない(鍵の持ち方を画面ごとに作らない)
- 表示例 `useSendPreview({ fetcher })`: 渡した口で「あなた宛ての表示例」を描いて持つ(`run` / `close`)
- 自分へのテスト送信 `useSendTest({ fetcher })`: 渡した口へ毎回新しい鍵を付けて送る
- 人数の見込み `useRecipientEstimate({ estimate, key })`: 渡した口(自由連絡 `estimateAdminRecipients` / 定義連絡 `estimateAdminDefinitionRecipients`)で全員・ロール・グループの宛先数を取って持つ(`request(input)` / `reset` / `estimate` / `overLimit` / `isEstimating`)。送る直前は `assertWithinLimit()`(上限を超えたら `overLimitText` の文で投げる)。表示は部品 `RecipientEstimateView`(common/SendConfirmView)。2 つのモーダルが同じこれを使う
- 送信チャンネルの初めの規則 `initialChannelsOff(channels, on)`(純粋な関数): on に無い物を外し、全部外れる時は外さない
- レイアウトの描き方のプレビュー `useLayoutPreview`(未入力の警告 `incompleteChannels` は `fieldRequiredIn` を渡した送信チャンネルに対して読む: 件名はメールがある時だけ必須、D211)、送信の詳細の住所 `dispatchDetailHref(一覧の住所, id)`

定義連絡を管理者が送る口(`/api/admin/messaging/definitions/**`):

- 選択肢 `useDefinitionSendOptions({ recordTarget } | { entry: "broadcast" }, enabled)`
- 送る `useDefinitionSend()`(鍵は呼び手が `useIdempotencyKey` で持って渡す)、表示例 `useDefinitionPreview()`・テスト `useDefinitionTest()` = 上の 2 つを定義連絡の口でつないだ物
- 汎用のモーダルの流れ `useDefinitionSendModal({ entry, onSent? })`: 上の hook を組んだ物(連絡定義の選択・送信チャンネルの固定・管理者の値・直せる欄・宛先・予約・全員・ロール・グループの人数の見込み `estimate` / `estimateOverLimit`・送る)。入れ物 `DefinitionSendModal` はこれを並べるだけ

予約した送信の直し(`PATCH /api/admin/messaging/dispatches/[id]`、D210):

- `useScheduledEdit({ dispatch, onSaved? })`: 入れ物 `ScheduledEditModal` の流れ(開く・書く → 確認 → 保存・時刻の検査 `scheduleErrorOf`・409 / 400 の文 `error`)。開いている間だけ直しの材料を読み、予約できる日数は材料から(門 `messagingBroadcast` に依らない)
  - 文面: `canEdit.content` が開の時、直せる欄だけ(`textFields` / `textControl` を `LayoutFields` へ。定義連絡の required = 欄なし)。送る `edits` は変えた欄だけ
  - 送信チャンネル: 材料の固定で off は出さない・on は外せない・free は選べる(`channels` / `toggleChannel` を `SendCategoryChannels` へ)。初めは送信の送信チャンネル、送る `channels` は集合が変わった時だけ一覧を全部(`sameChannelSet`・`scheduledEditChannelShape`)
  - `canEdit.content` が閉 = 予約の時刻だけ(`contentReason` = `DISPATCH_OPERATION_REASON_TEXT` の文)
  - 体は `scheduledEditInputOf(dispatch, { scheduledAt, edits?, channels? })` = 変えた物だけ(何も無ければ null)。宛先はどんな時も入らない(D98 D101)
  - 保存の後は送信 1 件のキーを返った送信で置き換え、送信のキー(直しの材料も)を読み直して `onSaved(送信)`
- `useScheduledEditOptions(dispatchId, enabled?)`: 直しの材料 `GET /api/admin/messaging/dispatches/[id]/edit-options`(レイアウト・直せる欄・欄の中身・送信チャンネルの固定・予約できる日数。時刻だけの送信は layout / values が null)、キー `scheduledEditOptionsKey(id)`

送った後と 1 人宛ての材料:

- 送信の結果 `useSendResults(dispatchId, { limit? })`: 届かなかった人(無限スクロール、カーソル)と送信チャンネルごとの数
- 受け取れる送信チャンネル `useRecipientChannels(userId, { message } | { category } | {})`

送信の詳細と利用者ごとの履歴(管理、カーソルの無限スクロール = `useInfiniteScrollQuery` の戻り値):

- 既読した利用者 `useDispatchReaders(dispatchId, { limit?, enabled?, observerOptions? })`: 時刻のある既読を既読の新しい順に(まとめて既読で読んだ人は並ばない、既読の数は集計の値、D210)。部品 `DispatchReaders` にそのまま渡す。dispatchId null = 取らない
- 利用者ごとの連絡の履歴 `useUserMessageHistory(userId, { limit?, enabled?, observerOptions? })`: 配達と、その利用者の受け取り箱に見える全員・ロール宛ての共有のお知らせ(`type: "sharedInApp"`、`status`・`sentAt` は null)を時刻の新しい順に(D215)。上流は画面を出さない(利用者の管理画面などに fork が置く)。行の形は ../services/server/history/README.md。userId null = 取らない

口の形は ../services/server/admin/README.md の API。

## Verification

- 送る画面の公開の hook: `hooks/sendHooks.test.tsx`
- 自由連絡の送るモーダルの流れ: `hooks/sendModalHooks.test.tsx`
- 定義連絡の汎用のモーダルの流れ: `hooks/definitionSendModal.test.tsx`
- 送信の詳細と利用者ごとの履歴: `hooks/dispatchViewHooks.test.tsx`
