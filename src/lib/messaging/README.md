# lib/messaging

## Overview

- 連絡(システム・管理者 → 宛先 1 人への一方向の連絡: メール・お知らせ・LINE・fork の送信チャンネル)の仕組みの側。表を持たない(記録・宛先の解決・配信停止はドメイン messaging が持つ)
- 入口: `@/lib/messaging`(閉じた lib)
- 今あるもの: 連絡定義の型・上書きの型・上書きの点の宣言(extensionPoints.ts)・生成の一覧の型・定義の読み手の検査・送信チャンネルの失敗の型・messaging の受け口の項目の型
- 読み手(送る口・記録・購読の cron)は連絡のドメイン messaging が持つ
- 使う時・直す時の決まりは札 .claude/rules/items/lib/messaging.md にある。この README は使い方と仕組み

## Usage

### 連絡を定義する(defineMessage)

連絡 1 本 = 起こすドメインの `messages/<名前>.ts` に定義 1 つ(データだけ。送る処理は持たない)。`pnpm check extensions` が字面で読む(default export・別名は止まる)。中身 = レイアウト(`layout`、下の「レイアウト」)+ レイアウトの欄の中身(`values`)。送信チャンネルごとの中身は持たず、送る口が送信チャンネルごとに描き方の 3 段(レイアウトの描き方 > 送信チャンネルの汎用 > 要約)で描く。

```ts
import { z } from "zod";
import { defineMessage } from "@/lib/messaging";

export const message = defineMessage({
  key: "auth.verification",
  category: "emailVerification", // 種別(functional)と送信チャンネル(email)はカテゴリーから引く
  vars: z.object({ verificationUrl: z.string().url() }),
  varNames: { verificationUrl: { alias: "確認のURL", description: "メールアドレスを確かめるリンク" } },
  required: true,
  record: "meta",
  layout: "link", // レイアウト(messaging の layouts の受け口のフォルダの名前)
  values: {
    subject: "メールアドレスの確認",
    heading: "メールアドレスの確認",
    received: "{{recipientName}} 様、{{serviceName}} への登録を受け付けました。",
    button: { label: "確認する", url: "{{verificationUrl}}" },
    footer: "心当たりがない場合は無視してください。",
  },
});
```

### 上書き(MessageOverride)

`messages/<名前>.override.ts`(データだけ)。変えられるのは名前 `label`(管理画面の表示名)・レイアウトの欄の中身 `values`(欄ごとに差し替え)・`extras`・`enabled`・`adminEditableOnly`・`record`・`throttle`(`null` で外す)・所属のカテゴリー `category`(付け替え: fork のカテゴリーも可、種別が違ってもよい、functional の連絡も可 D166・D167。上流の呼び出しはそのままで属するカテゴリーだけが変わる)・管理者が送る画面の文 `adminText`(丸ごと差し替え)・送信チャンネルの固定 `channelModes`(丸ごと差し替え。カテゴリーを付け替える時は新しいカテゴリーの送信チャンネルで書き直す、外の送信チャンネルは `unknown_channel_mode`)。`key`・`vars`・`varNames`・`required`・`silent`・`layout` は変えられない(送信チャンネルの集まりはカテゴリーの上書き `categories/<名前>.override.ts` の `channels` で変える)。

種別の性質の検査(required の email・テキストの編集・間引き・email を外せない種別の email の off・上流の functional を止めない)は上書きを重ねた後の値(付け替えた先のカテゴリーの種別・送信チャンネル)に掛かる。functional の連絡をほかの種別のカテゴリーへ移すと、上書きで止められるようになる(D167: 付け替える fork には理由がある)。どのカテゴリーの項目を引くかは `messageCategoryKeyOf(definition, override)`。

```ts
// src/domains/core/auth/messages/verification.override.ts(fork)
import type { MessageOverride } from "@/lib/messaging";

export const messageOverride = {
  values: { subject: "【{{serviceName}}】メールアドレスの確認" },
} satisfies MessageOverride;
```

- 上書きの点 = この lib の `extensionPoints.ts` の `messages`(`overrides: "src/domains/**/messages/*.ts"`、直下だけ。見た目はレイアウトの描き方の 1 行スイッチの `.replace`)。書ける鍵は宣言の `overrideOf`(`MessageOverride` の鍵と同じ。テストが固定)
- 形は `export const messageOverride = { … }`(`satisfies MessageOverride` 可。関数で包むと字面で読めず止まる)
- `applyMessageOverride(definition, override)` で重ねた結果(`enabled` つき)を得る。元の定義は変えない

## API

### 定義の項目

項目:

- `key`: `<domain>.<name>`(英数字の camelCase)
- `label`(必須): 管理画面に出す連絡の名前(日本語。例 `"パスワードの再設定"`)。運営する人は鍵を読まないので、管理画面(テキストの編集・送信の送り元)は鍵でなくこれを出す。表示だけなので上書きで変えられる(カテゴリーの label と同じ)。無い・空は誤り: 字面は `pnpm check extensions`(messageGuards)、実行時は `validateMessageDefinition`(`missing_label`)。`pnpm generate message` は `--label` で書く
- `category`(必須): カテゴリー = categories の受け口の鍵。カテゴリーは利用者から見て 1 つの出来事で、種別(kind)と送信チャンネル(channels)を持つ。連絡は種別も送信チャンネルも書かず、カテゴリーから引く。受け口に無い鍵は誤り: 字面は `pnpm check extensions`(messageGuards)、実行時は `validateMessageDefinition` の `categories`(`unknown_category`)。
- 種別(カテゴリーが持つ、7 つ・fork は増やせない): `functional`(機能に組み込まれた連絡)/ `transactional`(本人の手続きの知らせ)/ `security`(セキュリティの警告)/ `announcement`(運営の告知)/ `direct`(運営から特定の利用者へ)/ `activity`(利用者が止められる、利用に伴う知らせ)/ `promotion`(宣伝)。
  - 性質は `MESSAGE_KIND_TRAITS`(`definition/kinds.ts`):
    - 上流の物を止められるか(`upstreamDisable`、functional だけ不可)
    - 利用者の停止と好み(`userStoppable`、activity・promotion)
    - 宛先(アドレス)の停止(`addressStop`、functional・security は hard bounce だけ)
    - 自由連絡で送れる宛先(`adminFreeText`、announcement・direct・promotion)
    - 記録の既定(`recordDefault`)
    - テキストの編集(`adminTextOverride`、functional は不可)
    - 間引き(`throttle`、functional・security は不可)
    - カテゴリーの送信チャンネルから email を外せないか(`emailFixed`、functional・security)
    - 送る口の中ですぐ送るか(`sendInEntry`、security: 予約と全員・ロール・グループ宛ては 400、宛先が多くても展開して最初の 1 束を口の中で送る)。
  - 種別の値で分ける読み手はこの表を引く(`kindTraits` / `kindsWhere`)
- `vars`: 呼び手が渡す値の zod
- `varNames`(必須): vars の鍵ごとの日本語の別名と説明 `{ [鍵]: { alias, description } }`(秘密の値も)。型が vars の鍵で縛る(欠けると型の誤り)。文面に `{{別名}}` と書けば `{{鍵}}` と同じ値で埋まり、管理画面の埋め込み情報の一覧(テキストの編集)に別名と説明で出る(秘密の値は出さない)。別名の形は埋め込み情報の別名と同じ。共通・enrichers と同じ鍵の値(例 `serviceNameShort` = サービスの短い名前・`displayName` = 表示名)はその別名を書き、ほかの別名は見える名前(共通・enrichers・ほかの vars)と重ならない。
  - 実行時は `validateMessageDefinition`(`missing_var_name` / `invalid_var_name` / `var_name_clash`)。上書きで変えられない。`pnpm generate message` は `--var <鍵>:<別名>:<説明>` で書く
  - 秘密の値(トークン入りの URL・ワンタイムコード)は `secretVar(z.string())` で印を付ける。印の鍵を持つ連絡は描いた本文をどこにも残さず(`record: "full"` でも)、vars の写しからその鍵を落とす(送る口が守る)。印は `isSecretVar` / `listSecretVarKeys` で読む。vars は上書きできないので印は外せない
