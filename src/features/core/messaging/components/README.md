# components（messaging の画面）

## Overview

core_ui の形: 流れとデータは hook（`hooks/index.ts` から）、部品（`common/<Part>`）は props だけ、入れ物（`components/<Name>`）が hook を呼んで部品を並べる。どれも公開: 入口だけを import する。fork は自分の画面（`_components/` の Screen）で入れ物か、部品 + hook を組む。client は `services/client/*Client.ts`（axios + `normalizeHttpError`）。

## Usage

### 本人の画面

- 受け取り箱 `/messages`（`src/app/(user)/(protected)/messages/`、門 `messagingInbox`、access authenticated、閉なら notFound）: Screen = 題「お知らせ」+ 入れ物 `InboxList`（`unreadOnly?`・`limit?`・`emptyText?`）。流れ `useInboxList(options)` → `{ query, unreadCount, opened, detail, isDetailLoading, detailError, open, close, markAll, isMarkingAll }`（一覧は題と本文の頭だけ、開いた行の詳しい表示は `useInboxItemDetail(id)` = `GET /api/me/messaging/inbox/[id]`（レイアウト・版・欄の中身・お知らせの欄の宣言 `fields`）。取れるまでは日時と読み込み中）
  - hook: `useInboxItems({ unreadOnly?, limit?, enabled?, revalidateOnFocus?, observerOptions? })`（`useInfiniteScrollQuery` のカーソル、`total` は読み込み済みの数）・`useInboxUnreadCount({ enabled? })` → `{ count }`・`useMarkInboxItemRead()` → `markRead(id)`・`useMarkAllInboxRead()` → `markAllRead()`（成功で未読の数を取り直す。一覧の印は呼び手が `updateItems` で）
  - 部品: `InboxItemRow`（`onOpen(item)`、題と本文の頭）・`InboxDetailModal`（受け取り箱の表示はこれ 1 つ: 一覧で押した時も未読のモーダルも。`open`・`onOpenChange`・`item`・`detail?`・`loading?`・`showCloseButton?`・children = 中身の下の操作）・`InboxItemDetail`（`item`・`loading?` = 日時 + `InboxLayoutView`、題は包む Modal が持つ）・`InboxUnreadMark`・`InboxLayoutView`（レイアウトのお知らせの描き方 `layoutInApps` > 汎用 `GenericInAppView`（`fields` の宣言の順に欄の型とブロックの種類ごとに描く）。描けない行は「このお知らせは表示できません」、要約は描かない（D120）。管理画面のお知らせのプレビュー `LayoutPreview` も同じ部品）
