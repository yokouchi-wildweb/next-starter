# lib/messaging

連絡(システム・管理者 → 宛先 1 人への一方向の連絡: メール・お知らせ・LINE・fork の経路)の仕組みの側。表を持たない(記録・宛先の解決・配信停止はドメイン messaging が持つ)。

- 入口: `@/lib/messaging`(閉じた lib。package.json の exports だけを外から読む)
- 今あるもの: 連絡の定義の型・上書きの型・上書きの点の宣言(extensionPoints.ts)・生成の一覧の型・定義の読み手の検査・経路の失敗の型・messaging の受け口の項目の型
- 読み手(送る口・記録・購読の cron)は連絡のドメイン messaging が持つ(作り直しの切り替えで作る)

## 連絡の定義(defineMessage)

連絡 1 本 = 起こすドメインの `messages/<名前>.ts` に定義 1 つ(データだけ。送る処理は持たない)。`export const message = defineMessage({ … })` の形で書く(`pnpm check extensions` が字面で読む。default export・別名は止まる)。中身 = ひな形(`layout`、下の「ひな形」)+ ひな形の欄の中身(`values`、D122)。経路ごとの中身は持たず、送る口が経路ごとに描き方の 3 段(ひな形の描き方 > 経路の汎用 > 要約、D124)で描く。

```ts
import { z } from "zod";
import { defineMessage } from "@/lib/messaging";

export const message = defineMessage({
  key: "auth.verification",
  category: "emailVerification", // 種別(functional)と経路(email)は種類から引く
  vars: z.object({ verificationUrl: z.string().url() }),
  required: true,
  record: "meta",
  layout: "link", // ひな形(messaging の layouts の受け口のフォルダの名前)
  values: {
    subject: "メールアドレスの確認",
    heading: "メールアドレスの確認",
    received: "{{recipientName}} 様、{{serviceName}} への登録を受け付けました。",
    button: { label: "確認する", url: "{{verificationUrl}}" },
    footer: "心当たりがない場合は無視してください。",
  },
});
```

項目:

- `key`: `<domain>.<name>`(英数字の camelCase)
- `label`(必須、D46): 管理画面に出す連絡の名前(日本語。例 `"パスワードの再設定"`)。運営する人は鍵を読まないので、管理画面(文言の上書き・回の送り元)は鍵でなくこれを出す。表示だけなので上書きで変えられる(種類の label と同じ)。無い・空は誤り: 字面は `pnpm check extensions`(messageGuards)、実行時は `validateMessageDefinition`(`missing_label`)。`pnpm generate message` は `--label` で書く
- `category`(必須、D81): 種類 = categories の受け口の鍵。種類は利用者から見て 1 つの出来事(D79)で、種別(kind)と経路(channels)を持つ。連絡は種別も経路も書かず、種類から引く(D86)。受け口に無い鍵は誤り: 字面は `pnpm check extensions`(messageGuards)、実行時は `validateMessageDefinition` の `categories`(`unknown_category`)。種類は上書きで付け替えない(D74: 別の種類で送りたいなら上流の連絡を止めて自分の連絡を足す)
- 種別(種類が持つ、7 つ・fork は増やせない): `functional`(機能に組み込まれた連絡)/ `transactional`(本人の手続きの知らせ)/ `security`(セキュリティの警告)/ `announcement`(運営の告知)/ `direct`(運営から特定の利用者へ)/ `activity`(利用者が止められる、利用に伴う知らせ)/ `promotion`(宣伝)。性質は `MESSAGE_KIND_TRAITS`(`definition/kinds.ts`、D80): 上流の物を止められるか(`upstreamDisable`、functional だけ不可)・利用者の停止と好み(`userStoppable`、activity・promotion)・住所の停止(`addressStop`、functional・security は hard bounce だけ)・管理者がその場で送れる宛先(`adminFreeText`、announcement・direct・promotion)・記録の既定(`recordDefault`)・文言の上書き(`adminTextOverride`、functional は不可)・間引き(`throttle`、functional・security は不可)・種類の経路から email を外せないか(`emailFixed`、functional・security)・送る口の中ですぐ送るか(`sendInEntry`、security: 予約と全員・ロール・グループ宛ては 400、宛先が多くても展開して最初の 1 束を口の中で送る)。種別の値で分ける読み手はこの表を引く(`kindTraits` / `kindsWhere`)
- `vars`: 呼び手が渡す値の zod
  - 秘密の値(トークン入りの URL・ワンタイムコード)は `secretVar(z.string())` で印を付ける。印の鍵を持つ連絡は描いた本文をどこにも残さず(`record: "full"` でも)、vars の写しからその鍵を落とす(送る口が守る)。印は `isSecretVar` / `listSecretVarKeys` で読む。vars は上書きできないので印は外せない
