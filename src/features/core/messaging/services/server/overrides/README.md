# overrides（管理画面の文言の上書き）

## Overview

連絡のひな形の欄の中身を、管理者が管理画面で直す（ひな形・変数・経路はコードのまま、D21・D132）。欄の道 = ひな形の欄の鍵（組・並び・ブロックの並びは欄ごと丸ごと）。直せる欄は既定で、ひな形の欄のうち種類の経路（fork の種類の上書きの後）で使う物の全部（lib/messaging `adminEditableFields`）。定義・`.override.ts` の `adminEditableOnly`（欄の鍵の並び）は書いた時だけ絞る。`messagingService.listMessageOverrides` / `getMessageOverrides` / `saveMessageOverride` / `resetMessageOverride`（service でも管理者を確かめる）。画面は ../../../components/README.md。

- 門: `messagingOverrides`（`dependsOn: ["messagingDispatches"]`、既定 閉、住所 `/admin/messaging/overrides` と `/api/admin/messaging/overrides`）。閉の間 画面と API は 404、送る口も重ねない。表は残る
- 直せない連絡: 種別の性質 `adminTextOverride` が false（functional = 認証の連絡）・required。閉じたドメインの連絡は出さない（D77）
- 上流の連絡は絞りを持たない（全部の欄を直せる）。fork の連絡も同じで、絞りたい時だけ `adminEditableOnly`（required は不可）

## API

- `GET /` 一覧: 直せる欄がある（か行が残る）連絡と数（直せる・直した・使えない `unusableCount`・コードが変わった）。DTO は連絡の `label`・`categoryLabel`・`channels`
- `GET /[key]` 1 件: `channels`（種類の経路の順に `{ key, label }`）と平たい `fields`（ひな形の宣言の順）。欄ごとに `path`（欄の鍵）・`spec`（欄の宣言: 型・見出し・仮の文・必須と型ごとの約束、経路の印は除く）・`channels`（その欄を使う経路）・`codeValue`（定義の values の欄）・`value`・`effective`（送る時の値）・`edited`・`codeChanged`・`unusable` + `problem`。使えない・直せなくなった行は保存した時の鍵で後ろに（`editable: false`、`spec` は null のことがある、戻すだけ）。使ってよい鍵 `allowedKeys`・埋め込み情報の一覧 `embedded`（共通 + 当たる enrichers の日本語の別名 + この連絡の vars（秘密を除く、source `own`・別名なし）。管理画面のタグ `EmbeddedInfoTags`）
- `POST /[key]/preview` `{ channel, values: { 欄の鍵: 値 } }` → `{ channel, html, text, layout, values, summary, cannotRender }`: 保存した値と未保存の `values`（検査を通る物だけ）をコードの値に重ね、文字に印を付けて（`previewMarkers.ts`、HTML の `<span data-field="欄の鍵">`）送る口と同じ組み立て（`sendMessage/content.ts`）で経路の受け口の `preview` が描く。経路に `preview` が無ければ `html` は null、`text` は印を消す。`layout` / `values`（その経路が使う欄だけ、印なし・`{{鍵}}` のまま）/ `summary`（要約、作れなければ null と `cannotRender`）= お知らせを client のひな形の描き方（`layoutInApps`）で描く材料（`admin/layoutChannelView.ts`）。保存しない
- `PUT /[key]` `{ fieldPath, value }`（`fieldPath` = 今の版の欄の鍵。誤りは 400）/ `DELETE /[key]?field=<欄の鍵>`（その欄へ移る行を全部消す。使えない行は保存した時の鍵で消せる。行が無ければ 404）
- 画像: 値の中の `storage://` の参照（画像の欄・ブロックの画像など、用途 `notification.image`）は保存の取引で行に結ぶ（record `messaging.override` / 行の id / 欄の鍵。自分が上げた未紐付けの物はそのまま、ほかは複製して結ぶ）。差し替えで外れた参照は `replaced`、既定に戻すと `record_removed` で外し、commit の後に実物を消す（`imageBinding.ts`）。cron storage-sweep は `existingOverrideIds` で行の有無を照らす
- 監査: `messaging.override.updated` / `messaging.override.reset`（対象 `message_override`、`<鍵>:<欄の鍵>`、値は残さない）

## Internals

- 表 `message_overrides`: 直した欄だけ行（`message_key`・`field_path` = 欄の鍵・`layout_version` = 保存した時のひな形の版・`value`・`code_value` = 直した時のコードの値・`updated_by`、UNIQUE(message_key, field_path)）。既定に戻す = 行を消す
- 改版（D122・D132）: 読む時に行の欄の鍵を保存した版から今の版へ、ひな形の改版の対応（`revisions`）で移す（lib/messaging `moveAdminFieldPath`）。移せない行（捨てた欄・段の対応が無い・版の無い古い形の行 = 前の『経路.欄』の行）は当てず使えない（`unusable`）と数える。行は消さない（既定に戻すで消す）。保存は今の版で書き、同じ欄へ移る前の版の行を消す
- 重なる順: 管理画面の値 > fork の上書き > 上流の既定（欄ごと）。重ねるのは送る口の `resolveDefinition` の 1 か所（`sendMessage/definition.ts`、門が開の時だけ）。重ねた値は回の `values` に入るので、予約・後回しの組み直しは送った時の文言のまま（D128）
- 検査（lib/messaging `checkAdminFieldValue`、保存・送る口・プレビューで同じ）: 今の版で直せる欄にある・欄の宣言の zod（必須は空にできない）・`{{鍵}}` は vars（秘密を除く）∪ 共通の文脈 ∪ throttle の鍵 ∪ provides。通らない行は使えない行として一覧に出る

## Verification

- `pnpm test src/features/core/messaging/services/server/overrides`
- `pnpm test src/lib/messaging/definition/adminFields.test.ts src/features/core/messaging/services/server/sendMessage/adminOverrides.test.ts`
