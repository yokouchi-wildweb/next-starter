# templates（保存されたテンプレート）

## Overview

管理者が画面で書く連絡の中身と版の履歴（`messagingService.*MessageTemplate*`。service でも管理者を確かめる）。中身 = カテゴリー + ひな形 + 欄の中身 + 専用の埋め込み情報の宣言（D113・D126）。送る時は回が版を固定する（../sendMessage/README.md）。画面は ../../../components/README.md。

- 門: `messagingTemplates`（`dependsOn: ["messagingDispatches"]`、既定 閉、住所 `/admin/messaging/templates` と `/api/admin/messaging/templates`）。閉の間 画面と API は 404
- 状態: `draft`（未公開）→ `published`（版がある）→ `archived`（取り下げ。直せない・公開できない、版は残る）
- システムテンプレート（受け口 `messaging/templates` の白紙、D117・D125）も同じ一覧に印つきで並ぶ（読むだけ。下の「システムテンプレート」）

## API

admin のみ。返す形は `dto.ts`（一覧・版の DTO は `categoryLabel` = 種類の受け口の label か null。一覧・1 件は `system`・`kind`・`layout`・`values` を持つ。DB のテンプレートは `system: false`・`kind: null`）。

- 入力（作る・直す）: `{ name, description?, category, layout, values, embedded? }`。直す時はどれも省略できる。ひな形を替える時は新しいひな形の `values` も要る（前のひな形の中身は持ち越さない、D113。無ければ 400）
- 1 件: + `layoutVersion`・`embedded`（専用の宣言）・`catalog`（文面に書ける埋め込み情報の一覧 `{ key, alias, source: common | enricher | own, description }`）・`hasUnpublishedChanges`
- 版: `{ version, layout, layoutVersion, values, embedded, category, categoryLabel, editedBy, createdAt }`

- `GET /`（`status`・`cursor`・`limit`）/ `POST /` 作る / `GET・PATCH /[id]` / `POST /[id]/publish` / `POST /[id]/archive` / `GET /[id]/versions`（新しい順）/ `GET /[id]/versions/[version]`
- `GET /options`: 有効な経路・種類 `{ key, label, description, kind, channels }`（`kind` = 種別、画面は種別 →（種類）の順に選ぶ。`channels` = その種類で送る使える経路、プレビューのタブと経路だけの欄はこの分、D115）（種別 announcement・direct・promotion の種類だけ）・`layouts`（管理者が選べるひな形 `{ key, label, description, version, fields }`）・`baseCatalog`（専用の宣言の前から書ける埋め込み情報）。どれも受け口なので fork の物も入る
- `POST /api/admin/messaging/layouts/preview`（`previewMessageLayout`、門 `messagingTemplates` か `messagingBroadcast` が開）: `{ layout, channel, category?, values }` を保存せずに描く。管理者が選べるひな形だけ、描き方は送る口と同じ 3 段（`buildChannelContent`、メールはひな形の描き方 `layoutEmails` があればそれ）、経路の `preview` が送る HTML を返す。`{{名前}}` は差し込まずそのまま。返す形 `{ channel, html, text, title, summary, cannotRender }`（描けなければ `cannotRender` に理由、D114・D124）
- 監査: `messaging.template.created` / `updated` / `published`（版の番号）/ `archived`（対象 `message_template`）

### システムテンプレート

- 一覧: 最初のページ（`cursor` なし）の先頭に、受け口の順で `system: true`・`id` = `system:<鍵>`・`status: published`・`name` = 白紙の `label`・`kind`・`layout`・`values`（白紙の欄の中身）。`status` で `draft`・`archived` に絞った時は出さない。`category` は空（送る時に選ぶ）
- `GET /[id]`（`system:<鍵>`）: 同じ形 + `layoutVersion`（今の版）・`embedded: []`（白紙は専用の埋め込み情報を持たない）・`catalog`。無い鍵は 404
- `PATCH /[id]`・`POST /[id]/publish`・`POST /[id]/archive` は 409（コードで宣言した白紙は管理画面で直せない・消せない）。`GET /[id]/versions` は空、`GET /[id]/versions/[version]` は 404
- id は uuid でない（`system:` で始まる）。画面は id を uuid と決めつけない

## Internals

- 行 = 今の中身（下書き）。公開 = 今の中身を `message_template_versions` に版として追記し `current_version` を進める。**公開した版は書き換えない**（公開済みを直すと `hasUnpublishedChanges`、次の公開で新しい版）。版は ひな形・ひな形の版・欄の中身・専用の宣言・種類を持ち、経路は持たない（送る経路は送る時のカテゴリーの経路）。前の版から変更の無い公開は 409。ひな形が改版していれば直す・公開の時に今の版へ読み替える（読めなければ 409）
- 鍵: 作る時にサーバーが作る（`tpl-` + 英小文字・数字 10 字、`newTemplateKey`）。入力の `key` は 400。運営する人には見せない
- 保存時の検査（作る・直す・公開の前、`checks.ts`）: 種類は種別 announcement・direct・promotion（ほかは 400）/ ひな形は受け口にあり `adminSelectable` / `values` はその種類の経路で使う欄の zod（`layoutValuesSchema`）/ 専用の宣言は lib の `messageEmbeddedDeclarationSchema`（鍵・日本語の別名・型 line・number・date・datetime・url・select・必須・既定値）/ 一覧（共通 + 管理者が送れる種別のどれにも当たる enrichers + 専用）の鍵・別名が重ならない（`checkEmbeddedCatalog`、D126）/ 文面の `{{鍵}}`・`{{別名}}` は一覧の中だけ（`findEmbedded`）
- **秘密はテンプレートを通さない**: 専用の型に秘密は無い（秘密はコードの定義の `secretVar`）。受信者ごとの値も無い（専用の値は回に 1 組、送る人が入れる）
- 画像（`imageBinding.ts`）: 欄の中身の `storage://`（画像のブロックなど）は保存の時に台帳でテンプレートの行に結ぶ（record `messaging.template` / id / `values`、用途 `notification.image`）。自分が上げた未紐付けは attach、ほかの業務行の物・別の人の物は複製して参照を書き換える。下書きから外しても台帳からは外さない（公開した版が使う）。storage の照合（cron storage-sweep の `recordResolvers`、`templateRecords.ts`）はテンプレートの行があれば残す

## Verification

- `pnpm test src/features/core/messaging/services/server/templates`
