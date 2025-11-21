# 数値 Enum 風の選択肢を設定するには

`domain-config` でフィールドを追加する際、数値の候補を固定したい場合は下記の手順で設定します。

1. `fieldType` に数値系を選択する
   - Firestore: `number`
   - Neon(PostgreSQL): `integer` / `bigint` / `numeric(10,2)` など
2. `formInput` で `select` もしくは `radio` を選ぶ
3. 選択肢の入力では値をそのまま数値で入力する（例: `1`, `2`, `10.5`）
4. 生成後、`src/features/<domain>/constants/field.ts` と `types/field.ts` に数値リテラルの配列と型が出力される

こうしておくと DB には数値として保存され、UI では `as const` の選択肢と `1 | 2 | ...` 型を参照できるため、Enum(数値) と同等の利用体験を得られます。
