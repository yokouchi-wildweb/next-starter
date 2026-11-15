# overrides（管理画面の文言の上書き）

## Overview

定義が `adminEditable` で宣言した欄だけを、管理者が管理画面で直す（デザインと変数はコードのまま）。`messagingService.listMessageOverrides` / `getMessageOverrides` / `saveMessageOverride` / `resetMessageOverride`（service でも管理者を確かめる）。画面は ../../../components/README.md。

- 門: `messagingOverrides`（`dependsOn: ["messagingDispatches"]`、既定 閉、住所 `/admin/messaging/overrides` と `/api/admin/messaging/overrides`）。閉の間 画面と API は 404 で、送る口は DB の値を使わない。表は残る
- 上流で直せる連絡: `user.registrationComplete` / `user.earlyRegistrationComplete`（email の subject・heading・paragraphs）・`wallet.expiringNotice` / `wallet.expiredNotice`（email の subject・paragraphs、inApp の title・body）・`wallet.adjustmentNotice`（inApp の title・body）。URL を持つ cta・preheader・footer はコードだけ。認証の連絡・required・管理者が書く連絡 3 本は直せない
- fork の連絡も定義か `.override.ts` で `adminEditable` を宣言できる（required は不可）

## API

- `GET /` 一覧: fork の上書きを重ねた後に `adminEditable` がある（か行が残る）連絡と数（直した・孤立・コードが変わった）。DTO は連絡の `label`・`categoryLabel`
- `GET /[key]` 1 件: 欄ごとに `codeValue`・`value`・`effective`（送る時の値）・`edited`・`codeChanged`・`orphan` + `problem`、直せなくなった欄（`editable: false`、戻すだけ）、使ってよい鍵 `allowedKeys`
- `PUT /[key]` `{ fieldPath, value }`（誤りは 400）/ `DELETE /[key]?field=<経路.欄>`（行が無ければ 404）
- 監査: `messaging.override.updated` / `messaging.override.reset`（対象 `message_override`、`<鍵>:<欄>`、値は残さない）

## Internals

- 表 `message_overrides`: 直した欄だけ行（`message_key`・`field_path` = `<経路>.<欄>`・`value`・`code_value` = 直した時のコードの値・`updated_by`、UNIQUE(message_key, field_path)）。既定に戻す = 行を消す
- 重なる順（門が開）: 管理画面の値 > fork の上書き > 上流の既定（欄ごと）。重ねるのは送る口の `resolveDefinition` の 1 か所
- 送る時の検査は保存と同じ（lib/messaging `checkAdminFieldValue`）: 今も `adminEditable` にある・欄の型・配列はコードと同じ長さ・`{{鍵}}` は vars（秘密を除く）∪ 共通の文脈 ∪ provides。通らない欄（孤立）はその欄だけコードの値で送り警告を出す。欄の名前の変更・削除で行は孤立する（付け替えの task は無い）

## Verification

- `pnpm test src/features/core/messaging/services/server/overrides` と `services/server/sendMessage/adminOverrides.test.ts`
