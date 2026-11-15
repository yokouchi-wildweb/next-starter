# templates（保存されたテンプレート）

## Overview

管理者が画面で書く連絡の中身と版の履歴（`messagingService.*MessageTemplate*`。service でも管理者を確かめる）。送る時は回が版を固定する（../sendMessage/README.md）。画面は ../../../components/README.md。

- 門: `messagingTemplates`（`dependsOn: ["messagingDispatches"]`、既定 閉、住所 `/admin/messaging/templates` と `/api/admin/messaging/templates`）。閉の間 画面と API は 404
- 状態: `draft`（未公開）→ `published`（版がある）→ `archived`（取り下げ。直せない・公開できない、版は残る）

## API

admin のみ。返す形は `dto.ts`（一覧・版の DTO は `categoryLabel` = 種類の受け口の label か null）。

- `GET /`（`status`・`cursor`・`limit`）/ `POST /` 作る / `GET・PATCH /[id]` / `POST /[id]/publish` / `POST /[id]/archive` / `GET /[id]/versions`（新しい順）/ `GET /[id]/versions/[version]`
- `GET /options`: 有効な経路 `{ key, label }`・種類 `{ key, label, description }`（種別 announcement・direct・marketing の種類だけ）・`baseAllowedKeys`（変数の前から使える鍵）。経路と種類は受け口なので fork の物も入る
- 監査: `messaging.template.created` / `updated` / `published`（版の番号）/ `archived`（対象 `message_template`）

## Internals

- 行 = 今の中身（下書き）。公開 = 今の中身を `message_template_versions` に版として追記し `current_version` を進める。**公開した版は書き換えない**（公開済みを直すと `hasUnpublishedChanges`、次の公開で新しい版）。版は文言・変数・種類を持ち、経路は持たない（文言のある経路 = その版の経路）。前の版から変更の無い公開は 409
- 鍵: 作る時にサーバーが作る（`tpl-` + 英小文字・数字 10 字、`newTemplateKey`）。入力の `key` は 400。運営する人には見せない
- 保存時の検査（作る・直す・公開の前、`checks.ts`）: `content` の鍵は有効な経路・少なくとも 1 つの経路に文言・欄は経路の zod / 種類は種別 announcement・direct・marketing（ほかは 400）/ 変数は `MessageTemplateVariableSchema` の並び・鍵は一意で `{{鍵}}` に書ける形 / 本文の `{{鍵}}` は 共通の文脈 ∪ 管理の定義 3 本の provides ∪ 宣言した変数（`allowedKeys`）
- **秘密はテンプレートを通さない**: 型 `secret` の変数と、共通の文脈・throttle・provides と同じ鍵の変数は宣言できない（秘密はコードの定義の `secretVar`）
- 画像（`imageBinding.ts`）: 中身の `storage://`（`inApp.image` など）は保存の時に台帳でテンプレートの行に結ぶ（record `messaging.template` / id / `content`、用途 `notification.image`）。自分が上げた未紐付けは attach、ほかの業務行の物・別の人の物は複製して参照を書き換える。下書きから外しても台帳からは外さない（公開した版が使う）。storage の照合（cron storage-sweep の `recordResolvers`、`templateRecords.ts`）はテンプレートの行があれば残す

## Verification

- `pnpm test src/features/core/messaging/services/server/templates`
