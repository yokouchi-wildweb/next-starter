# components（messaging の画面）

## Overview

core_ui の形: 流れとデータは hook（`hooks/index.ts` から）、部品（`common/<Part>`）は props だけ、入れ物（`components/<Name>`）が hook を呼んで部品を並べる。どれも公開: 入口だけを import する。fork は自分の画面（`_components/` の Screen）で入れ物か、部品 + hook を組む。client は `services/client/*Client.ts`（axios + `normalizeHttpError`）。

## Usage

### 本人の画面

- 受け取り箱 `/messages`（`src/app/(user)/(protected)/messages/`、門 `messagingInbox`、access authenticated、閉なら notFound）: Screen = 題「お知らせ」+ 入れ物 `InboxList`（`unreadOnly?`・`limit?`・`emptyText?`）。流れ `useInboxList(options)` → `{ query, unreadCount, opened, detail, isDetailLoading, detailError, open, close, markAll, isMarkingAll }`（一覧は題と本文の頭だけ、開いた行の詳しい表示は `useInboxItemDetail(id)` = `GET /api/me/messaging/inbox/[id]`（ひな形・版・欄の中身・お知らせの欄の宣言 `fields`）。取れるまでは日時と読み込み中）
  - hook: `useInboxItems({ unreadOnly?, limit?, enabled?, revalidateOnFocus?, observerOptions? })`（`useInfiniteScrollQuery` のカーソル、`total` は読み込み済みの数）・`useInboxUnreadCount({ enabled? })` → `{ count }`・`useMarkInboxItemRead()` → `markRead(id)`・`useMarkAllInboxRead()` → `markAllRead()`（成功で未読の数を取り直す。一覧の印は呼び手が `updateItems` で）
  - 部品: `InboxItemRow`（`onOpen(item)`、題と本文の頭）・`InboxDetailModal`（受け取り箱の表示はこれ 1 つ: 一覧で押した時も未読のモーダルも。`open`・`onOpenChange`・`item`・`detail?`・`loading?`・`showCloseButton?`・children = 中身の下の操作）・`InboxItemDetail`（`item`・`loading?` = 日時 + `InboxLayoutView`、題は包む Modal が持つ）・`InboxUnreadMark`・`InboxLayoutView`（ひな形のお知らせの描き方 `layoutInApps` > 汎用 `GenericInAppView`（`fields` の宣言の順に欄の型とブロックの種類ごとに描く）。描けない行は「このお知らせは表示できません」、要約は描かない（D120）。管理画面のお知らせのプレビュー `LayoutPreview` も同じ部品）
- 未読のモーダル: 入れ物 `InboxUnreadModal`、流れ `useInboxUnreadModal({ enabled?, paths? })`（住所 `isInboxModalPath`・ログイン・確かめた印 sessionStorage・古い順・見せたら既読・`next` / `skip`（全部既読）/ `close`）。上流の利用者の枠（`src/app/(user)/_layout/UserLayout.tsx`）が外枠の末尾に置く。**門 `messagingInbox` が閉なら hook は取りに行かず開かない**（`enabled` を渡しても）。開の間は `inbox.showUnreadModal`（既定 true）と `inbox.unreadModalPaths`（既定 `["/"]`）。表示は一覧の詳細と同じ `InboxDetailModal`（1 件ずつ詳しい表示を取ってひな形で描く、下にスキップ・次へ・確認完了と n/N。hook が `detail` / `isDetailLoading` を返す）
- 通知の設定 `/mypage/account/notifications`（門 `messagingPreferences`、mypage のカード `src/features/core/user/mypageMenu/items/notifications.ts`）: 入れ物 `MessagePreferences`（`emptyText?`）= 上に「すべての連絡を止める」→ 経路の枠（経路まるごと・宛先の無い経路は連携の案内）→ 種別の枠（見出しだけ、種別のスイッチは出さない）→ グループの見出し → 種類の行（その経路の 1 マス）。種類まるごとの切り替えは種類が最初に出る経路の行に 1 回だけ
  - hook `useMessagePreferences({ enabled? })` → `{ preferences, isLoading, error, retry, setCell, setCategoryWide, setChannelWide, setAll, setKind, pendingKey }`（変更の応答を SWR に書く。`pendingKey` = `<種類>:<経路>` / `<種類>:*` / `*:<経路>` / `*:*` / `kind:<種別>`）
  - 広い行で止まる種類は切で理由を出す（`preferenceViaReason`）。種類・種別・経路まるごとの下は押せてサーバーが書き分ける。全部の停止の間は全部の下のマスと広い切り替えを押せない（経路の枠と種類まるごとは `stoppedByAll?` に `allOptedOut` を渡すと止まった状態で見せる）
  - 部品: `PreferenceChannelSection`・`PreferenceKindFrame`・`PreferenceGroupHeading`・`PreferenceCategoryRow`・`PreferenceCategoryWideToggle`。種別の枠の表示名は `constants/kindLabels.ts` の `MESSAGE_KIND_LABELS`（仮）
