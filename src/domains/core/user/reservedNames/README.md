# reservedNames(表示名の予約名プロバイダの受け口)

## Overview

ボット・NPC・合成ランキングエントリなど「実ユーザーの隣に表示される非ユーザー名」や、
「運営」「admin」等の予約語を実ユーザーに取らせたくない場合は、
`src/domains/core/user/reservedNames/<名前>.ts` に `export const provider` を置き `pnpm generate extensions`（上流は項目 0 = 挙動変化なし）。

## Usage

```ts
// 例: 静的な予約語リスト
export const provider: ReservedUserNameProvider = {
  key: "static-reserved-words",
  filterReserved: async (names) => names.filter((n) => ["運営", "admin", "公式"].includes(n)),
};
```

- `filterReserved(normalizedNames, ctx)` は「渡された正規化済み名前のうち予約済みのもの」を返す。
  比較の対象は `normalizeUserNameForComparison` と同じ正規化（trim + caseInsensitive 時は小文字化）
- users スキャンで空きだった名前についてのみ照会される。サフィックス採番
  （restore 衝突・dedup）も予約名を自動回避する
- advisory lock を保持したトランザクション内で呼ばれるため、遅いプロバイダは同名サインアップの直列化待ちを伸ばす
- `ctx.executor` が渡された場合、Drizzle 参照はそれを使う（ガードと同一トランザクションで読むため）

## Related

- 表示名の一意性: `../Internals.md`「表示名の一意性」
- 受け口の仕組み: `scripts/structure/extensions/README.md`