- `required`: 止められない連絡(認証など)。`enabled: false`・email の除外・`adminEditableOnly`・`throttle` を付けられない
- `adminEditableOnly`: 管理画面で直せる欄の絞り(ひな形の欄の鍵、D132)。無い = ひな形の欄のうち種類の経路で使う物を全部直せる(`adminEditableFields`: 種別の性質 `adminTextOverride` が true で required でない連絡)。書いた時だけその欄に絞る。required の連絡は付けない。ひな形に無い鍵は `unknown_admin_editable`
- `record`: 本文の残し方 `meta` | `vars`(既定)| `full`
- `throttle`: 会話の間引き `{ by: [vars の鍵], mode: "untilRead" | "window", seconds }`
- `layout`(必須、D122): ひな形の鍵(`src/features/core/messaging/layouts/<名前>/`。上流は notice・link・welcome・statement・alert)。受け口に無い鍵は誤り: 字面は `pnpm check extensions`(messageGuards)、実行時は `validateMessageDefinition` の `layouts`(`unknown_layout`)。上書きで変えられない
- `values`: ひな形の欄の中身(欄の鍵 → 値。文字列に `{{鍵}}` を書ける)。ひな形の欄の zod(`layoutValuesSchema`、種類の経路で使う欄だけ必須 D125)を通る(`invalid_values`)
- `extras`: fork が足す欄の入れ物
- 管理者が書いて送る連絡は定義を持たない(D117): 白紙のシステムテンプレート(`MessageSystemTemplate`、受け口の項目の節)か DB のテンプレート + 欄の中身で送る(`messagingService.sendTemplateMessage`)

## 定義で間違えやすい線(D77)

定義の側の線。運用の側(その回は絞るだけ・種別まるごとの停止はデータだけ・グループは見出しだけ・法の義務の告知はメールを含める)は src/features/core/messaging/README.md の「運用で間違えやすい線」。

### 種別と経路は種類(category)が持つ

- 設計の意図: 配信停止の単位は種類 × 経路、止められるかなどの性質は種別。連絡ごとに書けると、同じ種類の中で経路や性質がばらけ、利用者の切ったマスと届く物がずれる(D81・D86)
- どう書くか: 定義は `category` だけを書く(`kind`・`channels` は書けない)。経路は種類の `channels`、種別は種類の `kind`。種別の一覧と性質は上の項目の `MESSAGE_KIND_TRAITS`

### 種類の粒 = 利用者から見て 1 つの出来事(D79)

- 設計の意図: 種類は停止の単位で、集計と絞り込みの物差し。粒が種別ごと・ドメインごとにばらけると、止める単位も数える単位も揃わない。止められない種別の種類も同じ粒にする
- どう書くか: 「〜した時」と言える単位で切る。属する連絡はその出来事の文言・条件の違い。ドメイン・機能の単位(auth・account・wallet-expiry など)にはしない
  - 例: いいねをされた時(likeReceived)・フォローされた時・出品した物が売れた時(itemSold)・投稿にコメントが付いた時・メールアドレスの確認(emailVerification)・パスワードの再設定(passwordReset)・アカウントのロック(accountLocked)・会員登録が完了した時(registrationComplete)・ポイントの失効が近づいた時(walletExpiring)・ポイントが失効した時(walletExpired)
  - 上流の種類の一覧: src/features/core/messaging/README.md「連絡を足す」

### 種類と種別は付け替えない(止めて足す)

- 設計の意図: 上書きで種類・種別を変えると、止めた行・集計・上流の検査が知らないうちに変わる(D74)
- どう書くか: 連絡の上書きは `category` を変えられず、種類の上書きは `key`・`kind` を変えられない(`label`・`description`・`channels`・`group` だけ)。別の種類で送りたい = 上流の連絡を `enabled: false` で止め、自分の種類と連絡を足す(例は messaging の README)

