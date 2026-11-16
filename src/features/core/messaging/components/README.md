# components（messaging の画面）

## Overview

core_ui の形: 流れとデータは hook（`hooks/index.ts` から）、部品（`common/<Part>`）は props だけ、入れ物（`components/<Name>`）が hook を呼んで部品を並べる。どれも公開: 入口だけを import する。fork は自分の画面（`_components/` の Screen）で入れ物か、部品 + hook を組む。client は `services/client/*Client.ts`（axios + `normalizeHttpError`）。

## Usage

### 本人の画面

- 受け取り箱 `/messages`（`src/app/(user)/(protected)/messages/`、門 `messagingInbox`、access authenticated、閉なら notFound）: Screen = 題「お知らせ」+ 入れ物 `InboxList`（`unreadOnly?`・`limit?`・`emptyText?`）。流れ `useInboxList(options)` → `{ query, unreadCount, opened, open, close, markAll, isMarkingAll }`
  - hook: `useInboxItems({ unreadOnly?, limit?, enabled?, revalidateOnFocus?, observerOptions? })`（`useInfiniteScrollQuery` のカーソル、`total` は読み込み済みの数）・`useInboxUnreadCount({ enabled? })` → `{ count }`・`useMarkInboxItemRead()` → `markRead(id)`・`useMarkAllInboxRead()` → `markAllRead()`（成功で未読の数を取り直す。一覧の印は呼び手が `updateItems` で）
  - 部品: `InboxItemRow`（`onOpen(item)`）・`InboxItemDetail`（題は包む Modal が持つ）・`InboxUnreadMark`
- 未読のモーダル: 入れ物 `InboxUnreadModal`、流れ `useInboxUnreadModal({ enabled?, paths? })`（住所 `isInboxModalPath`・ログイン・確かめた印 sessionStorage・古い順・見せたら既読・`next` / `skip`（全部既読）/ `close`）。上流の利用者の枠（`src/app/(user)/_layout/UserLayout.tsx`）が外枠の末尾に置く。**門 `messagingInbox` が閉なら hook は取りに行かず開かない**（`enabled` を渡しても）。開の間は `inbox.showUnreadModal`（既定 true）と `inbox.unreadModalPaths`（既定 `["/"]`）
- 通知の設定 `/mypage/account/notifications`（門 `messagingPreferences`、mypage のカード `src/features/core/user/mypageMenu/items/notifications.ts`）: 入れ物 `MessagePreferences`（`emptyText?`）= 上に「すべての連絡を止める」→ 経路の枠（経路まるごと・宛先の無い経路は連携の案内）→ 種別の枠（見出しだけ、種別のスイッチは出さない）→ グループの見出し → 種類の行（その経路の 1 マス）。種類まるごとの切り替えは種類が最初に出る経路の行に 1 回だけ
  - hook `useMessagePreferences({ enabled? })` → `{ preferences, isLoading, error, retry, setCell, setCategoryWide, setChannelWide, setAll, setKind, pendingKey }`（変更の応答を SWR に書く。`pendingKey` = `<種類>:<経路>` / `<種類>:*` / `*:<経路>` / `*:*` / `kind:<種別>`）
  - 広い行で止まる種類は切で理由を出す（`preferenceViaReason`）。種類・種別・経路まるごとの下は押せてサーバーが書き分ける。全部の停止の間は全部の下のマスと広い切り替えを押せない（経路の枠と種類まるごとは `stoppedByAll?` に `allOptedOut` を渡すと止まった状態で見せる）
  - 部品: `PreferenceChannelSection`・`PreferenceKindFrame`・`PreferenceGroupHeading`・`PreferenceCategoryRow`・`PreferenceCategoryWideToggle`。種別の枠の表示名は `constants/kindLabels.ts` の `MESSAGE_KIND_LABELS`（仮）
- 配信停止の確認 `/unsubscribe`: 入れ物 `Unsubscribe`（確認 `UnsubscribeConfirm` → `useUnsubscribe(token)` の `submit` → 結果 `UnsubscribeResult`: 止めた + 通知の設定への案内 / リンクが正しくない）

### 管理の画面（ページは 4 つ、作る・直す・送るはモーダル）