- `required`: 止められない連絡(認証など)。`enabled: false`・email の除外・`adminEditableOnly`・`throttle` を付けられない
- `adminEditableOnly`: 管理画面で直せる欄の絞り(レイアウトの欄の鍵)。無い = レイアウトの欄のうちカテゴリーの送信チャンネルで使う物を全部直せる(`adminEditableFields`: 種別の性質 `adminTextOverride` が true で required でない連絡)。書いた時だけその欄に絞る。required の連絡は付けない。レイアウトに無い鍵は `unknown_admin_editable`
- `record`: 本文の残し方 `meta` | `vars`(既定)| `full`
- `throttle`: 会話の間引き `{ by: [vars の鍵], mode: "untilRead" | "window", seconds }`
- `silent`: 静かなお知らせ(既定 false)。true = お知らせ(inApp)の行を静かな行(`metadata.silent = true`)で書く: 受け取り箱の一覧には出し、未読の数と未読だけの一覧(未読のモーダル)には入れない。ほかの送信チャンネルには効かない。上書きで変えられない(送る口 = src/domains/core/messaging/services/server/sendMessage/content.ts、読む側 = services/server/inbox/readState.ts)
- `layout`(必須): レイアウトの鍵(`src/domains/core/messaging/layouts/<名前>/`。上流は simple・notice・link・welcome・statement・alert)。受け口に無い鍵は誤り: 字面は `pnpm check extensions`(messageGuards)、実行時は `validateMessageDefinition` の `layouts`(`unknown_layout`)。無効(`disabled`)のレイアウトも誤り(`disabled_layout`)。上書きで変えられない
- `values`: レイアウトの欄の中身(欄の鍵 → 値。文字列に `{{鍵}}` を書ける)。レイアウトの欄の zod(`layoutValuesSchema`、カテゴリーの送信チャンネルで使う欄だけ必須)を通る(`invalid_values`)。検査の前に空を「無い」にする(`normalizeLayoutValues` / `normalizeFieldValue`: 画像の空文字・ボタン / リンクの全部が空・空の並び。ボタンの片方だけ空・URL の無いリンクは空の側の誤り)
- `extras`: fork が足す欄の入れ物
- 管理者が送る時の宣言(D175・D195。どれも省略でき、今の上流の定義は書かない):
  - `adminVars`: 管理者が画面で入れる vars `{ [vars の鍵]: { type, options?, required, default? } }`(`MessageVarInput` = DB のテンプレートの専用の埋め込み情報と同じ型: line・number・date・datetime・url・select。別名は `varNames`)
  - `recordVars`: 記録の宛先が記録から引く vars(同じ形。`resolveRecipients` の `vars`。送る口は受信者ごとにこの鍵だけを定義の zod で検査する)
  - 管理者が入れた値は入力の型で変換してから定義の vars の zod で検査する: `adminVarValueOf(input, 値)`(vars/declaration.ts。空は既定値、数は数、ほかは型の形の字、形が違えば problem)
  - 同じ鍵が両方にある = `var_origin_overlap`(鍵を名指す)/ vars に無い鍵 = `unknown_var_origin` / 秘密の値(`secretVar`)を管理者が入れる = `secret_admin_var` / 型の形の誤り(select の options・既定値)= `invalid_var_input`。どちらにも無い vars はコードだけが渡す(管理者の送る口は required の値が埋まらなければ断る)
  - `adminTargets`: 管理者が送れる宛先 `records`(記録の宛先がこの定義を名指す)・`all`・`role`・`group`。書かない = `["records"]`(全員・ロール・グループは書いた時だけ。種別では縛らない)。ほかの値 = `invalid_admin_target`
- `adminText`: 管理者が送る画面の文 `{ description?, confirm? }`(D214 (3)、各 1〜500 字、表示だけで `{{鍵}}` は差し込まない)。`description` = 送るモーダルの説明 / `confirm` = 送る前の確認の文。書かない = 画面の既定の文。定義連絡の選択肢の口(`GET /api/admin/messaging/definitions/options`)が返す。再送の頭書き(「先日のメールに誤りがありました」等)は持たない: 呼び手が vars で渡す(D214 (4))。ほかの鍵・空・長すぎ = `invalid_admin_text`
- `channelModes`: 送信チャンネルの固定 `{ [送信チャンネル]: "on" | "off" | "free" }`(D212、書かない = free)。集まりはカテゴリーが決め、定義はその中を固定するだけ。送る口の `resolveChannels` が効かせる: コードの送信は off を落とす / 管理者の絞りは free の中から選び、on はいつも入り、off を名指すと 400(既定のオンはカテゴリーの `defaultChannels`、D213)。分け方は `definitionChannels(resolved)` → `{ on, free, off }`。カテゴリーの外 = `unknown_channel_mode` / 全部 off = `channel_all_off` / required か `emailFixed` の種別の email を off = `email_off_fixed`
- 管理者が書いて送る連絡(自由連絡): `messagingService.sendFreeMessage`(カテゴリー + 管理画面で選べるレイアウト(`isLayoutAdminSelectable` = `adminSelectable` で無効でない)か DB のテンプレート(無効のレイアウトの物は 400) + 欄の中身)

### 差し込み({{鍵}})

- 書式は `lib/templateVariables` の差し込み 1 本(`replaceVariables`・`listVariables`)。名前は文字(日本語も)・数字・_ の並びで、空白・点を含む名前は差し込まれない
- 差し込める鍵 = `vars` の鍵 ∪ 共通の文脈 `COMMON_CONTEXT_KEYS`(`recipientName`・`recipientEmail`・`serviceName`・`appBaseUrl`。送る口が埋める)∪ throttle のある連絡だけ `collapsedCount`
- enrichers の `provides` の鍵は `validateMessageDefinition(def, { variableKeys })` で足して許す(送る口がその連絡に当たる enrichers の鍵を渡す。当たるか = 当て先 `enricherTargets`、下の受け口)

### 埋め込み情報(vars/)

文面に `{{名前}}` で書く値を「埋め込み情報」と呼ぶ。名前は英語の鍵と日本語の別名の 2 つで、どちらで書いても同じ値で埋まる(`{{displayName}}` = `{{表示名}}`)。