- 未読のモーダル: 入れ物 `InboxUnreadModal`、流れ `useInboxUnreadModal({ enabled?, paths? })`（住所 `isInboxModalPath`・ログイン・確かめた印 sessionStorage・古い順・見せたら既読・`next` / `skip`（全部既読）/ `close`）。上流の利用者の枠（`src/app/(user)/_layout/UserLayout.tsx`）が外枠の末尾に置く。**門 `messagingInbox` が閉なら hook は取りに行かず開かない**（`enabled` を渡しても）。開の間は `inbox.showUnreadModal`（既定 true）と `inbox.unreadModalPaths`（既定 `["/"]`）。表示は一覧の詳細と同じ `InboxDetailModal`（1 件ずつ詳しい表示を取ってレイアウトで描く、下にスキップ・次へ・確認完了と n/N。hook が `detail` / `isDetailLoading` を返す）
- 通知の設定 `/mypage/account/notifications`（門 `messagingPreferences`、mypage のカード `src/features/core/user/mypageMenu/items/notifications.ts`）: 入れ物 `MessagePreferences`（`emptyText?`）= 上に「すべての連絡を止める」→ 送信チャンネルの枠（送信チャンネルまるごと・宛先の無い送信チャンネルは連携の案内）→ 種別の枠（見出しだけ、種別のスイッチは出さない）→ グループの見出し → カテゴリーの行（その送信チャンネルの 1 マス）。カテゴリーまるごとの切り替えはカテゴリーが最初に出る送信チャンネルの行に 1 回だけ
  - hook `useMessagePreferences({ enabled? })` → `{ preferences, isLoading, error, retry, setCell, setCategoryWide, setChannelWide, setAll, setKind, setGroup, pendingKey }`（変更の応答を SWR に書く。`setGroup(group, stop, channel?)` = グループまるごと、channel 省略 = すべての送信チャンネル。`pendingKey` = `<カテゴリー>:<送信チャンネル>` / `<カテゴリー>:*` / `*:<送信チャンネル>` / `*:*` / `kind:<種別>` / `group:<グループ>:<送信チャンネルか *>`）
  - 広い行で止まるカテゴリーは切で理由を出す（`preferenceViaReason`）。カテゴリー・種別・送信チャンネルまるごとの下は押せてサーバーが書き分ける。全部の停止の間は全部の下のマスと広い切り替えを押せない（送信チャンネルの枠とカテゴリーまるごとは `stoppedByAll?` に `allOptedOut` を渡すと止まった状態で見せる）
  - 部品: `PreferenceChannelSection`・`PreferenceKindFrame`・`PreferenceGroupHeading`・`PreferenceCategoryRow`・`PreferenceCategoryWideToggle`・`PreferenceGroupToggle`（グループまるごと、上流の画面には置かない）。種別の枠の表示名は `constants/kindLabels.ts` の `MESSAGE_KIND_LABELS`（仮）
  - グループまるごとの停止（D123）: グループの行で止めるので、後からグループに入ったカテゴリーも止まる。状態は 送信チャンネルごと = `channels[].kinds[].groups[].optedOut`、すべての送信チャンネル = `preferences.groups[]`（`{ key, label, kind, optedOut }`）。部品 `PreferenceGroupToggle`（`groupLabel`・`stopped`・`channelLabel?`・`disabled?`・`stoppedByAll?`・`onChange(stop)`・`label?`・`size?`）の向きはほかの部品と同じ: `channelLabel` あり = 入 = その送信チャンネルで受け取る / なし = 入 = すべての送信チャンネルで止めている
  - fork の組み方（上流の `MessagePreferences` はカテゴリーごとのまま。fork は `_components/` の Screen で hook と部品を組む）: グループだけ = グループの見出しの行に `PreferenceGroupToggle` を置きカテゴリーの行を出さない / カテゴリーだけ = 上流の画面のまま / 両方 = 見出しの行にグループのスイッチ、下にカテゴリーの行（グループで止めたカテゴリーの行は via `group` の理由で切）。送信チャンネルごとの例:

```tsx
{channel.kinds.map((frame) =>
  frame.groups.map((group) => (
    <Stack key={group.key ?? "-"} gap="xs">
      {group.key ? (
        <Flex justify="between" align="center">
          <PreferenceGroupHeading label={group.label} />
          <PreferenceGroupToggle
            groupLabel={group.label ?? group.key}
            channelLabel={channel.label}
            stopped={group.optedOut}
            stoppedByAll={preferences.allOptedOut}
            disabled={pendingKey !== null}
            onChange={(stop) => void setGroup(group.key!, stop, channel.key)}
          />
        </Flex>
      ) : null}
      {/* 両方にする時だけ: group.categories.map((category) => <PreferenceCategoryRow … />) */}
    </Stack>
  )),
)}
```

  - すべての送信チャンネルで 1 つにするなら `preferences.groups.map((group) => <PreferenceGroupToggle groupLabel={group.label} stopped={group.optedOut} onChange={(stop) => void setGroup(group.key, stop)} />)`（`channelLabel` を渡さない = 入 = 止めている）
- 配信停止の確認 `/unsubscribe`: 入れ物 `Unsubscribe`（確認 `UnsubscribeConfirm` → `useUnsubscribe(token)` の `submit` → 結果 `UnsubscribeResult`: 止めた + 通知の設定への案内 / リンクが正しくない）

### 管理の画面（ページは 4 つ、作る・直す・送るはモーダル）