- 配信停止の確認 `/unsubscribe`: 入れ物 `Unsubscribe`（確認 `UnsubscribeConfirm` → `useUnsubscribe(token)` の `submit` → 結果 `UnsubscribeResult`: 止めた + 通知の設定への案内 / リンクが正しくない）

### 管理の画面（ページは 4 つ、作る・直す・送るはモーダル）

- メニューの項目は 1 つ（マーケティング > メッセージ管理、`/admin/messaging`。画面の見出しも同じ）。送信一覧・テンプレート・文言の編集の 3 画面はヘッダー中央のタブ `AdminMessagingSectionTabs`（`variant?: "body" | "header"`）で行き来する。タブの中身は `lib/adminSectionTabs.ts` の `buildMessagingAdminSectionTabs(enabled)` だけが決め、門が閉の画面（`messagingTemplates` / `messagingOverrides`）のタブは出さない。回の詳細にはタブを出さない
- 送った回 `/admin/messaging`（門 `messagingDispatches`、タブ 送信一覧）: 入れ物 `AdminDispatchList`（`initialFilters?`・`limit?`）= 絞り込み（期間・種別 7 つ・カテゴリー（種別を選んだ後だけ）・経路・状態、`useAdminDispatchFilters`）+ 行 `DispatchRow` の無限スクロール。上に「新しく送る」（門 `messagingBroadcast`）
- 一覧の選択と一括操作（D88 D95 D98）: `RecordSelectionList`（`@/lib/tableSuite`）に `DispatchRow` を載せる。選択の出し方は `toggle`（バーの「選択モード」が入の間だけチェック）、削除した回は選べない。操作は受け口 `adminBulkActions` の項目（上流の既定 = `adminBulkActions/delete.tsx`: 確認の Dialog に見込み `DispatchDeleteSummary`（`useDispatchDeleteSummary`）→ `useBulkDeleteDispatches`、100 件まで）。終わったら一覧を取り直す。状態の絞りの「削除済み」（`constants/dispatchFilters.ts` の `DISPATCH_FILTER_DELETED`）= 削除した回だけ（`deleted: "only"`）
- 回の詳細 `/admin/messaging/[id]`: 入れ物 `AdminDispatchDetail`（`dispatchId`）= 中身（状態・件名 / 題・種別とカテゴリー・送り元・宛先のグループの名前・経路ごとの数・送った人・本文）。本文は回の中身（ひな形と欄の中身）を残した回なら `GET /dispatches/[id]/preview` を `LayoutPreview`（経路のタブ）で描く（メール = 送った HTML、お知らせ = ひな形のお知らせの描き方、描けなければ理由）、前の形の回は残した本文 + 「同じ内容で送る」+ 「続きを送る」（processing だけ）+ 回の操作 `DispatchOperations`（取り消す・取り下げる・再送。できない操作は押せず理由、確認の Dialog）+ 配達 `DeliveryRow`（状態・経路で絞る）。流れは `useAdminDispatchDetail(dispatchId, { limit?, observerOptions? })`（`preview` = ひな形・経路のタブの値・選んだ経路の描く物・`cannotRender`・読み込み中。中で `useAdminDispatch`・`useAdminDispatchDeliveries`・`useContinueDispatch`・`useCancelDispatch`・`useRetractDispatch`・`useResendDispatch`）
- 運営する人に鍵を見せない: 種別・カテゴリー・経路・送り元は表示名、定義の鍵・グループの id は出さない。送った人 = `actorName`、配達の行 = `userName`、表に無い失敗の符号・理由・状態は「送れませんでした(理由は記録にあります)」「そのほかの理由」「そのほかの状態」
- テンプレート `/admin/messaging/templates`（門 `messagingTemplates`、タブ テンプレート）: 入れ物 `AdminMessageTemplateList` = 状態の絞り + 「新しく作る」+ 行（種別 / カテゴリー、システムテンプレートは「システム(読むだけ)」の印）。モーダル `AdminMessageTemplateModal`（`open`・`onOpenChange`・`templateId?`（null = 作る）・`onChanged?`）= `TabbedModal` の 内容 / バージョン履歴（変数のタブは無い）。内容 = 左 ひな形の選択（一番上）+ `LayoutPreview`（経路のタブ、未入力は仮の文）、右 名前・説明・種別 →（カテゴリー: その種別に 2 つ以上の時だけ）・`EmbeddedInfoTags` +『専用の埋め込み情報を管理』（`TemplateEmbeddedInfoModal`）・`LayoutFields`。ひな形を替えると中身があれば確かめて消す。下の帯 アーカイブ・保存（ConfirmPopover、保存 = 作る / 直す → 公開で新しいバージョン、同じ中身なら「変更はありません」）。システムテンプレート・アーカイブ済みは読むだけ。流れ = hook `useMessageTemplateModal`・`useMessageTemplateForm`（種別・カテゴリー・ひな形・中身・専用の宣言の書きかけと検査）・`useLayoutPreview`・`useEmbeddedInfoTags`
  - 部品 `LayoutPreview`（props だけ: `layout`・`channels`・`channel`・`onChannelChange`・`content`（選んだ経路の `{ html?, text?, title?, values?, summary?, fields?, cannotRender? }`）・`loading`・`error`。メール = 送る HTML の iframe、お知らせ = 受け取り箱の詳細と同じ `InboxLayoutView`（ひな形のお知らせの描き方 > 汎用（`fields` があれば）、要約は描かない）、ほかの経路で描き方が無ければ要約の文（LINE など文を送る経路はこれがそのまま送る文）。取得はしない: テンプレート・送る画面は hook `useLayoutPreview`（未入力の欄を仮の文で埋め、`POST /api/admin/messaging/layouts/preview` を 400ms 待って呼ぶ）、ほかの画面は自分の取得元から `content` を渡す）・`TemplateEmbeddedInfoModal`（専用の宣言の行: 別名・鍵・型・選択肢・既定値・必須、「適用」で hook が検査）・`TemplateVersionList`（`layouts` でひな形と欄の見出しを出す）
  - 部品: `TemplateVersionList`・`TemplateStatusBadge`・`TemplateEmbeddedInfoModal`
  - hook: `useMessageTemplates`・`useAdminMessageTemplateList({ observerOptions? })`（`modal.openNew()` / `openTemplate(id)` / `onChanged`: 作った = 先頭から取り直す・ほか = 行を置き換える）・`useMessageTemplate(id)`・`useMessageTemplateOptions(enabled?)`・`useMessageTemplateVersions(id)`・`useMessageTemplateVersion(id, version)`・`useMessageTemplateModal`・`useMessageTemplateForm`（`dirty`・`closeConfirm`・`readOnly`・`fields`（種別・カテゴリー・ひな形の選択と替える確認・欄の中身の form・埋め込み情報の一覧 `catalog`・知らない名前 `unknownNames`）・`embeddedEditor`（専用の宣言の行）・`save` / `archive`）。開き直しで書く欄を作り直す番号は `@/hooks/useModalSession`