### 機能の連絡(functional)は止められない

- 設計の意図: 止めると機能が壊れる(D68)。性質 `upstreamDisable: false`・`adminTextOverride: false`・`throttle: false`・`emailFixed: true`
- どう書くか: 上書きの `enabled: false`・種類の上書きで email を外すことは `pnpm check extensions`(messageGuards)で、管理画面の文言の欄(`adminEditableOnly`)・間引きは実行時の `validateMessageDefinition`(`kind_admin_editable` / `kind_throttle`)でも止まる。文面は上書きの `values` か、ひな形の描き方の `.replace` で変える

## 差し込み({{鍵}})

- 書式は `lib/structuredDocument` の差し込み 1 本(`replaceVariables`・`listVariables`)。名前は文字(日本語も)・数字・_ の並びで、空白・点を含む名前は差し込まれない
- 差し込める鍵 = `vars` の鍵 ∪ 共通の文脈 `COMMON_CONTEXT_KEYS`(`recipientName`・`recipientEmail`・`serviceName`・`appBaseUrl`。送る口が埋める)∪ throttle のある連絡だけ `collapsedCount`
- enrichers の `provides` の鍵は `validateMessageDefinition(def, { variableKeys })` で足して許す(送る口がその連絡に当たる enrichers の鍵を渡す。当たるか = 当て先 `enricherTargets`、下の受け口)

## 埋め込み情報(embedded/、D111・D112・D126)

文面に `{{名前}}` で書く値を「埋め込み情報」と呼ぶ。名前は英語の鍵と日本語の別名の 2 つで、どちらで書いても同じ値で埋まる(`{{displayName}}` = `{{表示名}}`)。

- 共通の埋め込み情報 `MESSAGE_COMMON_EMBEDDED`(`embedded/common.ts`、鍵・別名・説明の 1 か所。`COMMON_CONTEXT_KEYS`・`THROTTLE_CONTEXT_KEYS` もここから): `recipientName` 受信者名・`recipientEmail` 受信者のメール・`serviceName` サービス名・`serviceNameShort` サービスの短い名前・`appBaseUrl` サイトのURL・`collapsedCount` まとめた件数(間引きのある連絡だけ)
- enrichers は足す値ごとに別名を宣言する(`MessageEnricher.aliases`、provides の全部の鍵に要る)。上流の `displayName` は「表示名」
- 専用の埋め込み情報(テンプレートが宣言する)`MessageEmbeddedDeclaration` = `{ key, alias, type, options?, required, default? }`。型 `line`(1 行の文)・`number`・`date`(YYYY-MM-DD)・`datetime`(ISO 8601、時差つき)・`url`・`select`(`options` の value)。保存の検査 `messageEmbeddedDeclarationSchema`、送る時の値の検査 `embeddedValueSchema` / `embeddedValuesSchema`(空は既定値、必須で既定値も無ければ誤り、差し込む字にする)
- 一覧 `embeddedCatalog({ own, enrichers, throttle })` = 共通 + 当たる enrichers + 専用。`checkEmbeddedCatalog` が止める: 鍵の形(英字で始まる英数字)・別名の形(空白・記号なし、英数字以外の字を含む)・鍵の重なり・別名の重なり(専用どうしも共通・enrichers の名前とも)・enrichers の別名の欠け
- 日付・日時の専用の値: 残す値は ISO のまま。`embeddedValuesSchema` が隣に型の印 `<鍵>@type`(`EMBEDDED_TYPE_SUFFIX`、書式 {{名前}} に拾われない)を出し、回の値と一緒に残る。差し込む時に `displayEmbeddedValues` が人が読む字にする(`embeddedDisplayText`: 2026年12月1日 / 2026年12月1日 11:00、日本時間)
- 差し込み: `findEmbedded(文面, 一覧)` = 書かれた名前を鍵に直した並びと一覧に無い名前(保存・送る前に拒む)。`embeddedVariableMap(鍵 → 値, 一覧)` = 別名の行を足した表(`replaceVariables` に渡す)
- 定義の検査(`validateMessageDefinition`)と管理画面の値の鍵(`adminFieldAllowedKeys`)は共通の別名を通す(enrichers の鍵と別名は呼び手が `variableKeys` で渡す)。送る口は差し込みの表に別名の行を足し、テンプレートの保存・送る前の検査は一覧で名前を確かめる(features/core/messaging)