- 共通の埋め込み情報 `MESSAGE_COMMON_VARS`(`vars/common.ts`、鍵・別名・説明の 1 か所。`COMMON_CONTEXT_KEYS`・`THROTTLE_CONTEXT_KEYS` もここから): `recipientName` 受信者名・`recipientEmail` 受信者のメール・`serviceName` サービス名・`serviceNameShort` サービスの短い名前・`appBaseUrl` サイトのURL・`collapsedCount` まとめた件数(間引きのある連絡だけ)
- enrichers は足す値ごとに別名を宣言する(`MessageEnricher.aliases`、provides の全部の鍵に要る)。上流の `displayName` は「表示名」
- 専用の埋め込み情報(テンプレートが宣言する)`MessageVarDeclaration` = `{ key, alias, type, options?, required, default? }`。型 `line`(1行テキスト)・`number`・`date`(YYYY-MM-DD)・`datetime`(ISO 8601、時差つき)・`url`・`select`(`options` の value)。保存の検査 `messageVarDeclarationSchema`、送る時の値の検査 `varValueSchema` / `varValuesSchema`(空は既定値、必須で既定値も無ければ誤り、差し込む字にする)
- 一覧 `varCatalog({ own, vars, enrichers, throttle })` = 共通 + 当たる enrichers + 専用(テンプレートの宣言 `own`、定義連絡の vars の名前 `vars` = 定義の varNames)。`checkVarCatalog` が止める: 鍵の形(英字で始まる英数字)・別名の形(空白・記号なし、英数字以外の字を含む)・鍵の重なり・別名の重なり(専用どうしも共通・enrichers の名前とも)・enrichers の別名の欠け
- 日付・日時の専用の値: 残す値は ISO のまま。`varValuesSchema` が隣に型の印 `<鍵>@type`(`VAR_TYPE_SUFFIX`、書式 {{名前}} に拾われない)を出し、送信の値と一緒に残る。差し込む時に `displayVarValues` が人が読む字にする(`varDisplayText`: 2026年12月1日 / 2026年12月1日 11:00、日本時間)
- 差し込み: `findVar(文面, 一覧)` = 書かれた名前を鍵に直した並びと一覧に無い名前(保存・送る前に拒む)。`varMap(鍵 → 値, 一覧)` = 別名の行を足した表(`replaceVariables` に渡す)
- 定義の検査(`validateMessageDefinition`)と管理画面の値の鍵(`adminFieldAllowedKeys`)は共通の別名と vars の別名(管理画面は秘密を除く)を通す(enrichers の鍵と別名は呼び手が `variableKeys` で、vars の別名と照らす鍵と別名の組は `sharedVarNames` で渡す)。送る口は差し込みの表に別名の行を足し、テンプレートの保存・送る前の検査は一覧で名前を確かめる(domains/core/messaging)

### 定義の読み手の検査(validateMessageDefinition)

`validateMessageDefinition(definition, { categories, layouts, override?, channels?, variableKeys? })` → 問題の一覧(空 = 通る)。`layouts` = レイアウトの受け口(鍵 → レイアウト)。上書きを渡すと重ねた結果を検査する。`categories` = カテゴリーの受け口(鍵 → 項目、fork のカテゴリーの上書きを重ねた後)。`resolveMessageDefinition(definition, override, category)` が上書きを重ね種別と送信チャンネルを付けた定義を返す(`applyMessageOverride` は上書きだけ)。カテゴリーの受け口は `validateMessageCategories(categories, groups)`(種別・送信チャンネル・グループ)。

- `invalid_key`: 鍵の形
- `missing_label`: 名前(label)が無い・空(上書きの label も見る)
- `required_disabled` / `required_without_email` / `required_admin_editable` / `required_throttle`: required の守り
- `unknown_category`: カテゴリーが受け口に無い
- `kind_admin_editable` / `kind_throttle`: 種別の性質でテキストの編集・間引きが無い種別(functional・security)
- `unknown_channel`: カテゴリーの送信チャンネルが送信チャンネルの受け口に無い
- `unknown_layout` / `invalid_values`: レイアウトが受け口に無い / 欄の中身がレイアウトの欄の zod(カテゴリーの送信チャンネルで使う欄)を通らない
- `disabled_layout`: レイアウトが無効(fork の `layout.override.ts` の `disabled`)。定義の鍵とレイアウトの鍵・表示名を名指す
- `unknown_admin_editable`: adminEditableOnly の鍵がレイアウトの欄に無い
- `unknown_variable`: 欄の中身の `{{鍵}}` が vars ∪ 共通の文脈に無い
- `invalid_throttle`: throttle.by が vars に無い・seconds が正でない
- `override_forbidden_key`: 上書きが key・kind・vars・varNames・required・defaultChannels を持つ
- `var_origin_overlap` / `unknown_var_origin` / `secret_admin_var` / `invalid_var_input` / `invalid_admin_target`: 管理者が送る時の宣言(定義の項目の adminVars・recordVars・adminTargets)
- `unknown_channel_mode` / `channel_all_off` / `email_off_fixed`: 送信チャンネルの固定(channelModes)
- `invalid_admin_text`: 管理者が送る画面の文(adminText、定義と上書き)