- システム通知 `/admin/messaging/overrides`（門 `messagingOverrides`、タブ システム通知）: 入れ物 `AdminMessageOverrideList` = 直せる連絡の行（名前・経路のバッジ・種類 / カテゴリー・数）。モーダル `AdminMessageOverrideModal`（`open`・`onOpenChange`・`messageKey | null`、幅 1200px）= 直せる欄の案内（既定でひな形の全欄、連絡が `adminEditableOnly` で絞ればその欄だけ、D132）・使えない行の数・埋め込み情報のタグ `EmbeddedInfoTags` + 2 つの欄（左 = 今の経路のプレビュー `LayoutPreview`（経路のタブは右と同じ値）: `POST /[key]/preview` の上書きと下書きを重ねたひな形の描き方、メールは描いた HTML、お知らせはひな形のお知らせの描き方。右 = 経路のタブと欄ごとの編集。保存・元の文言に戻すは欄 1 つずつ）。欄に入るとプレビューのその場所に枠（`data-field` の印）
  - 部品: `OverrideFieldEditor`（入力はひな形の欄の型から `LayoutFieldInput`、元の文言 = コードの値を同じ部品で読むだけに描く（直した欄は開く）、`overrideFieldLabel(path)`）・`OverrideFieldMarks`（直した・コードが変わった・使えない・直せなくなった・未保存）・`EmbeddedInfoTags` / hook: `useMessageOverrides`・`useAdminMessageOverrideList()`・`useMessageOverride(key)`・`useMessageOverrideEditor(key)`