## 上書き(MessageOverride)

`messages/<名前>.override.ts`(データだけ)。変えられるのは名前 `label`(管理画面の表示名)・ひな形の欄の中身 `values`(欄ごとに差し替え)・`extras`・`enabled`・`adminEditableOnly`・`record`・`throttle`(`null` で外す)。`key`・`vars`・`required`・`category`・`layout` は変えられない(経路は種類の上書き `categories/<名前>.override.ts` の `channels` で変える。上流の functional の連絡は止められない、D68)。

```ts
// src/features/core/auth/messages/verification.override.ts(fork)
import type { MessageOverride } from "@/lib/messaging";

export const messageOverride = {
  values: { subject: "【{{serviceName}}】メールアドレスの確認" },
} satisfies MessageOverride;
```

- 上書きの点 = この lib の `extensionPoints.ts` の `messages`(`overrides: "src/features/**/messages/*.ts"`、直下だけ。見た目はひな形の描き方の 1 行スイッチの `.replace`)。書ける鍵は宣言の `overrideOf`(`MessageOverride` の鍵と同じ。テストが固定)
- 形は `export const messageOverride = { … }`(`satisfies MessageOverride` 可)。関数で包むと字面で読めないので止まる
- 上流(Tier1)は上書きを出荷しない(`pnpm check extensions`)
- `applyMessageOverride(definition, override)` で重ねた結果(`enabled` つき)を得る。元の定義は変えない

## 字面の守り(pnpm check extensions)

生成の前に字面で止める(`scripts/structure/extensions/derive/messageGuards.mjs`。実行時は送る口が同じ守りを `validateMessageDefinition` で見る):

- 全部の定義: `label`(字面の空でない文字列)が無い / `category` が無い・受け口に無い / `layout` が無い・ひな形の受け口のフォルダに無い
- required の定義: 種類の経路に `"email"` が無い・`adminEditableOnly` が空でない・`throttle` がある。その上書き: `enabled: false`・空でない `adminEditableOnly`・`throttle`(`null` で外すのは通す)
- 上流(`src/features/core`)の functional の種類の連絡: 上書きで `enabled: false`
- 種類の上書き(`categories/<名前>.override.ts`): functional・security の種類の `channels` から `"email"` を外す・空にする。`group` が categoryGroups の受け口に無い・1 つのグループに別の種別の種類
- 守りに関わる値(定義の `required`・`category`・`adminEditableOnly`、上書きの `enabled`・`adminEditableOnly`、種類の `kind`・`channels`・`group`)はリテラルで書く(変数・式は止まる)。種別の性質は `definition/kinds.ts` を字面で読む

## 生成の一覧(src/registry/messageRegistry.ts)

`pnpm generate registry` が全ドメインの `messages/<名前>.ts`(直下。`.override`・`.test` を除く)を字面で読み、鍵 → 項目の一覧を書く(`scripts/structure/registry/alpha/messageRegistry.mjs`)。送る口・管理画面・プレビューはこれを読む(server-only)。

- 鍵 = `<ドメインのフォルダ名>.<ファイル名>`(例 `src/features/core/auth/messages/verification.ts` → `auth.verification`)。定義の `key` はこの値の文字列リテラルで書く(ずれ・重なりは生成が止める)
- 項目 `MessageRegistryEntry` = `{ key, definition, override? }`。どれも遅延 import(`definition` → `{ message }`、`override` → `{ messageOverride }`)。描き方はひな形が持つ(連絡ごとの描き方のフォルダは持たない。前の形の view のフォルダが残っていれば生成が止まる)
- ファイル名は英小文字始まりの camelCase(点や印は付けない)
- 全件の検査(L2.2): `src/features/core/messaging/services/server/sendMessage/messageRegistry.test.ts` が一覧の全件に上書きを重ねて `validateMessageDefinition` をかけ、鍵の一致と種類の経路の全部で描けることを確かめる(`checkMessageRegistry`)
- 生成は字面だけを読み、定義を実行しない。欄・`{{鍵}}` などの値は送る口が `validateMessageDefinition` で見る