### 管理画面の欄の値(adminFields.ts)

管理画面で直した欄の値(テキストの編集)を、保存する口・送る口・プレビューが同じ純粋な関数で検査し重ねる。欄の道 = レイアウトの欄の鍵(組・並び・ブロックの並びは欄ごと丸ごと)。

- `adminEditableFields(resolved, layout)` → 直せる欄(欄の鍵、宣言の順)。レイアウトの欄のうちカテゴリーの送信チャンネルで使う物の全部(送信チャンネルだけの欄はその送信チャンネルがカテゴリーにある時だけ)、`adminEditableOnly`(欄の鍵の並び)があればその中だけ。種別の性質 `adminTextOverride` が false・required は空
- `checkAdminFieldValue(resolved, layout, fieldPath, value, { variableKeys? })` → 問題(null = 通る)。`resolved` = 上書きを重ねた後の定義
  - `not_editable`: 今の直せる欄に無い / `invalid_value`: 欄の宣言の zod を通らない(必須は空にできない) / `unknown_variable`: 使えない `{{鍵}}`
- `moveAdminFieldPath(layout, fieldPath, layoutVersion)` → 今の版の欄の鍵か `{ unusable: 理由 }`(改版の対応 `revisions` を段ごとに当てる。捨てた欄・段の対応が無い・今より新しい版・版の無い古い形の行 = 使えない)
- `readAdminFieldValue(resolved, layout, row, options)` → 今の版へ移して検査した結果(移せない = `unusable`)
- `applyAdminFieldValues(resolved, layout, rows, options)` → `{ resolved, applied, rejected }`: 当てられる行だけ `values` に欄ごとに重ねる(送る口の `resolveDefinition` が機能の入切(featureGate)の開いた時に呼ぶ)
- `adminFieldAllowedKeys(resolved, variableKeys)`: 使ってよい鍵 = vars(`secretVar` の鍵を除く)・共通の文脈・throttle の鍵・`variableKeys`(当たる enrichers の provides)
- `adminFieldCodeValue(resolved, fieldPath)`: 欄のコードの値(定義の `values` の欄、fork の override を重ねた後)

### レイアウト(layout/)

連絡の見た目の型。レイアウト = 欄の宣言・仮の文・要約(必須)・管理者が選べる印・改版の対応。種別・カテゴリー・送信チャンネルを知らない(送信チャンネルだけの欄は欄の `channels` に送信チャンネルの鍵を値として持つだけ)。送信チャンネルごとの描き方はレイアウトのフォルダのファイル(server = email、client = inApp)が持ち、型は持たない。連絡定義はレイアウトの鍵と欄の中身を持ち、送る口は送信チャンネルごとに下の 3 段で描く(送信チャンネルは自分の欄を持たない。管理画面の入力とプレビューもレイアウトの欄の宣言と描き方から。なぜこの形か = src/domains/core/messaging/Internals.md)。

