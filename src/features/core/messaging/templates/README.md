# templates(システムテンプレートの受け口)

管理の送信の白紙とできあがった文面(D117・D119・D125)。管理者がその場で書く送信も、fork のコードからの管理の送信も、この白紙か DB のテンプレートから書く。

## 形

- `templates/<名前>.ts` の `export const systemTemplate`(型 `MessageSystemTemplate`、`@/lib/messaging`): `key`・`kind`・`label`・`layout`・`values`・`embedded?`
- `kind` = 管理者がその場で送れる種別(種別の性質 `adminFreeText` がある物 = announcement・direct・promotion)。1 つの種別に何本でも置け、受け口の順(ファイル名の順)でその種別の最初が種別の既定の白紙(送る画面がテンプレートを選ばない時の出どころ、選択肢の `categories[].systemTemplate`)
- `values` = 白紙の欄の中身か、できあがった文面(ひな形の欄の形)。送る画面で直せる
- `embedded?` = 専用の埋め込み情報の宣言(DB のテンプレートと同じ形。送る人が送る時に値を入れる。日付・日時は差し込む時に人が読む字になる)
- 生成の一覧: `pnpm generate extensions` → `extensions/systemTemplates.ts`
- 検査: 送る口の `checkSystemTemplates`(鍵の形・名前・種別・ひな形が受け口にある・専用の宣言の形と名前の重なり)。誤りがあれば送る口が 500 で止める

## 上流のシステムテンプレート(7 本、D119)

- シンプルな白紙(ひな形 `simple` = 件名・サムネイル・本文・リンクのボタン、種別の既定): `announcement`・`direct`・`promotion`
- リッチな白紙(ひな形 `notice` = 件名 + ブロックの並び): `announcementRich`・`directRich`・`promotionRich`
- `maintenance`(種別 announcement、ひな形 `simple`): メンテナンスのお知らせ。文面はできあがった形で、専用の埋め込み情報 開始日時(`startAt`)・終了日時(`endAt`)(日時、必須)を `{{開始日時}}`・`{{終了日時}}` で書いてある
- 経路の既定: 上流の 3 種別のカテゴリーは `defaultChannels: ["inApp"]`(送る画面の送信方法は最初お知らせだけ。メールで送る時は送る時に入れる。メールつきのテンプレートは置かない)

## 管理画面での扱い

- テンプレートの一覧に印つき(`system: true`、id = `system:<鍵>`)で並ぶ。直す・公開・取り下げは 409(API が拒む)。1 件は専用の宣言 `embedded` と埋め込み情報の一覧 `catalog` も返す
- 送る画面の選択肢 `systemTemplates`(全部)から選べる。選ばない時はカテゴリーの種別の既定の白紙で送る。専用の宣言があれば値の入力を出す(必須の値が無ければ送る口が 400)

## fork

- 表示名だけ変える: 隣に `<名前>.override.ts`(`export const override = { label }`)
- 足す: 自分のドメインの `templates/<名前>.ts` に置く(上流と同じ形。同じ種別に何本でも)
