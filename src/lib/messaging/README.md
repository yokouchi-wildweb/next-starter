# lib/messaging

連絡(システム・管理者 → 宛先 1 人への一方向の連絡: メール・お知らせ・LINE・fork の経路)の仕組みの側。表を持たない(記録・宛先の解決・配信停止はドメイン messaging が持つ)。

- 入口: `@/lib/messaging`(閉じた lib。package.json の exports だけを外から読む)
- 今あるもの: 連絡の定義の型・上書きの型・上書きの点の宣言(extensionPoints.ts)・生成の一覧の型・定義の読み手の検査・経路の失敗の型・messaging の受け口の項目の型
- 読み手(送る口・記録・購読の cron)は連絡のドメイン messaging が持つ(作り直しの切り替えで作る)

## 連絡の定義(defineMessage)

連絡 1 本 = 起こすドメインの `messages/<名前>.ts` に定義 1 つ(データだけ。送る処理は持たない)。`export const message = defineMessage({ … })` の形で書く(`pnpm check extensions` が字面で読む。default export・別名は止まる)。

```ts
import { z } from "zod";
import { defineMessage } from "@/lib/messaging";

export const message = defineMessage({
  key: "auth.verification",
  category: "emailVerification", // 種別(functional)と経路(email)は種類から引く
  vars: z.object({ verificationUrl: z.string().url() }),
  required: true,
  record: "meta",
  content: {
    email: {
      subject: "メールアドレスの確認",
      heading: "メールアドレスの確認",
      paragraphs: ["{{recipientName}} 様、{{serviceName}} への登録を受け付けました。"],
      cta: { label: "確認する", url: "{{verificationUrl}}" },
      footer: "心当たりがない場合は無視してください。",
    },
  },
});
```

項目:

- `key`: `<domain>.<name>`(英数字の camelCase)
- `category`(必須、D81): 種類 = categories の受け口の鍵。種類は利用者から見て 1 つの出来事(D79)で、種別(kind)と経路(channels)を持つ。連絡は種別も経路も書かず、種類から引く(D86)。受け口に無い鍵は誤り: 字面は `pnpm check extensions`(messageGuards)、実行時は `validateMessageDefinition` の `categories`(`unknown_category`)。種類は上書きで付け替えない(D74: 別の種類で送りたいなら上流の連絡を止めて自分の連絡を足す)
- 種別(種類が持つ、7 つ・fork は増やせない): `functional`(機能に組み込まれた連絡)/ `transactional`(本人の手続きの知らせ)/ `security`(セキュリティの警告)/ `announcement`(運営の告知)/ `direct`(運営から特定の利用者へ)/ `activity`(利用者が止められる、利用に伴う知らせ)/ `marketing`(宣伝)。性質は `MESSAGE_KIND_TRAITS`(`definition/kinds.ts`、D80): 上流の物を止められるか(`upstreamDisable`、functional だけ不可)・利用者の停止と好み(`userStoppable`、activity・marketing)・住所の停止(`addressStop`、functional・security は hard bounce だけ)・管理者がその場で送れる宛先(`adminFreeText`、announcement・direct・marketing)・記録の既定(`recordDefault`)・文言の上書き(`adminTextOverride`、functional は不可)・間引き(`throttle`、functional・security は不可)・種類の経路から email を外せないか(`emailFixed`、functional・security)・送る口の中ですぐ送るか(`sendInEntry`、security: 予約と宛先の集め方は 400、宛先が多くても展開して最初の 1 束を口の中で送る)。種別の値で分ける読み手はこの表を引く(`kindTraits` / `kindsWhere`)
- `vars`: 呼び手が渡す値の zod
  - 秘密の値(トークン入りの URL・ワンタイムコード)は `secretVar(z.string())` で印を付ける。印の鍵を持つ連絡は描いた本文をどこにも残さず(`record: "full"` でも)、vars の写しからその鍵を落とす(送る口が守る)。印は `isSecretVar` / `listSecretVarKeys` で読む。vars は上書きできないので印は外せない