- 連絡の編集の共通部品: `MessageEditorLayout`（左 プレビュー / 右 経路のタブ、狭い画面は入力が上）
- ひな形の欄の入力（D123）: `LayoutFields`（欄の宣言から入力を並べる。`control` と `name` に結ぶ、フォームと検査は hook `useLayoutFieldsForm`（lib の `layoutValuesSchema`）。1 行・段落・長い文・数・日付・選択肢・画像（用途 `notification.image`）・ボタン・リンク・項目と値・並び・組・ブロックの並び（許す種類・min / max、足す・消す・上下）。経路だけの欄は印、送る経路で使われない欄は薄く、`readOnly` = 読むだけ。中の部品 `LayoutFieldInput`・`LayoutBlocksInput`・`KeyValueRowsInput` も入口から）・`EmbeddedInfoTags`（埋め込み情報のタグ: 共通（共通の一覧 + enricher）と専用（色つき）、日本語の別名を出し押すと `{{別名}}` をコピー。一覧の分けとコピーは hook `useEmbeddedInfoTags`（lib の `embeddedCatalog` の一覧を渡す））
- 書きかけのモーダル: 閉じる前は `confirmOnClose`、ページの移動は `@/lib/unsavedGuard`
- loader は認可（`roleCategories: ["admin"]`）と門（閉なら notFound）だけ

### 送るモーダル（MessageSendModal）

- 入れ物 `MessageSendModal`（`mode`・`label?`・`triggerVariant?`・`disabled?`・`icon?`・`onSent?(result)`・`dispatchBasePath?`）: 開くボタン + モーダル。fork は自分の画面にもそのまま置ける
  - `mode`: `{ type: "new" }` / `{ type: "sameAs", dispatch }`（回のカテゴリー・経路・宛先の形と中身を写す）/ `{ type: "bulk", target, recordIds, recordNoun, defaults?, defaultCategory?, source? }`（管理一覧の一括操作、`defaults = { values }` は種別の白紙の欄の中身に重ねる値）。new・sameAs の口は門 `messagingBroadcast` が開の時だけ、bulk は門の外