- メニューの項目は 1 つ（マーケティング > メッセージ管理、`/admin/messaging`。画面の見出しも同じ）。送信一覧・テンプレート・テキストの編集の 3 画面はヘッダー中央のタブ `AdminMessagingSectionTabs`（`variant?: "body" | "header"`）で行き来する。タブの中身は `lib/adminSectionTabs.ts` の `buildMessagingAdminSectionTabs(enabled)` だけが決め、門が閉の画面（`messagingTemplates` / `messagingOverrides`）のタブは出さない。送信の詳細にはタブを出さない
- 送信 `/admin/messaging`（門 `messagingDispatches`、タブ 送信一覧）: 入れ物 `AdminDispatchList`（`initialFilters?`・`limit?`）= 絞り込み（期間・種別 7 つ・カテゴリー（種別を選んだ後だけ）・送信チャンネル・状態、`useAdminDispatchFilters`）+ 行 `DispatchRow` の無限スクロール。上に「新しく送る」（門 `messagingBroadcast`）
- 一覧の選択と一括操作（D88 D95 D98）: `RecordSelectionList`（`@/lib/tableSuite`）に `DispatchRow` を載せる。選択の出し方は `toggle`（バーの「選択モード」が入の間だけチェック）、削除した送信は選べない。操作は受け口 `adminBulkActions` の項目（上流の既定 = `adminBulkActions/delete.tsx`: 確認の Dialog に見込み `DispatchDeleteSummary`（`useDispatchDeleteSummary`）→ `useBulkDeleteDispatches`、100 件まで）。終わったら一覧を取り直す。状態の絞りの「削除済み」（`constants/dispatchFilters.ts` の `DISPATCH_FILTER_DELETED`）= 削除した送信だけ（`deleted: "only"`）
- 送信の詳細（D130）: 送信一覧の上のモーダル `AdminDispatchDetailModal`（`dispatchId`（null = 閉じている）・`onClose`・`onDeleted?`）。開き先は一覧の URL の `?dispatch=<id>`（hook `useDispatchDetailParam`: `dispatchId`・`hrefOf(id)`・`markOpened`・`close`（行から開いた時は「戻る」、URL を直に開いた時は ?dispatch を外して置き換え）、住所は `dispatchDetailHref(一覧の住所, id)`）。詳細の別の画面は無い。タブ = 基本情報 / 送信状況 / プレビュー、下の帯 = 送信の操作（`DispatchOperations`: 削除・失敗分を再送・送信を再開）+ 「同じ内容で送る」。中身の塊は `AdminDispatchDetail` の入口から（`DispatchSummaryBlock`（テンプレートの行 `dispatchTemplateLabel`: v<n>、消したテンプレートの送信は「削除されたテンプレート(v<n>)」、D137）・`DispatchDeliveriesBlock`（状態・送信チャンネルで絞る、カーソル）・`DispatchBodyBlock`（送信の中身を残した送信は `GET /dispatches/[id]/preview` を `LayoutPreview` で、前の形の送信は残した本文を `MessagePreview` で）・`DispatchActions`）。入れ物 `AdminDispatchDetail`（`dispatchId`）= 同じ塊をタブと操作で並べた物（fork が自分の画面に置ける）。流れは `useAdminDispatchDetail(dispatchId, { limit?, observerOptions?, onDeleted? })`
- 運営する人に鍵を見せない: 種別・カテゴリー・送信チャンネル・送り元は表示名、定義の鍵・グループの id は出さない。送った人 = `actorName`、配達の行 = `userName`、表に無い失敗の符号・理由・状態は「送れませんでした(理由は記録にあります)」「そのほかの理由」「そのほかの状態」
- テンプレート `/admin/messaging/templates`（門 `messagingTemplates`、タブ テンプレート）: 入れ物 `AdminMessageTemplateList` = 種別の絞り（状態は無い: 下書き・アーカイブは無い、D134 D137）+ 「新しく作る」+ 行（種別 / カテゴリー。DB のテンプレートだけ、システムテンプレートは廃止、D171・D201）。モーダル `AdminMessageTemplateModal`（`open`・`onOpenChange`・`templateId?`（null = 作る）・`onChanged?`）= `TabbedModal` の 内容 / バージョン履歴（変数のタブは無い）。内容 = 左 レイアウトの選択（一番上）+ `LayoutPreview`（送信チャンネルのタブ、未入力は仮の文）、右 名前・説明・種別 →（カテゴリー: その種別に 2 つ以上の時だけ）・`VarTags` +『専用の埋め込み情報を管理』（`TemplateVarsModal`）・`LayoutFields`。レイアウトを替えると中身があれば確かめて消す。作る時は種別・カテゴリー・レイアウトがそろいカテゴリーに送信方法がある時だけ中身の入力と埋め込み情報を出す（それまでは先に選ぶ物の 1 行、D139）。下の帯 削除（ConfirmPopover「送信の記録は残ります」、消せたらモーダルを閉じ一覧から行を外す、D137）・保存（ConfirmPopover、保存 = 作る / 直す の 1 回で公開（D134: 作る = 版 1、直す = 中身が違えば新しいバージョン）、同じ中身なら「変更はありません」）。一覧の流れ = hook `useAdminMessageTemplateList`（種別 `kind`/`setKind`（D135: その種別のカテゴリーのテンプレート）・無限スクロール・モーダルの開き先）。流れ = hook `useMessageTemplateModal`・`useMessageTemplateForm`（種別・カテゴリー・レイアウト・中身・専用の宣言の書きかけと検査）・`useLayoutPreview`・`useVarTags`
  - 部品 `LayoutPreview`（props だけ: `layout`・`channels`・`channel`・`onChannelChange`・`content`（選んだ送信チャンネルの `{ html?, text?, title?, values?, summary?, fields?, cannotRender? }`）・`loading`・`error`。メール = 送る HTML の iframe、お知らせ = 受け取り箱の詳細と同じ `InboxLayoutView`（レイアウトのお知らせの描き方 > 汎用（`fields` があれば）、要約は描かない）、ほかの送信チャンネルで描き方が無ければ要約の文（LINE など文を送る送信チャンネルはこれがそのまま送る文）。取得はしない: テンプレート・送る画面は hook `useLayoutPreview`（未入力の欄を仮の文で埋め、`POST /api/admin/messaging/layouts/preview` を 400ms 待って呼ぶ）、ほかの画面は自分の取得元から `content` を渡す）・`TemplateVarsModal`（専用の宣言の行: 別名・鍵・型・選択肢・既定値・必須、「適用」で hook が検査）・`TemplateVersionList`（`layouts` でレイアウトと欄の見出しを出す）
  - 部品: `TemplateVersionList`・`TemplateVarsModal`
  - hook: `useMessageTemplates`・`useAdminMessageTemplateList({ observerOptions? })`（`modal.openNew()` / `openTemplate(id)` / `onChanged`: 作った = 先頭から取り直す・ほか = 行を置き換える）・`useMessageTemplate(id)`・`useMessageTemplateOptions(enabled?)`・`useMessageTemplateVersions(id)`・`useMessageTemplateVersion(id, version)`・`useMessageTemplateModal`・`useMessageTemplateForm`（`dirty`・`closeConfirm`・`readOnly`・`fields`（種別・カテゴリー・レイアウトの選択と替える確認・欄の中身の form・埋め込み情報の一覧 `catalog`・知らない名前 `unknownNames`）・`varsEditor`（専用の宣言の行）・`save` / `remove`（消せたら true）・`fieldsReady` / `fieldsHint`（D139））。開き直しで書く欄を作り直す番号は `@/hooks/useModalSession`