- メニューの項目は 1 つ（マーケティング > メッセージ管理、`/admin/messaging`。画面の見出しも同じ）。送信一覧・テンプレート・文言の編集の 3 画面はヘッダー中央のタブ `AdminMessagingSectionTabs`（`variant?: "body" | "header"`）で行き来する。タブの中身は `lib/adminSectionTabs.ts` の `buildMessagingAdminSectionTabs(enabled)` だけが決め、門が閉の画面（`messagingTemplates` / `messagingOverrides`）のタブは出さない。回の詳細にはタブを出さない
- 送った回 `/admin/messaging`（門 `messagingDispatches`、タブ 送信一覧）: 入れ物 `AdminDispatchList`（`initialFilters?`・`limit?`）= 絞り込み（期間・種別 7 つ・カテゴリー（種別を選んだ後だけ）・経路・状態、`useAdminDispatchFilters`）+ 行 `DispatchRow` の無限スクロール。上に「新しく送る」（門 `messagingBroadcast`）
- 一覧の選択と一括操作（D88 D95 D98）: `RecordSelectionList`（`@/lib/tableSuite`）に `DispatchRow` を載せる。選択の出し方は `toggle`（バーの「選択モード」が入の間だけチェック）、削除した回は選べない。操作は受け口 `adminBulkActions` の項目（上流の既定 = `adminBulkActions/delete.tsx`: 確認の Dialog に見込み `DispatchDeleteSummary`（`useDispatchDeleteSummary`）→ `useBulkDeleteDispatches`、100 件まで）。終わったら一覧を取り直す。状態の絞りの「削除済み」（`constants/dispatchFilters.ts` の `DISPATCH_FILTER_DELETED`）= 削除した回だけ（`deleted: "only"`）
- 回の詳細 `/admin/messaging/[id]`: 入れ物 `AdminDispatchDetail`（`dispatchId`）= 中身（状態・件名 / 題・種別とカテゴリー・送り元・宛先のグループの名前・経路ごとの数・送った人・本文 `MessagePreview`）+ 「同じ内容で送る」+ 「続きを送る」（processing だけ）+ 回の操作 `DispatchOperations`（取り消す・取り下げる・再送。できない操作は押せず理由、確認の Dialog）+ 配達 `DeliveryRow`（状態・経路で絞る）。流れは `useAdminDispatchDetail(dispatchId, { limit?, observerOptions? })`（中で `useAdminDispatch`・`useAdminDispatchDeliveries`・`useContinueDispatch`・`useCancelDispatch`・`useRetractDispatch`・`useResendDispatch`）
- 運営する人に鍵を見せない: 種別・カテゴリー・経路・送り元は表示名、定義の鍵・グループの id は出さない。送った人 = `actorName`、配達の行 = `userName`、表に無い失敗の符号・理由・状態は「送れませんでした(理由は記録にあります)」「そのほかの理由」「そのほかの状態」
- テンプレート `/admin/messaging/templates`（門 `messagingTemplates`、タブ テンプレート）: 入れ物 `AdminMessageTemplateList` = 状態の絞り + 「新しく作る」+ 行。モーダル `AdminMessageTemplateModal`（`open`・`onOpenChange`・`templateId?`（null = 作る）・`onChanged?`）= `TabbedModal` の 文言 / 変数 / 版の履歴、下の帯 取り下げ・公開（ConfirmPopover）・保存。作った後は同じモーダルで直す形に変わる
  - 内容のタブは 2 つの欄（`MessageEditorLayout`: 左 = 今の経路のプレビュー `ChannelPreview`、右 = 経路のタブと欄）。メールは描いた HTML が無いので欄から組んだ形
  - 部品: `TemplateChannelFields`（`ChannelFields` の包み。欄は選択肢の `channels[].fieldMeta` から）・`TemplateVariablesEditor`・`TemplateVersionList`・`TemplateStatusBadge`・`AllowedKeysHint`
  - hook: `useMessageTemplates`・`useAdminMessageTemplateList({ observerOptions? })`（`modal.openNew()` / `openTemplate(id)` / `onChanged`: 作った = 先頭から取り直す・ほか = 行を置き換える）・`useMessageTemplate(id)`・`useMessageTemplateOptions(enabled?)`・`useMessageTemplateVersions(id)`・`useMessageTemplateVersion(id, version)`・`useMessageTemplateModal`・`useMessageTemplateForm`（`dirty`・`closeConfirm`・`allowedKeys`・`unknownKeys`・`save` / `publish` / `archive`）。開き直しで書く欄を作り直す番号は `@/hooks/useModalSession`
- システム通知 `/admin/messaging/overrides`（門 `messagingOverrides`、タブ システム通知）: 入れ物 `AdminMessageOverrideList` = 直せる連絡の行（名前・経路のバッジ・種類 / カテゴリー・数）。モーダル `AdminMessageOverrideModal`（`open`・`onOpenChange`・`messageKey | null`、幅 1200px）= 使える鍵の案内 + 2 つの欄（左 = 今の経路のプレビュー、メールは `POST /[key]/preview` の描いた HTML、右 = 経路のタブと欄ごとの編集。保存・既定に戻すは欄 1 つずつ）。欄に入るとプレビューのその場所に枠（`data-field` の印）
  - 部品: `OverrideFieldEditor`（入力は `ChannelFieldInput`、`overrideFieldLabel(path)`）・`OverrideFieldMarks`・`AllowedKeysHint` / hook: `useMessageOverrides`・`useAdminMessageOverrideList()`・`useMessageOverride(key)`・`useMessageOverrideEditor(key)`
