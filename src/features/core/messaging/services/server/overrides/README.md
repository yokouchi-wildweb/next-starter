# overrides（管理画面の文言の上書き）

## Overview

連絡の種類の経路（fork の種類の上書きの後）の欄を、管理者が管理画面で直す（デザインと変数はコードのまま）。欄は既定で全部直せる（D83。lib/messaging `adminEditablePaths`）。定義・`.override.ts` の `adminEditableOnly` は書いた時だけ欄を絞る。`messagingService.listMessageOverrides` / `getMessageOverrides` / `saveMessageOverride` / `resetMessageOverride`（service でも管理者を確かめる）。画面は ../../../components/README.md。

- 門: `messagingOverrides`（`dependsOn: ["messagingDispatches"]`、既定 閉、住所 `/admin/messaging/overrides` と `/api/admin/messaging/overrides`）。閉の間 画面と API は 404 で、送る口は DB の値を使わない。表は残る
- 直せない連絡: 種別の性質 `adminTextOverride` が false（functional = 認証の連絡）・required・authored（管理者が書く連絡 3 本）。閉じたドメインの連絡は出さない（D77）
- 上流の連絡は絞りを持たない（種類の経路の欄を全部直せる）。fork の連絡も同じで、絞りたい時だけ `adminEditableOnly`（required は不可）

## API

- `GET /` 一覧: 直せる欄がある（か行が残る）連絡と数（直せる・直した・孤立・コードが変わった）。DTO は連絡の `label`・`categoryLabel`・`channels`
- `GET /[key]` 1 件: `channels`（種類の経路の順に `{ key, label, previewComponent }`。`previewComponent` = 経路の受け口のプレビューの部品の鍵、無ければ null）と平たい `fields`（経路・欄の順）。欄ごとに `channel`・`field`・`meta`（経路の受け口の `fieldMeta`、約束の無い欄は `{ label: 欄の名前, input: "line" }`）・`codeValue`・`value`・`effective`（送る時の値）・`edited`・`codeChanged`・`orphan` + `problem`、直せなくなった欄（`editable: false`、戻すだけ）、使ってよい鍵 `allowedKeys`
- `POST /[key]/preview` `{ channel, values: { "<経路.欄>": 値 } }` → `{ channel, html, text }`: 送る時の値に未保存の値を重ね、連絡の描き方（経路の受け口の `preview`）で描く。文字の欄（input line / text、並び・部分の中も）は `data-field="<経路.欄>[.<部分>]"` の `<span>` で包む（プレビューの時だけ。値を目に見えない印の文字で包んで描き、描いた HTML で置き換える `previewMarkers.ts`。タグの中と `<head>` の印は消すだけ）。経路に `preview` が無ければ `html` は null。保存しない
- `PUT /[key]` `{ fieldPath, value }`（誤りは 400）/ `DELETE /[key]?field=<経路.欄>`（行が無ければ 404）
- 画像: 値の中の `storage://` の参照（inApp.image など、用途 `notification.image`）は保存の取引で行に結ぶ（record `messaging.override` / 行の id / 欄。自分が上げた未紐付けの物はそのまま、ほかは複製して結ぶ）。差し替えで外れた参照は `replaced`、既定に戻すと `record_removed` で外し、commit の後に実物を消す（`imageBinding.ts`）。cron storage-sweep は `existingOverrideIds` で行の有無を照らす
- 監査: `messaging.override.updated` / `messaging.override.reset`（対象 `message_override`、`<鍵>:<欄>`、値は残さない）

## Internals

- 表 `message_overrides`: 直した欄だけ行（`message_key`・`field_path` = `<経路>.<欄>`・`value`・`code_value` = 直した時のコードの値・`updated_by`、UNIQUE(message_key, field_path)）。既定に戻す = 行を消す
- 重なる順（門が開）: 管理画面の値 > fork の上書き > 上流の既定（欄ごと）。重ねるのは送る口の `resolveDefinition` の 1 か所
- 送る時の検査は保存と同じ（lib/messaging `checkAdminFieldValue`）: 今も直せる欄（`adminEditablePaths`）にある・欄の型・配列はコードと同じ長さ・`{{鍵}}` は vars（秘密を除く）∪ 共通の文脈 ∪ provides。通らない欄（孤立）はその欄だけコードの値で送り警告を出す。欄の名前の変更・削除で行は孤立する（付け替えの task は無い）

## Verification

- `pnpm test src/features/core/messaging/services/server/overrides` と `services/server/sendMessage/adminOverrides.test.ts`