- システム通知 `/admin/messaging/overrides`（門 `messagingOverrides`、タブ システム通知）: 入れ物 `AdminMessageOverrideList` = 直せる連絡の行（名前・送信チャンネルのバッジ・種類 / カテゴリー・数）。モーダル `AdminMessageOverrideModal`（`open`・`onOpenChange`・`messageKey | null`、幅 1200px）= 直せる欄の案内（既定でレイアウトの全欄、連絡が `adminEditableOnly` で絞ればその欄だけ、D132）・使えない行の数・埋め込み情報のタグ `VarTags` + 2 つの欄（左 = 今の送信チャンネルのプレビュー `LayoutPreview`（送信チャンネルのタブは右と同じ値）: `POST /[key]/preview` の上書きと下書きを重ねたレイアウトの描き方、メールは描いた HTML、お知らせはレイアウトのお知らせの描き方。右 = 欄ごとの編集）。保存は 1 回（D132、テンプレートのモーダルと同じ）: 下の帯の右の「保存」（確かめ・保存の間 loading）が直した欄の全部と元の文言に戻す欄をまとめて保存（1 つの取引、通らない欄は欄に理由）。欄ごとの操作は「元の文言に戻す」だけ（保存してある欄は戻す印を付け保存で消す、下書きだけの欄は下書きを捨てる）。保存していない欄があるまま閉じると確かめる。欄に入るとプレビューのその場所に枠（`data-field` の印）。下の帯の左に「すべてデフォルトに戻す」（D136: 確かめて、下書きを捨て保存してある欄（使えない行も）の全部に戻す印、「保存」で確定。変わる物が無ければ押せない）。変数の名前は別名で見せる（D133: 入力・元の文言・使えない名前・プレビューの `{{鍵}}` → `{{別名}}`、別名の無い名前はそのまま。打った値は `{{別名}}` のまま保存）
  - 部品: `OverrideFieldEditor`（入力はレイアウトの欄の型から `LayoutFieldInput`、元の文言 = コードの値を同じ部品で読むだけに描く（直した欄は開く）、`overrideFieldLabel(path)`）・`OverrideFieldMarks`（直した・コードが変わった・使えない・直せなくなった・未保存）・`OverrideFieldEditor` の `error`（保存の誤り）・`resetPending`（戻す印）・`codeValue`（元の文言として見せる値、呼び手が別名にした物）・`VarTags` / hook: `useMessageOverrides`・`useAdminMessageOverrideList()`・`useMessageOverride(key)`・`useMessageOverrideEditor(key)`