## 定義の読み手の検査(validateMessageDefinition)

`validateMessageDefinition(definition, { categories, layouts, override?, channels?, variableKeys? })` → 問題の一覧(空 = 通る)。`layouts` = ひな形の受け口(鍵 → ひな形)。上書きを渡すと重ねた結果を検査する。`categories` = 種類の受け口(鍵 → 項目、fork の種類の上書きを重ねた後)。`resolveMessageDefinition(definition, override, category)` が上書きを重ね種別と経路を付けた定義を返す(`applyMessageOverride` は上書きだけ)。種類の受け口は `validateMessageCategories(categories, groups)`(種別・経路・グループ)。

- `invalid_key`: 鍵の形
- `missing_label`: 名前(label)が無い・空(上書きの label も見る)
- `required_disabled` / `required_without_email` / `required_admin_editable` / `required_throttle`: required の守り
- `unknown_category`: 種類が受け口に無い
- `kind_admin_editable` / `kind_throttle`: 種別の性質で文言の上書き・間引きが無い種別(functional・security)
- `unknown_channel`: 種類の経路が経路の受け口に無い
- `unknown_layout` / `invalid_values`: ひな形が受け口に無い / 欄の中身がひな形の欄の zod(種類の経路で使う欄)を通らない
- `unknown_admin_editable`: adminEditableOnly の鍵がひな形の欄に無い
- `unknown_variable`: 欄の中身の `{{鍵}}` が vars ∪ 共通の文脈に無い
- `invalid_throttle`: throttle.by が vars に無い・seconds が正でない
- `override_forbidden_key`: 上書きが key・kind・vars・required・category・defaultChannels を持つ

## 管理画面の欄の値(adminFields.ts)

管理画面で直した欄の値(文言の上書き、D21・D24・D28・D132)を、保存する口・送る口・プレビューが同じ純粋な関数で検査し重ねる。欄の道 = ひな形の欄の鍵(組・並び・ブロックの並びは欄ごと丸ごと)。

- `adminEditableFields(resolved, layout)` → 直せる欄(欄の鍵、宣言の順)。ひな形の欄のうち種類の経路で使う物の全部(経路だけの欄はその経路が種類にある時だけ)、`adminEditableOnly`(欄の鍵の並び)があればその中だけ。種別の性質 `adminTextOverride` が false・required は空
- `checkAdminFieldValue(resolved, layout, fieldPath, value, { variableKeys? })` → 問題(null = 通る)。`resolved` = 上書きを重ねた後の定義
  - `not_editable`: 今の直せる欄に無い / `invalid_value`: 欄の宣言の zod を通らない(必須は空にできない) / `unknown_variable`: 使えない `{{鍵}}`
- `moveAdminFieldPath(layout, fieldPath, layoutVersion)` → 今の版の欄の鍵か `{ unusable: 理由 }`(改版の対応 `revisions` を段ごとに当てる。捨てた欄・段の対応が無い・今より新しい版・版の無い古い形の行 = 使えない)
- `readAdminFieldValue(resolved, layout, row, options)` → 今の版へ移して検査した結果(移せない = `unusable`)
- `applyAdminFieldValues(resolved, layout, rows, options)` → `{ resolved, applied, rejected }`: 当てられる行だけ `values` に欄ごとに重ねる(送る口の `resolveDefinition` が門の開いた時に呼ぶ)
- `adminFieldAllowedKeys(resolved, variableKeys)`: 使ってよい鍵 = vars(`secretVar` の鍵を除く)・共通の文脈・throttle の鍵・`variableKeys`(当たる enrichers の provides)
- `adminFieldCodeValue(resolved, fieldPath)`: 欄のコードの値(定義の `values` の欄、fork の override を重ねた後)

## ひな形(layout/、D122〜D124)

連絡の見た目の型。ひな形 = 欄の宣言・仮の文・要約(必須)・管理者が選べる印・改版の対応。種別・カテゴリー・経路を知らない(経路だけの欄は欄の `channels` に経路の鍵を値として持つだけ)。経路ごとの描き方はひな形のフォルダのファイル(server = email、client = inApp)が持ち、型は持たない。連絡の定義はひな形の鍵と欄の中身を持ち、送る口は経路ごとに下の 3 段で描く(経路は自分の欄を持たない。管理画面の入力とプレビューもひな形の欄の宣言と描き方から。なぜこの形か = src/features/core/messaging/Internals.md)。

