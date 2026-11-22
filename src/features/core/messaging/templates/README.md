# templates(システムテンプレートの受け口)

## Overview

管理の送信の白紙とできあがった文面。管理者がその場で書く送信も、fork のコードからの管理の送信も、この白紙か DB のテンプレートから書く。

上流のシステムテンプレート(6 本):

- シンプルな白紙(ひな形 `simple` = 件名・サムネイル・本文・リンクのボタン、種別の既定): `announcement`「一般的なお知らせ_シンプル」・`direct`「一般的な個別連絡_シンプル」・`promotion`「一般的なプロモーション_シンプル」
- リッチな白紙(ひな形 `notice` = 件名 + ブロックの並び): `announcementRich`「一般的なお知らせ_リッチ」・`directRich`「一般的な個別連絡_リッチ」・`promotionRich`「一般的なプロモーション_リッチ」
- 経路の既定: 上流の 3 種別のカテゴリーは `defaultChannels: ["inApp"]`(送る画面の送信方法は最初お知らせだけ。メールで送る時は送る時に入れる。メールつきのテンプレートは置かない)

## API

`templates/<名前>.ts` の `export const systemTemplate`(型 `MessageSystemTemplate`、`@/lib/messaging`): `key`・`kind`・`label`・`layout`・`values`・`vars?`・`enabled?`

- `kind` = 管理者がその場で送れる種別(種別の性質 `adminFreeText` がある物 = announcement・direct・promotion)。1 つの種別に何本でも置け、受け口の順(ファイル名の順)でその種別の使う物(`enabled` が false でない物)の最初が種別の既定の白紙(送る画面がテンプレートを選ばない時の出どころ、選択肢の `categories[].systemTemplate`)
- `values` = 白紙の欄の中身か、できあがった文面(ひな形の欄の形)。送る画面で直せる
- `vars?` = 専用の埋め込み情報の宣言(DB のテンプレートと同じ形。送る人が送る時に値を入れる。日付・日時は差し込む時に人が読む字になる)。例(メンテナンスのお知らせ、上流には置かない):

```ts
export const systemTemplate: MessageSystemTemplate = {
  key: "maintenance",
  kind: "announcement",
  label: "メンテナンスのお知らせ",
  layout: "simple",
  values: { subject: "メンテナンスのお知らせ", body: "下記の日時にメンテナンスを行います。\n開始: {{開始日時}}\n終了: {{終了日時}}" },
  vars: [
    { key: "startAt", alias: "開始日時", type: "datetime", required: true },
    { key: "endAt", alias: "終了日時", type: "datetime", required: true },
  ],
};
```

- `enabled?` = false で使わない(既定 true): テンプレートの一覧・送る画面の選択肢・種別の既定の白紙から外れ、その鍵では送れない(無い鍵と同じ 400)

## Extension

- 表示名を変える・使わない: 隣に `<名前>.override.ts`(`export const override = { label }` / `{ enabled: false }`)。送れる種別ごとに使う物が 1 本も無いと検査が止める
- 足す: 自分のドメインの `templates/<名前>.ts` に置く(上流と同じ形。同じ種別に何本でも)

## Internals

- 生成の一覧: `pnpm generate extensions` → `extensions/systemTemplates.ts`
- 検査: 送る口の `checkSystemTemplates`(鍵の形・名前・`enabled` の型・種別・ひな形が受け口にある・専用の宣言の形と名前の重なり・送れる種別ごとに使う物が 1 本以上)。誤りがあれば送る口が 500 で止める
- 管理画面: テンプレートの一覧に印つき(`system: true`、id = `system:<鍵>`)で並ぶ(切った物は出さず、1 件は 404)。直す・公開・取り下げは 409(API が拒む)。1 件は専用の宣言 `vars` と埋め込み情報の一覧 `catalog` も返す
- 送る画面の選択肢 `systemTemplates`(使う物の全部)から選べる。選ばない時はカテゴリーの種別の既定の白紙で送る。専用の宣言があれば値の入力を出す(必須の値が無ければ送る口が 400)

## Related

- 管理のテンプレートの口: `../services/server/templates/README.md`
- 定義と受け口の項目の型: `src/lib/messaging/README.md`