- 管理の一覧の行の共通部品: `MessageRowMeta`（`RowMetaItem` 印 + 中身・`KindCategoryMeta` 種別 › カテゴリー・`ChannelsMeta` 送信方法の札・`RowDateMeta` 1 段目の右の日時。送信一覧(`DispatchRow`)・テンプレート・テキストの編集の一覧が同じ形で使う）
- 連絡の編集の共通部品: `MessageEditorLayout`（左 プレビュー / 右 送信チャンネルのタブ、狭い画面は入力が上。上流のモーダルはもう使わない: テンプレート・送る・テキストの編集は「左 = プレビュー(送信チャンネルのタブはプレビューだけ)/ 右 = 操作」をその場で組み、埋め込み情報は下の帯の左の `VarPopover`）
- レイアウトの欄の入力（D123）: `LayoutFields`（欄の宣言から入力を並べる。`control` と `name` に結ぶ、フォームと検査は hook `useLayoutFieldsForm`（lib の `layoutValuesSchema`）。1行テキスト・段落・複数行テキスト・数・日付・選択肢・画像（用途 `notification.image`）・ボタン・リンク・ラベルと値・並び・組・ブロックの並び（許す種類・min / max、足す・消す・上下）。送信チャンネルだけの欄は印、送る送信チャンネルで使われない欄は薄く、`readOnly` = 読むだけ。中の部品 `LayoutFieldInput`・`LayoutBlocksInput`・`KeyValueRowsInput` も入口から）・`VarPopover`（埋め込み情報の吹き出し: ボタン「{ } 埋め込み情報 共通 N・専用 M」→ 使い方の 1 行 + タグ、使えない名前の印、`onManage` で専用の管理のボタン。テンプレート・送る・テキストの編集のモーダルが使う）・`VarTags`（埋め込み情報のタグ: 共通（共通の一覧 + enricher）と専用（色つき）、日本語の別名を出し押すと `{{別名}}` をコピー。一覧の分けとコピーは hook `useVarTags`（lib の `varCatalog` の一覧を渡す。鍵 → 別名の `aliases`・`aliasOf`・`toAliases` も返す、純関数 `replaceKeysWithAliases` / `valueWithAliases`））
- 書きかけのモーダル: 閉じる前は `confirmOnClose`、ページの移動は `@/lib/unsavedGuard`
- loader は認可（`roleCategories: ["admin"]`）と門（閉なら notFound）だけ

### 送るモーダル（MessageSendModal）