- `required`: 止められない連絡(認証など)。`enabled: false`・email の除外・`adminEditable`・`throttle` を付けられない
- `adminEditable`: 管理画面で直せる欄の名前(`<経路>.<欄>`)。required の連絡は空
- `record`: 本文の残し方 `meta` | `vars`(既定)| `full`
- `throttle`: 会話の間引き `{ by: [vars の鍵], mode: "untilRead" | "window", seconds }`
- `content`: 経路ごとの欄。種類の経路の分だけ必須(`missing_content`)
- `content`: 経路ごとの名前付きの欄(下)
- `extras`: fork が足す欄の入れ物(メールの描き方の .replace が読む)
- `authored: true`(文面を送るたびに受け取る連絡、D92): 管理者が書いて送る連絡(上流は messaging の `messaging.adminAnnouncement`・`adminDirect`・`adminMarketing`)。定義は `key`・`category` だけを持ち、`content: {}`・`vars: z.object({})` で書く。送る口が受けた文面で埋めてから同じ検査を通す(種類の経路の文面・経路の欄の zod・`{{鍵}}`)。`adminEditable`・`throttle` は付けられず(`authored_field`)、文面を空にしないと `authored_content`、上書きのファイルは置けない(`authored_override`、`pnpm check extensions` も止める)

## 定義で間違えやすい線(D77)

定義の側の線。運用の側(その回は絞るだけ・種別まるごとの停止はデータだけ・グループは見出しだけ・法の義務の告知はメールを含める)は src/features/core/messaging/README.md の「運用で間違えやすい線」。

### 種別と経路は種類(category)が持つ

- 設計の意図: 配信停止の単位は種類 × 経路、止められるかなどの性質は種別。連絡ごとに書けると、同じ種類の中で経路や性質がばらけ、利用者の切ったマスと届く物がずれる(D81・D86)
- どう書くか: 定義は `category` だけを書く(`kind`・`channels` は書けない)。経路は種類の `channels`、種別は種類の `kind`。種別の一覧と性質は上の項目の `MESSAGE_KIND_TRAITS`

### 種類の粒 = 利用者から見て 1 つの出来事(D79)

- 設計の意図: 種類は停止の単位で、集計と絞り込みの物差し。粒が種別ごと・ドメインごとにばらけると、止める単位も数える単位も揃わない。止められない種別の種類も同じ粒にする
- どう書くか: 「〜した時」と言える単位で切る。属する連絡はその出来事の文言・条件の違い。ドメイン・機能の単位(auth・account・wallet-expiry など)にはしない
  - 例: いいねをされた時(likeReceived)・フォローされた時・出品した物が売れた時(itemSold)・投稿にコメントが付いた時・メールアドレスの確認(emailVerification)・パスワードの再設定(passwordReset)・アカウントのロック(accountLocked)・会員登録が完了した時(registrationComplete)・ポイントの失効が近づいた時(walletExpiring)・ポイントが失効した時(walletExpired)
  - 上流の種類の一覧: src/features/core/messaging/README.md「連絡を足すとき」

### 種類と種別は付け替えない(止めて足す)

- 設計の意図: 上書きで種類・種別を変えると、止めた行・集計・上流の検査が知らないうちに変わる(D74)
- どう書くか: 連絡の上書きは `category` を変えられず、種類の上書きは `key`・`kind` を変えられない(`label`・`description`・`channels`・`group` だけ)。別の種類で送りたい = 上流の連絡を `enabled: false` で止め、自分の種類と連絡を足す(例は messaging の README)

### 機能の連絡(functional)は止められない

- 設計の意図: 止めると機能が壊れる(D68)。性質 `upstreamDisable: false`・`adminTextOverride: false`・`throttle: false`・`emailFixed: true`
- どう書くか: 上書きの `enabled: false`・種類の上書きで email を外すことは `pnpm check extensions`(messageGuards)で、管理画面の文言の欄(`adminEditable`)・間引きは実行時の `validateMessageDefinition`(`kind_admin_editable` / `kind_throttle`)でも止まる。文面は上書きの `content` かメールの描き方の `.replace` で変える