- 流れ（D110 D115）: 種別 → カテゴリー（その種別に 2 つ以上ある時だけ選ぶ）と経路の絞り → 宛先（種別が許す種類だけ、direct はグループも）→ テンプレート（その種別の公開中の物、門 `messagingTemplates` が開の時。読み込まない = 種別の白紙のシステムテンプレート）→ 内容 → 予約（bulk 以外）→ プレビュー・自分へのテスト送信 → 見込み → 確認 → 送る
- 内容（D118 D119 D120）: 白紙はひな形の欄（`LayoutFields`）で全文を書く。テンプレートを読み込んだ直後は文を固定し、専用の埋め込み情報の入力（`SendEmbeddedInputs`）だけ。『文面を直す』で全文を直せる（つながりは残り、版と違えば直した印 = 送る口の `edited`）。『テンプレートの読み込みを解除』は白紙へ（ひな形が同じなら今の文は残る）。『テンプレートを更新』は今の文をそのテンプレートの新しい版にする（保存 + 公開、送るとは別、門 `messagingTemplates` が開の時だけ）。直している間は埋め込み情報のタグ（共通 + カテゴリーに当たる enrichers + 専用）。内容の中にひな形の実際の描き方のプレビュー（`LayoutPreview` + `useLayoutPreview`、送る経路のタブ、未入力は仮の文）。ボタン「あなた宛ての表示例」は送る口のプレビュー（埋め込み情報を差し込んだ形）
- 送る口の入力: `{ category, channels?, template: { system } | { id, version }, values, edited?, embedded? }`。選択肢（send / bulk-send の options）はカテゴリーごとの白紙（`systemTemplate.layout` / `values`）と埋め込み情報の一覧 `catalog`、ひな形の欄の宣言 `layouts` を持つ（門 `messagingTemplates` の外）
- 宛先 `SendTargetPicker`: 全員・ロール・グループ（`groups` = 使用中のグループを名前と種類で。空 = 門 `userGroups` が閉かグループが無い = 選択肢ごと出さない）・選んだ利用者 / bulk は選んだ記録の数。`allowedTypes` = 種別が許す種類。見込みが人数の上限を超えたら理由を出して送れない（`estimateOverLimit`）
- sameAs の写し: 宛先は回の形（選んだ利用者は `targetUserIds`、グループは同じグループ。今は選べないグループは選んでいない形 + 知らせ `targetNote`、全員に広げない）/ 中身は回のひな形 + values。テンプレートの回でそのテンプレートが公開中なら今の版を読み込んだ形（直して送った回は直した文で文面を直す状態から、専用の埋め込み情報の値も写す）。公開中でない・その場で書いた回は白紙に回の values（ひな形が違えば写せない = `sameAsNote`）
- 部品: `SendKindPicker`（`SendCategoryChannels` の入口から）・`SendCategoryChannels`・`SendTargetPicker`・`SendTemplatePicker` / `SendEmbeddedInputs`・`LayoutFields`・`EmbeddedInfoTags`・`SendLegalNotice`（法の義務の告知はメールを含める注意、いつも出しメールがオフなら警告の色）・`SendSchedule`・`SendConfirmView` / `SendResultView`・`MessagePreview`
- hook `useMessageSendModal({ mode, onSent? })`: 段（edit → confirm → done）・`kind` / `setKind`・`categories` / `category`・`target` / `setTarget` / `allowedTargetTypes` / `targetError` / `groups` / `targetNote`・`templates` / `blank` / `loadedTemplate` / `text`・経路・予約・プレビュー・テスト・見込み・送る（new / sameAs = `/send`、bulk = `/bulk-send`）・`updateTemplate`・二重送信を防ぐ鍵（開くたびに 1 つ）・`dirty` / `closeConfirm`。選択肢は開いている間だけ（`useAdminSendOptions` / `useAdminBulkSendOptions`）。純粋な関数 `scheduleErrorOf` / `kindsOf` / `blankOfKind` / `initialTextOf` / `initialTargetOf` / `overLimitText` / `sameAsNoteOf`
- hook `useSendTemplateText`（`useMessageSendModal` が持つ文面）: 出どころ（白紙 / テンプレートの版）・固定 / 直す（`locked` / `unlock`）・`edited`・欄のフォーム（`useLayoutFieldsForm`）・専用の埋め込み情報の値・`toBlank` / `reset`・`updateTemplate`

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

- options（`BulkMessageActionOptions`）: `target`・`recordNoun`・`label?`（既定「一括送信」）・`defaults?`（`{ values }` = 種別の白紙のひな形の欄の中身に重ねる初期値。例 汎用のお知らせ `{ subject, blocks }`）・`defaultCategory?`（既定 `operatorDirect`）・`source?`・`disabled?`・`onSent?(result)`
- 上流の使い手: `bankTransferReview/adminBulkActions/sendEmail.tsx`

## Verification

- `pnpm test src/features/core/messaging/components src/features/core/messaging/hooks`
- 画面の確かめは `/devcheck`