- 連絡の編集の共通部品（D80 D83）: `ChannelFields` / `ChannelField` / `ChannelFieldInput`（経路の受け口の `fieldMeta` から欄: line・url = 1 行（改行は空白）、text = 複数行、select、image = 用途 `notification.image` のアップロード、`list` = 1 つずつ + 追加・削除、`parts` = 鍵ごと。欄に入ると `onFocusField(path)`）・`ChannelPreview`（email = 受信一覧の行 + 描いた HTML か欄から組んだ形、inApp = 一覧のカード + 開いた時、line = 吹き出し、`previewComponent` が受け口 `channelPreviews` にあればその部品、無ければ欄の値。`focusedPath` の場所に枠）・`MessageEditorLayout`（左 プレビュー / 右 経路のタブ、狭い画面は入力が上）
- 書きかけのモーダル: 閉じる前は `confirmOnClose`、ページの移動は `@/lib/unsavedGuard`
- loader は認可（`roleCategories: ["admin"]`）と門（閉なら notFound）だけ

### 送るモーダル（MessageSendModal）

- 入れ物 `MessageSendModal`（`mode`・`label?`・`triggerVariant?`・`disabled?`・`icon?`・`onSent?(result)`・`dispatchBasePath?`）: 開くボタン + モーダル。fork は自分の画面にもそのまま置ける
  - `mode`: `{ type: "new" }` / `{ type: "sameAs", dispatch }`（文面・カテゴリー・宛先の形を写す）/ `{ type: "bulk", target, recordIds, recordNoun, defaults?, defaultCategory?, source? }`（管理一覧の一括操作）。new・sameAs の口は門 `messagingBroadcast` が開の時だけ、bulk は門の外
- 流れ: 宛先 → 「テンプレートから読み込む」（任意、門 `messagingTemplates` が開で公開中の物がある時）→ カテゴリーと経路の絞り → 文言 → 予約（bulk 以外）→ プレビュー・自分へのテスト送信 → 見込み → 確認 → 送る。読み込むと今の公開版の欄と画像を写し（書きかけの上なら確かめる `pendingLoad`）、「テンプレートを外す」は今の文をその場で書いた文として残す
- 宛先 `SendTargetPicker`: 全員・ロール・グループ（`groups` = 使用中のグループを名前と種類で。空 = 門 `userGroups` が閉かグループが無い = 選択肢ごと出さない）・選んだ利用者 / bulk は選んだ記録の数。見込みが人数の上限を超えたら理由を出して送れない（`estimateOverLimit`）
- sameAs の写し: 宛先は回の形（選んだ利用者は `targetUserIds`、グループは同じグループ。今は選べないグループは選んでいない形 + 知らせ `targetNote`、全員に広げない）/ 文言はテンプレートの回なら今の公開版、直して送った回は直した文言。テンプレートが公開中でなければその場で書く形 + `sameAsNote`
- 部品: `SendTemplatePicker`・`SendContentFields`・`SendTargetPicker`・`SendCategoryChannels`・`SendLegalNotice`（法の義務の告知はメールを含める注意、いつも出しメールがオフなら警告の色）・`SendSchedule`・`SendConfirmView` / `SendResultView`・`MessagePreview`
- hook `useMessageSendModal({ mode, onSent? })`: 段（edit → confirm → done）・`draft`・`target` / `setTarget` / `targetError` / `groups` / `targetNote`・カテゴリー・経路・予約・プレビュー・テスト・見込み・送る（new / sameAs = `/send`、bulk = `/bulk-send`）・二重送信を防ぐ鍵（開くたびに 1 つ）・`dirty` / `closeConfirm`。選択肢は開いている間だけ（`useAdminSendOptions` / `useAdminBulkSendOptions`）。純粋な関数 `scheduleErrorOf` / `templateVarsForInput` / `isBlankChannel` / `draftFromTemplate` / `initialDraftOf` / `initialTargetOf` / `overLimitText` / `sameAsNoteOf`

### 管理一覧の一括送信（AdminBulkSend）

受け口 `adminBulkActions` の項目を作る関数。対にサーバーの受け口 `bulkSendTargets/<名前>.ts` が要る（../services/server/admin/README.md）。

```tsx
// src/features/<domain>/adminBulkActions/notify.tsx
import { bulkMessageAction } from "@/features/core/messaging/components/AdminBulkSend";

export const bulkAction = bulkMessageAction(
  { key: "notify", order: 100 },
  { target: "<bulkSendTargets の key>", recordNoun: "発送リクエスト", defaultCategory: "operatorDirect" },
);
```

- options（`BulkMessageActionOptions`）: `target`・`recordNoun`・`label?`（既定「一括送信」）・`defaults?`（`{ content }` = 書く欄の初期値）・`defaultCategory?`（既定 `operatorDirect`）・`source?`・`disabled?`・`onSent?(result)`
- 上流の使い手: `bankTransferReview/adminBulkActions/sendEmail.tsx`

## Verification

- `pnpm test src/features/core/messaging/components src/features/core/messaging/hooks`
- 画面の確かめは `/devcheck`