- `defineMessageLayout({ key, label, description?, fields, summary, adminSelectable?, disabled?, version?, revisions? })`: 欄の宣言から中身の型(`MessageLayoutValues`)を引く。`version` = 版(既定 1、`layoutVersionOf`)
- `disabled`(既定 false)= 無効: 上流のレイアウトを fork が `layouts/<名前>/layout.override.ts`(`MessageLayoutOverride` = `disabled`・`adminSelectable` だけ)で付ける。`isLayoutUsable(layout)`(disabled でない)・`isLayoutAdminSelectable(layout)`(使えて adminSelectable)が判定の 1 か所(送る画面・テンプレート・送る口・検査が使う)
- 欄の宣言 `MessageFieldSpec`: `type`(語彙)・`label`・`placeholder?`・`required?`・`channels?`(使う送信チャンネルの鍵、無い = 全部)。`select` は `options`、`list` は `of`・`min?`・`max?`、`group` は `fields`、`blocks` は `allow?`・`min?`・`max?`
- 欄の型の語彙(`layout/vocabulary.ts`): `line` 1行テキスト・`paragraph` 段落・`longText` 複数行テキスト・`image` 画像(storage:// の参照か URL)・`button` ボタン `{ label, url }`・`link` リンク `{ label?, url }`・`date` 日付 YYYY-MM-DD・`number` 数・`select` 選択肢・`list` 並び・`group` 組・`keyValue` ラベルと値 `[{ key, value }]`・`blocks` ブロックの並び。型ごとの zod は `fieldValueSchema(shape)`
- ブロック(`layout/blocks.ts`): `heading` 小見出し・`paragraph` 段落・`button` ボタン・`image` 画像・`divider` 区切り・`keyValueTable` ラベルと値・`bulletList` 箇条書き。`messageBlocksSchema({ allow?, min?, max? })` が許す種類と数で絞る(知らない種類は通らない)
- 要約 `MessageLayoutSummary` = `{ title, body, image?, link?: { label?, url }, shortBody? }`(プッシュ・LINE は `shortBody ?? body`)
- 中身の検査 `layoutValuesSchema(layout, { channels? })`: 必須を守る(空文字・空の並びも通さない)。`channels` を渡すと、そのどれにも使われない送信チャンネルだけの欄は求めない。知らない鍵は通らない。送信チャンネルの欄だけ = `fieldsForChannel(layout, channel)`
- 改版: 欄の鍵を変えた・消した時に `version` を 1 上げ、`revisions` にその段の対応を書く(`{ [上げる前の版]: { 前の鍵: 新しい鍵 | null } }`、1 から今の版の 1 つ前まで全部の段。鍵の変わらない段も `{}`)。`applyLayoutRevisions(values, 段)` = 1 段(`null` は捨てる、新しい鍵に値があれば今の値を残す)、`upgradeLayoutValues(layout, values, fromVersion)` = 送った版から今の版まで段ごとに当てる(段が無い・今より新しい版 = `{ cannotRender }`)。送信の values・テンプレートの保存値・テキストの編集に当てる
- 描き方の 3 段 `resolveRendering({ layout, channelKey, hasLayoutRenderer, channel, values })`: レイアウトのその送信チャンネルの描き方(`{ from: "layout" }`)> 送信チャンネルの汎用の描き方(`renderGeneric`、`genericFieldTypes` が送信チャンネルの欄の型を全部含む時、`{ from: "channel", fields }`)> 要約(送信チャンネルが `summaryRenderable: true` と `renderFromSummary` を持つ時、`{ from: "summary", summary }`)。どれでも描けない・要約が投げる = `{ cannotRender: 理由 }`。
  - テンプレートの保存・プレビュー・送る前の検査がこれで止める。送信チャンネルの宣言の型は `MessageChannelRendering`(`rendersAtSend?: true` = 送る時に宛先ごとに描く送信チャンネル、例 email の停止のリンク)
- 送信チャンネル 1 つの組み立て `buildChannelContent({ layout, channelKey, channel, hasLayoutRenderer, values })`(`layout/content.ts`): その送信チャンネルが使う欄だけ → 要約 → 3 段 → 中身 `{ content, title }`(title = 要約の題)か `{ cannotRender }`。
  - レイアウトの描き方の段と `rendersAtSend` の送信チャンネルは `MessageLayoutContent`(`{ title, layout, from, values, summary }`、送信チャンネルが送る時に段に従って描く。判定 `isMessageLayoutContent`)、ほかは送信チャンネルが描いた物(`content` があればそれ、無ければ `html` / `text`)。送る口の組み立て(messaging の `sendMessage/content.ts`)が送信チャンネルごとに呼ぶ

### 送信チャンネルの失敗(ChannelError)

送信チャンネルの送信の失敗。`kind` = `transient`(一時)| `permanent`(恒久)| `unknown`(受付不明)で、lib/mail の `MailSendError` と同じ語彙(`src/lib/mail/errors.test.ts`)。`channel`(送信チャンネルの鍵)・`reason`(機械が読む理由)・`cause`。

## Extension

### 受け口の項目(receptacles/types.ts)

ドメイン messaging の受け口(`src/domains/core/messaging/extensionPoints.ts`、表は `src/domains/core/messaging/README.md`「受け口」)に置く項目の型。

- `MessageChannel`(送信チャンネル):
  - `key`
  - `label`
  - `addressing`(`user` = 利用者から引く / `address` = 宛先を直に)
  - `enabled?`(送信チャンネルの入切、既定 true。false は項目が無い送信チャンネルと同じ扱い = 配達の行は `channel_off`。値は項目が自分の設定から読む。featureGate の機能ではない)
  - `resolveAddresses?`(既定は端末の登録の表)
  - `endpoint?`(端末の登録の表を読む送信チャンネルの宛先の形 `{ address: zod }`。端末の登録の口が検査し、変換後の値を残す。無ければ汎用の形)
  - `preview?`(管理の送信のプレビュー。送る時と同じ組み立ての中身を送る時と同じ描き方で描く。email = HTML。無い送信チャンネルは中身をそのまま見せる)
  - `remove?`(届けた物の取り下げ `({ dispatchId }) => { removed }`。管理の削除が呼ぶ。持つ送信チャンネル = 消せる送信チャンネル。何度呼んでも同じ結果に書く)
  - `connectHref?`(宛先の無い利用者を案内する先 = サイト内のパスか URL。好みの表が宛先の無い送信チャンネルに出す。連携の画面が無い送信チャンネルは持たない)
  - `send(宛先の束)`(宛先 `ChannelSendTarget` = `userId`・`address`・`messageKey`(連絡の鍵)・`idempotencyKey`・`content`(組んだ中身: `MessageLayoutContent` か送信チャンネルが描いた物)、好みに従う連絡だけ `category`(配信停止のカテゴリー)と送る側が付ける `headers`(List-Unsubscribe など))→ 宛先ごとの `ChannelSendResult`(`sent` か `transient` / `permanent` / `unknown`。宛先の失効が確定したときだけ `addressInvalid`)
  - `webhooks?`(provider → `{ verify, normalize }`。事件の形は lib/mail の webhook と同じ + 送る時にタグで渡した配達の id `deliveryId?`)
- `MessageEnricher`(値): `key`・`target`(当て先 = `{ messages?: 連絡の鍵[], categories?: カテゴリーの鍵[], kinds?: 種別[], all?: true }`、どれかに当たれば当てる。判定 `enricherTargets(target, { key, category, kind })`。使える鍵の検査と実行の両方がこれで選ぶ)・`provides`(足す変数の zod)・`resolve(文脈)`
- `MessageCategory`(カテゴリー = 1 つの出来事、配信停止の単位 = カテゴリー × 送信チャンネル): `key`・`label`(利用者に見せる名前: 好みの設定・配信停止・受け取り箱)・`adminLabel?`(管理画面の名前: 送る・テンプレート・テキストの編集・送信の画面。無い = `label`、`categoryAdminLabel(category)` で引く)・`description?`・`kind`(7 つ)・`channels`(届ける送信チャンネル)・`defaultChannels?`(管理の送る画面で最初に入っている送信チャンネル = `channels` の中の 1 つ以上、無い = 全部。停止の単位は変えない)・`group?`(設定画面の見出し `MessageCategoryGroup` の鍵、同じ種別だけ)。
  - fork は上流のカテゴリーの `<名前>.override.ts` で `label`・`adminLabel`・`description`・`channels`・`defaultChannels`・`group` を変えられる(鍵・種別は不可)
- `MessageCategoryGroup`(カテゴリーのグループ、`messaging/categoryGroups/<名前>.ts` の `export const group`): `key`・`label`・`order`。見出しだけで停止の単位ではない。上流は出荷しない
- `MessageSource`(送り元): `key`・`label`
- `MessageSubscriber`(送った後の購読): `key`・`on`(事件の種類)・`filter?`(連絡の鍵・送信チャンネル)・`handle(事件の束)`(事件の id + 購読の鍵で冪等に。投げると次回もう一度渡る)

### 記録の宛先(recordTargets/types.ts)

管理一覧で選んだ記録 → 宛先を解く項目(D190・D195・D204)。受け口ではなく、連絡定義と同じ道で集める:

- 置き場: 持ち主のドメインの `<domain>/recordTargets/<名前>.ts` に `export const recordTarget: MessageRecordTarget = { key, label, messages, enabled?, resolveRecipients, afterSend? }`。fork の物は fork の自分のドメインに置く(上流のドメインの記録でも、requires を付けて自分のドメインに。D26)
- 鍵 = `<ドメインのフォルダ名>.<ファイル名>` の文字列リテラル(場所とずれる・重なる = `pnpm generate registry` が止める)。管理 API の `target`、送り元の既定 `<鍵>.bulk`
- `resolveRecipients(recordIds)` → `MessageRecordRecipient[]` = `{ userId, vars, recordIds }`(1 人 1 件。記録ごとか、まとめるかは項目が決める)。`vars` = 記録から埋める連絡の値
- `afterSend?(sent: MessageRecordTargetSent)`: 定義連絡の送る口の記録の入口で、送信の受け付けの直後に 1 回(投げても送信は戻らない。自由連絡の一括送信は呼ばない、D196)。`sent` = `{ recordIds, dispatchId, counts, channels, message, fields }`(`channels` = 使うと決めた送信チャンネル、`message` = 送った連絡定義の鍵、`fields` = テキストの編集の後の欄の中身、差し込む前の字)
- `messages`: この項目で送れる連絡定義の鍵の並び(文字列リテラルの配列。空も可、D217)。どの鍵も連絡定義があり、その定義の `adminTargets` に `records` があること(書いていない = records)。外れたら `pnpm generate registry` が項目(上書きならそのファイル)と鍵を名指して止める(D218)
- 上書き: fork は隣の `<名前>.override.ts` に `export const recordTargetOverride = { messages: [...] } satisfies MessageRecordTargetOverride` で `messages` だけを丸ごと差し替える(上書きの点 = `extensionPoints.ts` の `recordTargets`、ほかの鍵は `pnpm check extensions` が止める)。上流の項目(`user.users`・`bankTransferReview.reviews`)に連絡を足す道
- 生成の一覧 `src/registry/recordTargetRegistry.ts`(`MessageRecordTargetRegistry` = 鍵 → `{ key, domain, target: () => import, override?: () => import }`、絞らない)。読み手は messaging の門番 `loadRecordTarget`(`recordTargetOpen` = 項目の domain の門。閉じていれば null。上書きの `messages` を重ねて返す)を通す

## Internals

### 定義で間違えやすい線

定義の側の線。運用の側(その送信は絞るだけ・種別まるごとの停止はデータだけ・グループは見出しだけ・法の義務の告知はメールを含める)は src/domains/core/messaging/README.md の「運用で間違えやすい線」。


#### 種別と送信チャンネルはカテゴリー(category)が持つ

- 設計の意図: 配信停止の単位はカテゴリー × 送信チャンネル、止められるかなどの性質は種別。連絡ごとに書けると、同じカテゴリーの中で送信チャンネルや性質がばらけ、利用者の切ったマスと届く物がずれる

#### カテゴリーの粒 = 利用者から見て 1 つの出来事

- 設計の意図: カテゴリーは停止の単位で、集計と絞り込みの物差し。粒が種別ごと・ドメインごとにばらけると、止める単位も数える単位も揃わない。止められない種別のカテゴリーも同じ粒にする
  - 例: いいねをされた時(likeReceived)・フォローされた時・出品した物が売れた時(itemSold)・投稿にコメントが付いた時・メールアドレスの確認(emailVerification)・パスワードの再設定(passwordReset)・アカウントのロック(accountLocked)・会員登録が完了した時(registrationComplete)・ポイントの失効が近づいた時(walletExpiring)・ポイントが失効した時(walletExpired)
  - 上流のカテゴリーの一覧: src/domains/core/messaging/README.md「連絡を足す」

#### カテゴリーは上書きで付け替えられ、種別はカテゴリーが持つ

- 設計の意図: fork が自分のカテゴリー(例 入金の連絡)へ上流の連絡を移す道(D166・D167)。上流のコードの呼び出しは変わらず、属するカテゴリーだけが変わる。カテゴリーの種別は上書きできない(種別を変えたいならカテゴリーを作る、D70)。種別の性質の守りは付け替えた後の値で見るので、移した先の種別の決まり(email を外せない等)が効く

#### 機能の連絡(functional)は止められない

- 設計の意図: 止めると機能が壊れる。性質 `upstreamDisable: false`・`adminTextOverride: false`・`throttle: false`・`emailFixed: true`

### 字面の守り(pnpm check extensions)

生成の前に字面で止める(`scripts/structure/extensions/derive/messageGuards.mjs`。実行時は送る口が同じ守りを `validateMessageDefinition` で見る):

- 全部の定義: `label`(字面の空でない文字列)が無い / `category` が無い・受け口に無い / `layout` が無い・レイアウトの受け口のフォルダに無い。上書きの `category`(付け替え)も受け口の鍵で、下の守りは付け替えた後のカテゴリーで見る
- 送信チャンネルの固定(`channelModes`、上書きがあれば上書きの物を丸ごと): required か email を外せない種別(functional・security)の連絡の `email: "off"`
- required の定義: カテゴリーの送信チャンネルに `"email"` が無い・`adminEditableOnly` が空でない・`throttle` がある。その上書き: `enabled: false`・空でない `adminEditableOnly`・`throttle`(`null` で外すのは通す)
- 上流(`src/domains/core`)の functional のカテゴリーの連絡(付け替えた後のカテゴリーで見る): 上書きで `enabled: false`
- カテゴリーの上書き(`categories/<名前>.override.ts`): functional・security のカテゴリーの `channels` から `"email"` を外す・空にする。`group` が categoryGroups の受け口に無い・1 つのグループに別の種別のカテゴリー
- 守りに関わる値が変数・式だと止まる。種別の性質は `definition/kinds.ts` を字面で読む

### 生成の一覧(src/registry/messageRegistry.ts)

`pnpm generate registry` が全ドメインの `messages/<名前>.ts`(直下。`.override`・`.test` を除く)を字面で読み、鍵 → 項目の一覧を書く(`scripts/structure/registry/alpha/messageRegistry.mjs`)。送る口・管理画面・プレビューはこれを読む(server-only)。

- 鍵 = `<ドメインのフォルダ名>.<ファイル名>`(例 `src/domains/core/auth/messages/verification.ts` → `auth.verification`)。定義の `key` はこの値の文字列リテラルで書く(ずれ・重なりは生成が止める)
- 項目 `MessageRegistryEntry` = `{ key, definition, override? }`。どれも遅延 import(`definition` → `{ message }`、`override` → `{ messageOverride }`)。描き方はレイアウトが持つ(連絡ごとの描き方のフォルダは持たない。前の形の view のフォルダが残っていれば生成が止まる)
- ファイル名は英小文字始まりの camelCase(点や印は付けない)
- 全件の検査: `src/domains/core/messaging/services/server/sendMessage/messageRegistry.test.ts` が一覧の全件に上書きを重ねて `validateMessageDefinition` をかけ、鍵の一致とカテゴリーの送信チャンネルの全部で描けることを確かめる(`checkMessageRegistry`)
- 生成は字面だけを読み、定義を実行しない。欄・`{{鍵}}` などの値は送る口が `validateMessageDefinition` で見る

## Verification

- `pnpm test src/lib/messaging`
- 一覧の全件の検査: `src/domains/core/messaging/services/server/sendMessage/messageRegistry.test.ts`
