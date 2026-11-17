# overrides（管理画面の文言の上書き）

## Overview

連絡の種類の経路（fork の種類の上書きの後）の欄を、管理者が管理画面で直す（デザインと変数はコードのまま）。欄は既定で全部直せる（D83。lib/messaging `adminEditablePaths`）。定義・`.override.ts` の `adminEditableOnly` は書いた時だけ欄を絞る。`messagingService.listMessageOverrides` / `getMessageOverrides` / `saveMessageOverride` / `resetMessageOverride`（service でも管理者を確かめる）。画面は ../../../components/README.md。

- 門: `messagingOverrides`（`dependsOn: ["messagingDispatches"]`、既定 閉、住所 `/admin/messaging/overrides` と `/api/admin/messaging/overrides`）。閉の間 画面と API は 404。表は残る
- **今は送る口が上書きを重ねない**（連絡の定義がひな形 + 欄の中身になり、『経路.欄』の鍵が当たらないため）。コードの値（`codeValue`）は null、プレビューは上書きを重ねずに描く。TODO 指令 56: 鍵を ひな形の欄の鍵へ替え、重ね方・コードの値・プレビューの印を戻す
- 直せない連絡: 種別の性質 `adminTextOverride` が false（functional = 認証の連絡）・required・authored（管理者が書く連絡 3 本）。閉じたドメインの連絡は出さない（D77）
- 上流の連絡は絞りを持たない（種類の経路の欄を全部直せる）。fork の連絡も同じで、絞りたい時だけ `adminEditableOnly`（required は不可）

## API

- `GET /` 一覧: 直せる欄がある（か行が残る）連絡と数（直せる・直した・孤立・コードが変わった）。DTO は連絡の `label`・`categoryLabel`・`channels`
- `GET /[key]` 1 件: `channels`（種類の経路の順に `{ key, label, previewComponent }`。`previewComponent` = 経路の受け口のプレビューの部品の鍵、無ければ null）と平たい `fields`（経路・欄の順）。欄ごとに `channel`・`field`・`meta`（経路の受け口の `fieldMeta`、約束の無い欄は `{ label: 欄の名前, input: "line" }`）・`codeValue`・`value`・`effective`（送る時の値）・`edited`・`codeChanged`・`orphan` + `problem`、直せなくなった欄（`editable: false`、戻すだけ）、使ってよい鍵 `allowedKeys`
- `POST /[key]/preview` `{ channel, values: { "<経路.欄>": 値 } }` → `{ channel, html, text }`: 送る口と同じ組み立て（`sendMessage/content.ts`）の中身を経路の受け口の `preview` で描く。今は保存した値も未保存の `values` も重ねず、欄の印（`previewMarkers.ts`）も付けない（TODO 指令 56）。経路に `preview` が無ければ `html` は null。保存しない
- `PUT /[key]` `{ fieldPath, value }`（誤りは 400）/ `DELETE /[key]?field=<経路.欄>`（行が無ければ 404）
- 画像: 値の中の `storage://` の参照（inApp.image など、用途 `notification.image`）は保存の取引で行に結ぶ（record `messaging.override` / 行の id / 欄。自分が上げた未紐付けの物はそのまま、ほかは複製して結ぶ）。差し替えで外れた参照は `replaced`、既定に戻すと `record_removed` で外し、commit の後に実物を消す（`imageBinding.ts`）。cron storage-sweep は `existingOverrideIds` で行の有無を照らす
- 監査: `messaging.override.updated` / `messaging.override.reset`（対象 `message_override`、`<鍵>:<欄>`、値は残さない）

## Internals

- 表 `message_overrides`: 直した欄だけ行（`message_key`・`field_path` = `<経路>.<欄>`・`value`・`code_value` = 直した時のコードの値・`updated_by`、UNIQUE(message_key, field_path)）。既定に戻す = 行を消す
- 重なる順（指令 56 で戻す）: 管理画面の値 > fork の上書き > 上流の既定（欄ごと）。重ねるのは送る口の `resolveDefinition` の 1 か所
- 保存の検査（lib/messaging `checkAdminFieldValue`）: 今も直せる欄（`adminEditablePaths`）にある・欄の型・`{{鍵}}` は vars（秘密を除く）∪ 共通の文脈 ∪ provides（並びの長さはコードの値が無いので今は見ない）。通らない行は孤立として一覧に出る。欄の名前の変更・削除で行は孤立する（付け替えの task は無い）

## Verification

- `pnpm test src/features/core/messaging/services/server/overrides`
