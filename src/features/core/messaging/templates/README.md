# templates(システムテンプレートの受け口)

管理の送信の白紙(D117・D125)。管理者がその場で書く送信も、fork のコードからの管理の送信も、この白紙か DB のテンプレートから書く。

## 形

- `templates/<名前>.ts` の `export const systemTemplate`(型 `MessageSystemTemplate`、`@/lib/messaging`): `key`・`kind`・`label`・`layout`・`values`
- `kind` = 管理者がその場で送れる種別(種別の性質 `adminFreeText` がある物 = announcement・direct・promotion)。種別ごとに 1 つ
- `values` = 白紙の欄の中身(ひな形の欄の形)。送る時は管理者が書いた中身に替わる
- 生成の一覧: `pnpm generate extensions` → `extensions/systemTemplates.ts`
- 検査: 送る口の `checkSystemTemplates`(種別・種別ごとに 1 つ・ひな形が受け口にある)。誤りがあれば送る口が 500 で止める

## 上流の白紙

- `announcement`(種別 announcement)・`direct`(direct)・`promotion`(promotion)。どれもひな形 `notice`(件名 + ブロックの並び)

## 管理画面での扱い

- テンプレートの一覧に印つき(`system: true`、id = `system:<鍵>`)で並ぶ。直す・公開・取り下げは 409(API が拒む)
- 送る画面はテンプレートを読み込まない時、カテゴリーの種別の白紙で送る

## fork

- 表示名だけ変える: 隣に `<名前>.override.ts`(`export const override = { label }`)
- 種別ごとに 1 つなので、上流の白紙と同じ種別の白紙は足せない
