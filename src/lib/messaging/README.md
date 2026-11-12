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
  kind: "transactional",
  vars: z.object({ verificationUrl: z.string().url() }),
  required: true,
  record: "meta",
  defaultChannels: ["email"],
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
- `kind`: `transactional`(取引・認証。配信停止の好みを見ない)| `marketing` | `activity`
- `category`: 種類(配信停止の好みの表の行) = categories の受け口の鍵(上流 `marketing`・`activity` と fork の項目)。`marketing`・`activity` は必須、`transactional` は省ける(好みを見ない。上流の取引の連絡は持たない)。受け口に無い鍵・取引でないのに無い category は誤り: 字面は `pnpm check extensions`(messageGuards)、実行時は `validateMessageDefinition` の `categories`(送る口が受け口の鍵を渡す、`unknown_category` / `missing_category`)。上書きの category も同じに照らす
- `vars`: 呼び手が渡す値の zod
  - 秘密の値(トークン入りの URL・ワンタイムコード)は `secretVar(z.string())` で印を付ける。印の鍵を持つ連絡は描いた本文をどこにも残さず(`record: "full"` でも)、vars の写しからその鍵を落とす(送る口が守る)。印は `isSecretVar` / `listSecretVarKeys` で読む。vars は上書きできないので印は外せない
- `required`: 止められない連絡(認証など)。`enabled: false`・email の除外・`adminEditable`・`throttle` を付けられない
- `adminEditable`: 管理画面で直せる欄の名前(`<経路>.<欄>`)。required の連絡は空
- `record`: 本文の残し方 `meta` | `vars`(既定)| `full`
- `throttle`: 会話の間引き `{ by: [vars の鍵], mode: "untilRead" | "window", seconds }`
- `defaultChannels`: 既定で送る経路(content を持つ経路だけ)
- `content`: 経路ごとの名前付きの欄(下)
- `extras`: fork が足す欄の入れ物(メールの描き方の .replace が読む)

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

`messages/<名前>.override.ts`(データだけ)。変えられるのは欄の文言(経路ごとに欄を重ねる)・`extras`・`defaultChannels`・`enabled`・`adminEditable`・`category`・`record`・`throttle`(`null` で外す)。`key`・`kind`・`vars`・`required` は変えられない。

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

## 止められない連絡の守り(pnpm check extensions)

`required: true` の連絡を、生成の前に字面で止める(`scripts/structure/extensions/derive/messageGuards.mjs`。実行時は送る口が同じ守りを `validateMessageDefinition` で見る):

- 定義: `defaultChannels` に `"email"` が無い・`adminEditable` が空でない・`throttle` がある
- 上書き: `enabled: false`・`"email"` の無い `defaultChannels`・空でない `adminEditable`・`throttle`(`null` で外すのは通す)
- 守りに関わる値(定義の `required`・`defaultChannels`・`adminEditable`、上書きの `enabled`・`defaultChannels`・`adminEditable`)はリテラルで書く(変数・式は止まる)

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

`validateMessageDefinition(definition, { override?, channels? })` → 問題の一覧(空 = 通る)。上書きを渡すと重ねた結果を検査する。

- `invalid_key`: 鍵の形
- `required_disabled` / `required_without_email` / `required_admin_editable` / `required_throttle`: required の守り
- `unknown_channel` / `missing_content` / `invalid_content`: 経路と欄(欄の zod に合わない・defaultChannels の経路に欄が無い)
- `unknown_admin_editable`: adminEditable が定義に無い欄
- `unknown_variable`: 欄の `{{鍵}}` が vars ∪ 共通の文脈に無い
- `invalid_throttle`: throttle.by が vars に無い・seconds が正でない
- `override_forbidden_key`: 上書きが key・kind・vars・required を持つ

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
- `MessageCategory`(配信停止の種類): `key`・`label`・`description?`・`kind`(`marketing` | `activity`。取引は好みを見ないので種類を持たない)
- `MessageAudience`(宛先の集め方): `key`・`label`・`args`(zod)・`resolveUserIds(args, cursor)` → `{ userIds, nextCursor }`(keyset、`null` で終わり)・`count?(args)`(管理の送信の宛先数の見込み。無ければ resolveUserIds を上限まで数える。送る時に数え直す)
- `MessageSource`(送り元): `key`・`label`
- `MessageSubscriber`(送った後の購読): `key`・`on`(事件の種類)・`filter?`(連絡の鍵・経路)・`handle(事件の束)`(事件の id + 購読の鍵で冪等に。投げると次回もう一度渡る)

## 経路の失敗(ChannelError)

経路の送信の失敗。`kind` = `transient`(一時)| `permanent`(恒久)| `unknown`(受付不明)で、lib/mail の `MailSendError` と同じ語彙(`src/lib/mail/errors.test.ts` が固定)。`channel`(経路の鍵)・`reason`(機械が読む理由)・`cause`。

## テスト

`pnpm test src/lib/messaging`