## 経路ごとの欄(MessageContent)

`MessageContent` = 経路の鍵の Record。欄の値は文字列で `{{鍵}}` を差し込める。上流の経路:

- `email`: `subject`(必須)・`preheader`・`heading`・`paragraphs`(文字列の配列)・`cta`(`{ label, url }`)・`footer`
- `inApp`: `title`(必須)・`body`・`image`(storage:// か URL)・`link`
- `line`: `text`(必須)

欄の zod は strict(定義に無い欄の名前は通らない)。fork の経路は経路の受け口で欄の zod を足し、`createDefineMessage<束>()` と `validateMessageDefinition(def, { channels: 束 })` に渡す(束は生成の一覧が作る予定)。

## 差し込み({{鍵}})

- 書式は `lib/structuredDocument` の差し込み 1 本(`replaceVariables`・`listVariables`)。鍵は `\w+`(英数字と _)で、点を含む鍵は差し込まれない
- 差し込める鍵 = `vars` の鍵 ∪ 共通の文脈 `COMMON_CONTEXT_KEYS`(`recipientName`・`recipientEmail`・`serviceName`・`appBaseUrl`。送る口が埋める)∪ throttle のある連絡だけ `collapsedCount`
- enrichers の `provides` の鍵は `validateMessageDefinition(def, { variableKeys })` で足して許す(送る口がその連絡に当たる enrichers の鍵を渡す)

## 上書き(MessageOverride)

`messages/<名前>.override.ts`(データだけ)。変えられるのは欄の文言(経路ごとに欄を重ねる)・`extras`・`enabled`・`adminEditable`・`record`・`throttle`(`null` で外す)。`key`・`vars`・`required`・`category` は変えられない(経路は種類の上書き `categories/<名前>.override.ts` の `channels` で変える。上流の functional の連絡は止められない、D68)。

```ts
// src/features/core/auth/messages/verification.override.ts(fork)
import type { MessageOverride } from "@/lib/messaging";

export const messageOverride = {
  content: { email: { subject: "【{{serviceName}}】メールアドレスの確認" } },
} satisfies MessageOverride;
```

- 上書きの点 = この lib の `extensionPoints.ts` の `messages`(`overrides: "src/features/**/messages/*.ts"`、直下だけ。`messages/views/` の描き方は 1 行スイッチの `.replace`)。書ける鍵は宣言の `overrideOf`(`MessageOverride` の鍵と同じ。テストが固定)
- 形は `export const messageOverride = { … }`(`satisfies MessageOverride` 可)。関数で包むと字面で読めないので止まる
- 上流(Tier1)は上書きを出荷しない(`pnpm check extensions`)
- `applyMessageOverride(definition, override)` で重ねた結果(`enabled` つき)を得る。元の定義は変えない

## 字面の守り(pnpm check extensions)

生成の前に字面で止める(`scripts/structure/extensions/derive/messageGuards.mjs`。実行時は送る口が同じ守りを `validateMessageDefinition` で見る):

- 全部の定義: `category` が無い・受け口に無い・種類の経路の文面(`content.<経路>`)が無い
- required の定義: 種類の経路に `"email"` が無い・`adminEditable` が空でない・`throttle` がある。その上書き: `enabled: false`・空でない `adminEditable`・`throttle`(`null` で外すのは通す)
- 上流(`src/features/core`)の functional の種類の連絡: 上書きで `enabled: false`
- 種類の上書き(`categories/<名前>.override.ts`): functional・security の種類の `channels` から `"email"` を外す・空にする。`group` が categoryGroups の受け口に無い・1 つのグループに別の種別の種類
- 守りに関わる値(定義の `required`・`category`・`adminEditable`、上書きの `enabled`・`adminEditable`、種類の `kind`・`channels`・`group`)はリテラルで書く(変数・式は止まる)。種別の性質は `definition/kinds.ts` を字面で読む

## 生成の一覧(src/registry/messageRegistry.ts)

`pnpm generate registry` が全ドメインの `messages/<名前>.ts`(直下。`.override`・`.test` を除く)を字面で読み、鍵 → 項目の一覧を書く(`scripts/structure/registry/alpha/messageRegistry.mjs`)。送る口・管理画面・プレビューはこれを読む(server-only)。

- 鍵 = `<ドメインのフォルダ名>.<ファイル名>`(例 `src/features/core/auth/messages/verification.ts` → `auth.verification`)。定義の `key` はこの値の文字列リテラルで書く(ずれ・重なりは生成が止める)
- 項目 `MessageRegistryEntry` = `{ key, definition, override?, view? }`。どれも遅延 import(`definition` → `{ message }`、`override` → `{ messageOverride }`、`view` = `messages/views/<名前>.tsx` の 1 行スイッチ)
- 定義の無い `views/<名前>.tsx` は止まる。ファイル名は英小文字始まりの camelCase(点や印は付けない)
- `views/<名前>.tsx` の形 = `MessageEmailViewModule`(`export { EmailView }` の 1 行スイッチ)。`EmailView` の props = `MessageEmailViewProps<色の型>`(`content` = `{{鍵}}` を差し込んだ後のメールの欄 `EmailFields`・`theme`・`unsubscribeUrl?`)。変数(vars)は渡さない。色の型はメールの部品の lib が決める(この lib は React とメールの部品に依らない)。一覧の型がこの形を求めるので、形の合わない描き方は tsc で止まる
- メールの経路は宛先 `ChannelSendTarget` の `messageKey` で一覧の `view` を引く(無ければ経路の既定の描き方)
- 全件の検査(L2.2): `src/features/core/messaging/services/server/sendMessage/messageRegistry.test.ts` が一覧の全件に上書きを重ねて `validateMessageDefinition` をかけ、鍵の一致と描き方の `EmailView` を確かめる(`checkMessageRegistry`)
- 生成は字面だけを読み、定義を実行しない。欄・`{{鍵}}` などの値は送る口が `validateMessageDefinition` で見る

## 定義の読み手の検査(validateMessageDefinition)

`validateMessageDefinition(definition, { categories, override?, channels?, variableKeys? })` → 問題の一覧(空 = 通る)。上書きを渡すと重ねた結果を検査する。`categories` = 種類の受け口(鍵 → 項目、fork の種類の上書きを重ねた後)。`resolveMessageDefinition(definition, override, category)` が上書きを重ね種別と経路を付けた定義を返す(`applyMessageOverride` は上書きだけ)。種類の受け口は `validateMessageCategories(categories, groups)`(種別・経路・グループ)。

- `invalid_key`: 鍵の形
- `required_disabled` / `required_without_email` / `required_admin_editable` / `required_throttle`: required の守り
- `unknown_category`: 種類が受け口に無い
- `kind_admin_editable` / `kind_throttle`: 種別の性質で文言の上書き・間引きが無い種別(functional・security)
- `unknown_channel` / `missing_content` / `invalid_content`: 経路と欄(欄の zod に合わない・種類の経路に欄が無い)
- `unknown_admin_editable`: adminEditable が定義に無い欄
- `unknown_variable`: 欄の `{{鍵}}` が vars ∪ 共通の文脈に無い
- `invalid_throttle`: throttle.by が vars に無い・seconds が正でない
- `override_forbidden_key`: 上書きが key・kind・vars・required・category・defaultChannels を持つ

## 管理画面の欄の値(adminFields.ts)

管理画面で直した欄の値(D21・D24・D28)を、保存する口と送る口が同じ純粋な関数で検査する。

- `checkAdminFieldValue(resolved, fieldPath, value, { channels?, variableKeys? })` → 問題(null = 通る)。`resolved` = 上書きを重ねた後の定義
  - `not_editable`: 今の `adminEditable` に無い欄 / `invalid_value`: 欄の zod を通らない / `length_mismatch`: コードの値が配列なのに長さが違う(描き方が段落を位置で読むため) / `unknown_variable`: 使えない `{{鍵}}`
- `adminFieldAllowedKeys(resolved, variableKeys)`: 使ってよい鍵 = vars(`secretVar` の鍵を除く)・共通の文脈・throttle の鍵・`variableKeys`(当たる enrichers の provides)
- `applyAdminFieldValues(resolved, values, options)` → `{ resolved, rejected }`: 通る欄だけ差し替え、通らない欄はコードの値のまま `rejected` に返す(空で送らない)
- `adminFieldCodeValue(resolved, fieldPath)`: 欄のコードの値

## 受け口の項目(receptacles/types.ts)

ドメイン messaging の受け口(`src/features/core/messaging/extensionPoints.ts`、表は `src/features/core/messaging/README.md`「受け口」)に置く項目の型。

- `MessageChannel`(経路): `key`・`label`・`addressing`(`user` = 利用者から引く / `address` = 宛先を直に)・`enabled?`(経路の入切、既定 true。false は項目が無い経路と同じ扱い = 配達の行は `channel_off`。値は項目が自分の設定から読む。門の機能ではない)・`fields`(経路の欄の zod)・`contentFrom?`(他の経路の欄から中身を作る宣言)・`resolveAddresses?`(既定は端末の帳簿)・`endpoint?`(帳簿を読む経路の宛先の形 `{ address: zod }`。端末の登録の口が検査し、変換後の値を残す。無ければ汎用の形)・`preview?`(管理の送信のプレビュー。差し込み済みの欄を送る時と同じ描き方で描く。email = HTML。無い経路は欄をそのまま見せる)・`connectHref?`(宛先の無い利用者を案内する先 = サイト内のパスか URL。好みの表が宛先の無い経路に出す。連携の画面が無い経路は持たない)・`send(宛先の束)`(宛先 `ChannelSendTarget` = `userId`・`address`・`messageKey`(連絡の鍵。メールの経路は連絡ごとの描き方を引く)・`idempotencyKey`・`content`、好みに従う連絡だけ `category`(配信停止の種類)と送る側が付ける `headers`(List-Unsubscribe など))→ 宛先ごとの `ChannelSendResult`(`sent` か `transient` / `permanent` / `unknown`。宛先の失効が確定したときだけ `addressInvalid`)・`webhooks?`(provider → `{ verify, normalize }`。事件の形は lib/mail の webhook と同じ + 送る時にタグで渡した配達の id `deliveryId?`)
- `MessageEnricher`(値): `key`・`messages`(`"*"` か連絡の鍵の配列)・`provides`(足す変数の zod)・`resolve(文脈)`
- `MessageCategory`(種類 = 1 つの出来事、配信停止の単位 = 種類 × 経路): `key`・`label`・`description?`・`kind`(7 つ)・`channels`(届ける経路)・`group?`(設定画面の見出し `MessageCategoryGroup` の鍵、同じ種別だけ)。fork は上流の種類の `<名前>.override.ts` で `label`・`description`・`channels`・`group` を変えられる(鍵・種別は不可)
- `MessageCategoryGroup`(種類のグループ、`messaging/categoryGroups/<名前>.ts` の `export const group`): `key`・`label`・`order`。見出しだけで停止の単位ではない(D82)。上流は出荷しない
- `MessageAudience`(宛先の集め方): `key`・`label`・`args`(zod)・`resolveUserIds(args, cursor)` → `{ userIds, nextCursor }`(keyset、`null` で終わり)・`count?(args)`(管理の送信の宛先数の見込み。無ければ resolveUserIds を上限まで数える。送る時に数え直す)
- `MessageSource`(送り元): `key`・`label`
- `MessageSubscriber`(送った後の購読): `key`・`on`(事件の種類)・`filter?`(連絡の鍵・経路)・`handle(事件の束)`(事件の id + 購読の鍵で冪等に。投げると次回もう一度渡る)

## 経路の失敗(ChannelError)

経路の送信の失敗。`kind` = `transient`(一時)| `permanent`(恒久)| `unknown`(受付不明)で、lib/mail の `MailSendError` と同じ語彙(`src/lib/mail/errors.test.ts` が固定)。`channel`(経路の鍵)・`reason`(機械が読む理由)・`cause`。

## テスト

`pnpm test src/lib/messaging`