- 入れ物 `MessageSendModal`（`mode`・`label?`・`triggerVariant?`・`disabled?`・`icon?`・`onSent?(result)`・`dispatchBasePath?`）: 開くボタン + モーダル。fork は自分の画面にもそのまま置ける
  - `mode`: `{ type: "new", initialRecipients? }`（`initialRecipients` = 利用者 id の並び: 宛先は「選んだ利用者」のその人たちから始まり、管理者が変えられる。利用者の詳細などから 1 人宛ての自由連絡を開く入口、D177）/ `{ type: "sameAs", dispatch }`（送信のカテゴリー・送信チャンネル・宛先の形と中身を写す）/ `{ type: "bulk", target, recordIds, recordNoun, source? }`（管理一覧の一括操作。新しく送ると同じく種別から選び初めのレイアウトの白紙から書く。決まった文面・カテゴリーは渡さない = 連絡定義の物、D195）。new・sameAs の口は門 `messagingBroadcast` が開の時だけ、bulk は門の外
  - `initialRecipients` を渡す呼び手（利用者の詳細のボタンなど）は `/send`（門の中）を通るので、ボタンを門 `messagingBroadcast` で包む（`requires` / `useGate`）。1 人宛ての自由連絡の入口を使う fork は `messagingBroadcast` を開く
- 流れ（D110 D115）: 種別とカテゴリー（`KindCategoryFields` の 1 行、新しく送る時は種別を先に選ばない、D118）→ 送信チャンネルの絞り（最初はカテゴリーの `defaultChannels`、無ければ全部。カテゴリー・種別を替えるとその最初の送信チャンネルに戻る、sameAs は触るまで元の送信の送信チャンネル、D119） → 宛先（種別が許す種類だけ、direct はグループも）→ レイアウト（`SendLayoutPicker`。開いた時は選択肢の `initialLayout`（config の messaging.initialLayout）、選べるのは管理画面で選べて無効でない物（`selectable`）。替えると欄の中身は白紙から（前の値は持ち越さない）、書きかけがあれば Dialog で確かめる。種別を替えてもレイアウトと文はそのまま、D195）→ テンプレート（任意の読み込みの道具。その種別の公開中の物、門 `messagingTemplates` が開の時だけ行を出す。使えないレイアウトのテンプレートはサーバーが出さない）→ 内容 → 予約（bulk 以外）→ プレビュー・自分へのテスト送信 → 見込み → 確認 → 送る
- 内容（D118 D119 D120）: 読み込んでいない時はレイアウトの欄（`LayoutFields`）で全文を書く。テンプレートを読み込んだ直後は文を固定し、専用の埋め込み情報の入力（`SendVarInputs`）だけ。『文面を直す』で全文を直せる（つながりは残り、版と違えば直した印 = 送る口の `edited`）。『テンプレートの読み込みを解除』はそのテンプレートのレイアウトへ（選べなければ初めのレイアウト。レイアウトが同じなら今の文は残る）。レイアウトを選ぶ・種別を替えるとテンプレートは外れる。『テンプレートを更新』は今の文をそのテンプレートの新しい版にする（1 回の保存で公開、送るとは別、門 `messagingTemplates` が開の時だけ）。直している間は埋め込み情報のタグ（共通 + カテゴリーに当たる enrichers + 専用）。内容の中にレイアウトの実際の描き方のプレビュー（`LayoutPreview` + `useLayoutPreview`、送る送信チャンネルのタブ、未入力は仮の文）。ボタン「あなた宛ての表示例」は送る口のプレビュー（埋め込み情報を差し込んだ形）
  - レイアウトの選択（`SendLayoutPicker`、props だけ: `layouts`・`value`・`onChange`・`hideLabel?`）: 選べるレイアウトが無ければテンプレートを読み込まないと送れない（その案内）。読み込んだテンプレートのレイアウトが選べない物なら空の表示
  - テンプレートの選ぶ小窓（`SendTemplatePicker`、props: `templates`・`loaded`・`onLoad`・`onUnload`）: 選んだ種別の公開中のテンプレート（説明は版）。無ければ押せず「この種別のテンプレートはありません」