- `defineMessageLayout({ key, label, description?, fields, summary, adminSelectable?, version?, revisions? })`: 欄の宣言から中身の型(`MessageLayoutValues`)を引く。`version` = 版(既定 1、`layoutVersionOf`)
- 欄の宣言 `MessageFieldSpec`: `type`(語彙)・`label`・`placeholder?`・`required?`・`channels?`(使う経路の鍵、無い = 全部)。`select` は `options`、`list` は `of`・`min?`・`max?`、`group` は `fields`、`blocks` は `allow?`・`min?`・`max?`
- 欄の型の語彙(`layout/vocabulary.ts`、lib で固定。fork は増やさず、入力の部品を src/wiring/formInputs に登録する): `line` 1 行の文・`paragraph` 段落・`longText` 長い文・`image` 画像(storage:// の参照か URL)・`button` ボタン `{ label, url }`・`link` リンク `{ label?, url }`・`date` 日付 YYYY-MM-DD・`number` 数・`select` 選択肢・`list` 並び・`group` 組・`keyValue` 項目と値 `[{ key, value }]`・`blocks` ブロックの並び。型ごとの zod は `fieldValueSchema(shape)`
- ブロック(`layout/blocks.ts`): `heading` 小見出し・`paragraph` 段落・`button` ボタン・`image` 画像・`divider` 区切り・`keyValueTable` 項目と値の表・`bulletList` 箇条書き。`messageBlocksSchema({ allow?, min?, max? })` が許す種類と数で絞る(知らない種類は通らない)
- 要約 `MessageLayoutSummary` = `{ title, body, image?, link?: { label?, url }, shortBody? }`(プッシュ・LINE は `shortBody ?? body`)
- 中身の検査 `layoutValuesSchema(layout, { channels? })`: 必須を守る(空文字・空の並びも通さない)。`channels` を渡すと、そのどれにも使われない経路だけの欄は求めない。知らない鍵は通らない。経路の欄だけ = `fieldsForChannel(layout, channel)`
- 改版(D122・D128): 欄の鍵を変えた・消した時に `version` を 1 上げ、`revisions` にその段の対応を書く(`{ [上げる前の版]: { 前の鍵: 新しい鍵 | null } }`、1 から今の版の 1 つ前まで全部の段。鍵の変わらない段も `{}`)。`applyLayoutRevisions(values, 段)` = 1 段(`null` は捨てる、新しい鍵に値があれば今の値を残す)、`upgradeLayoutValues(layout, values, fromVersion)` = 送った版から今の版まで段ごとに当てる(段が無い・今より新しい版 = `{ cannotRender }`)。回の values・テンプレートの保存値・文言の上書きに当てる
- 描き方の 3 段 `resolveRendering({ layout, channelKey, hasLayoutRenderer, channel, values })`: ひな形のその経路の描き方(`{ from: "layout" }`)> 経路の汎用の描き方(`renderGeneric`、`genericFieldTypes` が経路の欄の型を全部含む時、`{ from: "channel", fields }`)> 要約(経路が `summaryRenderable: true` と `renderFromSummary` を持つ時、`{ from: "summary", summary }`)。どれでも描けない・要約が投げる = `{ cannotRender: 理由 }`。テンプレートの保存・プレビュー・送る前の検査がこれで止める。経路の宣言の型は `MessageChannelRendering`(`rendersAtSend?: true` = 送る時に宛先ごとに描く経路、例 email の停止のリンク)
- 経路 1 つの組み立て `buildChannelContent({ layout, channelKey, channel, hasLayoutRenderer, values })`(`layout/content.ts`): その経路が使う欄だけ → 要約 → 3 段 → 中身 `{ content, title }`(title = 要約の題)か `{ cannotRender }`。ひな形の描き方の段と `rendersAtSend` の経路は `MessageLayoutContent`(`{ title, layout, from, values, summary }`、経路が送る時に段に従って描く。判定 `isMessageLayoutContent`)、ほかは経路が描いた物(`content` があればそれ、無ければ `html` / `text`)。送る口の組み立て(messaging の `sendMessage/content.ts`)が経路ごとに呼ぶ

## 受け口の項目(receptacles/types.ts)

ドメイン messaging の受け口(`src/features/core/messaging/extensionPoints.ts`、表は `src/features/core/messaging/README.md`「受け口」)に置く項目の型。

- `MessageChannel`(経路): `key`・`label`・`addressing`(`user` = 利用者から引く / `address` = 宛先を直に)・`enabled?`(経路の入切、既定 true。false は項目が無い経路と同じ扱い = 配達の行は `channel_off`。値は項目が自分の設定から読む。門の機能ではない)・`resolveAddresses?`(既定は端末の帳簿)・`endpoint?`(帳簿を読む経路の宛先の形 `{ address: zod }`。端末の登録の口が検査し、変換後の値を残す。無ければ汎用の形)・`preview?`(管理の送信のプレビュー。送る時と同じ組み立ての中身を送る時と同じ描き方で描く。email = HTML。無い経路は中身をそのまま見せる)・`remove?`(届けた物の取り下げ `({ dispatchId }) => { removed }`、D89。管理の削除が呼ぶ。持つ経路 = 消せる経路。何度呼んでも同じ結果に書く)・`connectHref?`(宛先の無い利用者を案内する先 = サイト内のパスか URL。好みの表が宛先の無い経路に出す。連携の画面が無い経路は持たない)・`send(宛先の束)`(宛先 `ChannelSendTarget` = `userId`・`address`・`messageKey`(連絡の鍵)・`idempotencyKey`・`content`(組んだ中身: `MessageLayoutContent` か経路が描いた物)、好みに従う連絡だけ `category`(配信停止の種類)と送る側が付ける `headers`(List-Unsubscribe など))→ 宛先ごとの `ChannelSendResult`(`sent` か `transient` / `permanent` / `unknown`。宛先の失効が確定したときだけ `addressInvalid`)・`webhooks?`(provider → `{ verify, normalize }`。事件の形は lib/mail の webhook と同じ + 送る時にタグで渡した配達の id `deliveryId?`)
- `MessageEnricher`(値): `key`・`target`(当て先 D127 = `{ messages?: 連絡の鍵[], categories?: 種類の鍵[], kinds?: 種別[], all?: true }`、どれかに当たれば当てる。判定 `enricherTargets(target, { key, category, kind })`。使える鍵の検査と実行の両方がこれで選ぶ)・`provides`(足す変数の zod)・`resolve(文脈)`
- `MessageCategory`(種類 = 1 つの出来事、配信停止の単位 = 種類 × 経路): `key`・`label`・`description?`・`kind`(7 つ)・`channels`(届ける経路)・`group?`(設定画面の見出し `MessageCategoryGroup` の鍵、同じ種別だけ)。fork は上流の種類の `<名前>.override.ts` で `label`・`description`・`channels`・`group` を変えられる(鍵・種別は不可)
- `MessageCategoryGroup`(種類のグループ、`messaging/categoryGroups/<名前>.ts` の `export const group`): `key`・`label`・`order`。見出しだけで停止の単位ではない(D82)。上流は出荷しない
- `MessageSource`(送り元): `key`・`label`
- `MessageSystemTemplate`(システムテンプレート、`messaging/templates/<名前>.ts` の `export const systemTemplate`、D117・D125): `key`・`kind`(管理者がその場で送れる種別 = 性質 `adminFreeText` がある物、種別ごとに 1 つ)・`label`・`layout`・`values`(白紙の欄の中身)。管理の送信の白紙で、管理画面で直せない・消せない。fork は `<名前>.override.ts` で `label` だけ変えられる。上流は announcement・direct・promotion の 3 つ(ひな形 notice)
- `MessageSubscriber`(送った後の購読): `key`・`on`(事件の種類)・`filter?`(連絡の鍵・経路)・`handle(事件の束)`(事件の id + 購読の鍵で冪等に。投げると次回もう一度渡る)

## 経路の失敗(ChannelError)

経路の送信の失敗。`kind` = `transient`(一時)| `permanent`(恒久)| `unknown`(受付不明)で、lib/mail の `MailSendError` と同じ語彙(`src/lib/mail/errors.test.ts` が固定)。`channel`(経路の鍵)・`reason`(機械が読む理由)・`cause`。

## テスト

`pnpm test src/lib/messaging`
