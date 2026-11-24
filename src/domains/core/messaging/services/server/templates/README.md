# templates（保存されたテンプレート）

## Overview

管理者が画面で書く連絡の中身と版の履歴（`messagingService.*MessageTemplate*`。service でも管理者を確かめる）。中身 = カテゴリー + レイアウト + 欄の中身 + 専用の埋め込み情報の宣言（D113・D126）。送る時は送信が版を固定する（../sendMessage/README.md）。画面は ../../../components/README.md。

- 門: `messagingTemplates`（`dependsOn: ["messagingDispatches"]`、既定 閉、住所 `/admin/messaging/templates` と `/api/admin/messaging/templates`）。閉の間 画面と API は 404
- 状態は持たない: 下書きは無く（保存 = 公開、D134）、要らなくなれば消す（D137。取り下げ・アーカイブは無い）
- テンプレートは DB の物だけ（システムテンプレートは廃止、D171・D201）。自由連絡はレイアウトを直に選んでも送れる（../sendMessage/README.md「自由連絡」）

## API

admin のみ。返す形は `dto.ts`（一覧・版の DTO は `categoryLabel` = カテゴリーの受け口の label か null。一覧・1 件は `layout`・`values`・`usable`（false = レイアウトが無効（`disabled`）か受け口に無い。画面は「使えない」の印、送る画面に並ばず送る口が 400）を持つ）。

- 入力（作る・直す）: `{ name, description?, category, layout, values, vars? }`。直す時はどれも省略できる。レイアウトを替える時は新しいレイアウトの `values` も要る（前のレイアウトの中身は持ち越さない、D113。無ければ 400）
- 1 件: + `layoutVersion`・`vars`（専用の宣言）・`catalog`（文面に書ける埋め込み情報の一覧 `{ key, alias, source: common | enricher | own, description }`）。直した結果（`PATCH`）は + `unchanged`（新しい版を作らなかった）= `AdminTemplateSaveResult`
- 版: `{ version, layout, layoutVersion, values, vars, category, categoryLabel, editedBy, createdAt }`

- `GET /`（`kind`（その種別のカテゴリーのテンプレートだけ、D135）・`q`（文字 1〜100 字: 名前か文面 = 欄の中身の文字列のどれかに含む。欄の名前はレイアウトが決めるので件名・本文・ブロックの字・ボタンの字を区別しない。大文字小文字を区別しない、字そのまま）・`cursor`・`limit`。client `listMessageTemplates({ kind?, q?, cursor?, limit? })`、hook `useMessageTemplates({ q? })`、管理の一覧の検索の流れは `useAdminMessageTemplateList` の `search`）/ `POST /` 作って公開（版 1）/ `GET・PATCH・DELETE /[id]`（PATCH = 直して公開、DELETE = 消す → `{ id, deleted: true }`）/ `GET /[id]/versions`（新しい順）/ `GET /[id]/versions/[version]`。id は uuid（ほかの形は 404「テンプレートがありません」）
- `GET /options`: 有効な送信チャンネル・カテゴリー `{ key, label, description, kind, channels }`（`kind` = 種別、画面は種別 →（カテゴリー）の順に選ぶ。`channels` = そのカテゴリーで送る使える送信チャンネル、プレビューのタブと送信チャンネルだけの欄はこの分、D115）（種別 announcement・direct・promotion のカテゴリーだけ）・`layouts`（管理者が選べるレイアウト `{ key, label, description, version, fields }`、無効の物は出さない）・`initialLayout`（作る画面が最初に開くレイアウト = config の `initialLayout`）・`baseCatalog`（専用の宣言の前から書ける埋め込み情報）。どれも受け口なので fork の物も入る
- `POST /api/admin/messaging/layouts/preview`（`previewMessageLayout`、門 `messagingTemplates` か `messagingBroadcast` が開）: `{ layout, channel, category?, values }` を保存せずに描く。管理者が選べるレイアウトだけ、描き方は送る口と同じ 3 段（`buildChannelContent`、メールはレイアウトの描き方 `layoutEmails` があればそれ）、送信チャンネルの `preview` が送る HTML を返す。`{{名前}}` は差し込まずそのまま。`category` は好みに従う種別（送る時と同じ `honoursPreferences`）のカテゴリーの時だけ停止のリンクの見本を出す。返す形 `{ channel, html, text, title, summary, cannotRender }`（描けなければ `cannotRender` に理由、D114・D124）
- 監査: `messaging.template.created`（版 1）/ `updated`（版の番号・新しい版を作ったか `newVersion`）/ `deleted`（名前・最後の版 `lastVersion`）（対象 `message_template`）