- 送る口の入力: `{ category, channels?, origin: { layout } | { id, version }, values, edited?, vars? }`（レイアウトの送りは `vars` なし）。選択肢（send / bulk-send の options）はカテゴリーごとの埋め込み情報の一覧 `catalog` と、レイアウトの欄の宣言 `layouts`（選べるレイアウトは `selectable: true`）を持つ（門 `messagingTemplates` の外）
- 宛先 `SendTargetPicker`: 全員・ロール・グループ（`groups` = 使用中のグループを名前と種類で。空 = 門 `userGroups` が閉かグループが無い = 選択肢ごと出さない）・選んだ利用者 / bulk は選んだ記録の数。`allowedTypes` = 種別が許す種類。見込みが人数の上限を超えたら理由を出して送れない（`estimateOverLimit`）
- sameAs の写し: 宛先は送信の形（選んだ利用者は `targetUserIds`、グループは同じグループ。今は選べないグループは選んでいない形 + 知らせ `targetNote`、全員に広げない）/ 中身は送信のレイアウト + values。テンプレートの送信でそのテンプレートが公開中なら今の版を読み込んだ形（直してからの送信は直した文で文面を直す状態から、専用の埋め込み情報の値も写す）。公開中でない・レイアウトから書いた送信は、送信のレイアウトが管理画面で選べる物ならそのレイアウトに送信の values、選べなければ初めのレイアウトの空の欄（写せない = `sameAsNote`）
- 部品: `SendKindPicker`（`SendCategoryChannels` の入口から）・`SendCategoryChannels`・`SendTargetPicker`・`SendLayoutPicker`・`SendTemplatePicker` / `SendVarInputs`・`LayoutFields`・`VarTags`・`SendLegalNotice`（法の義務の告知はメールを含める注意、メールがオフなら警告の色。上流の送るモーダルでは出さない）・`SendSchedule`・`SendConfirmView` / `SendResultView`・`MessagePreview`
- hook `useMessageSendModal({ mode, onSent? })`: 段（edit → confirm → done）・`kind` / `setKind`・`categories` / `category`・`target` / `setTarget` / `allowedTargetTypes` / `targetError` / `groups` / `targetNote`・`layoutChoices` / `layoutKey` / `chooseLayout`（`pendingLayout` / `confirmLayout` / `cancelLayout`）・`templates` / `blank` / `loadedTemplate` / `text`・送信チャンネル・予約・プレビュー・テスト・見込み・送る（new / sameAs = `/send`、bulk = `/bulk-send`）・`updateTemplate`・二重送信を防ぐ鍵（開くたびに 1 つ）・`dirty` / `closeConfirm`。選択肢は開いている間だけ（`useAdminSendOptions` / `useAdminBulkSendOptions`）。純粋な関数 `scheduleErrorOf` / `kindsOf` / `blankLayoutOf` / `initialTextOf` / `initialTargetOf` / `overLimitText` / `sameAsNoteOf`
- hook `useSendTemplateText`（`useMessageSendModal` が持つ文面）: 出どころ（レイアウト / テンプレートの版）・固定 / 直す（`locked` / `unlock`）・`edited`・欄のフォーム（`useLayoutFieldsForm`）・専用の埋め込み情報の値・`toBlank`（レイアウトへ）/ `reset`・`updateTemplate`

### 管理一覧の一括送信（AdminBulkSend）

受け口 `adminBulkActions` の項目を作る関数。対にサーバーの受け口 `bulkSendTargets/<名前>.ts` が要る（../services/server/admin/README.md）。

```tsx
// src/features/<domain>/adminBulkActions/notify.tsx
import { bulkMessageAction } from "@/features/core/messaging/components/AdminBulkSend";

export const bulkAction = bulkMessageAction(
  { key: "notify", order: 100 },
  { target: "<bulkSendTargets の key>", recordNoun: "発送リクエスト" },
);
```

- options（`BulkMessageActionOptions`）: `target`・`recordNoun`・`label?`（既定「一括送信」）・`source?`・`disabled?`・`onSent?(result)`
  - 決まった文面・カテゴリーの指定は無い（送るモーダルは種別から選び白紙から書く）。決まった文面を送るなら連絡定義（messages/<名前>.ts）にする（D195 D200）
- 上流の使い手: `bankTransferReview/adminBulkActions/sendEmail.tsx`

## Verification

- `pnpm test src/features/core/messaging/components src/features/core/messaging/hooks`
- 画面の確かめは `/devcheck`