## Internals

- 保存 = 公開（D134、画面から 1 回の呼び出し）: 作る = 行と版 1 を 1 つの取引で書く。直す = 行を書き、中身（カテゴリー・レイアウト・レイアウトの版・欄の中身・専用の宣言）が最新の版と違えば同じ取引で `message_template_versions` に版を追記して `current_version` を進める。同じなら版を作らず `unchanged: true`（409 にしない。名前・説明だけの変更も版を作らない）。行の中身はいつも最新の版と同じ。**版は書き換えない**。版は レイアウト・レイアウトの版・欄の中身・専用の宣言・カテゴリーを持ち、送信チャンネルは持たない（送る送信チャンネルは送る時のカテゴリーの送信チャンネル）。レイアウトが改版していれば直す時に今の版へ読み替える（読めなければ 409）
- 鍵: 作る時にサーバーが作る（`tpl-` + 英小文字・数字 10 字、`newTemplateKey`）。入力の `key` は 400。運営する人には見せない
- 消す（D137、`deleteTemplate`）: 行を消す 1 つの取引。版は FK の cascade で消え、送信は残る（`template_id` は FK の set null で null、版の番号 `template_version`・中身は送信のまま = 送信の DTO の `templateDeleted`）。予約・送り直し・同じ内容で送るは送信の中身だけで描くのでテンプレートが無くても送れる。画像: 欄の中身を残している送信（消していない送信）が使う `storage://` の参照は、同じ取引で送信に結び直す（受け取り箱と同じ `bindInboxImages`: 送信の持ち物でなければ複製を送信に attach、送信の `values` の参照を書き換え、`metadata.inboxImages` に対応を残す）。テンプレートの行が消えると storage の照合がテンプレートの画像を外すため
- 保存時の検査（作る・直すの前に 1 回、`checks.ts`）: カテゴリーは種別 announcement・direct・promotion（ほかは 400）/ レイアウトは受け口にあり、無効（`disabled`）でなく `adminSelectable` / `values` はそのカテゴリーの送信チャンネルで使う欄の zod（`layoutValuesSchema`）/ 専用の宣言は lib の `messageVarDeclarationSchema`（鍵・日本語の別名・型 line・number・date・datetime・url・select・必須・既定値）/ 一覧（共通 + 管理者が送れる種別のどれにも当たる enrichers + 専用）の鍵・別名が重ならない（`checkVarCatalog`、D126）/ 文面の `{{鍵}}`・`{{別名}}` は一覧の中だけ（`findVar`）
- **秘密はテンプレートを通さない**: 専用の型に秘密は無い（秘密はコードの定義の `secretVar`）。受信者ごとの値も無い（専用の値は送信に 1 組、送る人が入れる）
- 画像（`imageBinding.ts`）: 欄の中身の `storage://`（画像のブロックなど）は保存の時に台帳でテンプレートの行に結ぶ（record `messaging.template` / id / `values`、用途 `notification.image`）。自分が上げた未紐付けは attach、ほかの業務行の物・別の人の物は複製して参照を書き換える。中身から外しても台帳からは外さない（前の版が使う）。storage の照合（cron storage-sweep の `recordResolvers`、`templateRecords.ts`）はテンプレートの行があれば残す

## Verification

- `pnpm test src/domains/core/messaging/services/server/templates`
