
# Drizzle の sql テンプレートリテラルに Date オブジェクトを直接渡すと 500 エラーになる問題

## 症状

Drizzle の `sql` テンプレートリテラル内で JavaScript の `Date` オブジェクトを直接埋め込むと、PostgreSQL 側でパースに失敗して 500 エラーが発生する。

ローカル開発でも本番でも同様に再現する。

---

## 原因

`sql` テンプレートリテラルに `Date` オブジェクトを渡すと、postgres.js のパラメータバインドで `Date.toString()` 相当の文字列に変換される。

```
"Sun Mar 01 2026 23:59:59 GMT+0900 (Japan Standard Time)"
```

この形式は PostgreSQL の `::timestamptz` キャストが解析できない。

> **注意**: `eq()`, `between()`, `gt()` 等の Drizzle 組み込みオペレータは Date を正しくシリアライズするため、この問題は `sql` テンプレートリテラルに限定される。

---

## NG パターン

```ts
const range = resolveDateRange(params);

// ❌ Date オブジェクトを直接渡している
sql`CASE WHEN ${p.completed_at} >= ${range.dateFrom} THEN 'current' ELSE 'previous' END`

// ❌ ::timestamptz キャストしても Date.toString() が渡るため解決しない
sql`FLOOR(EXTRACT(EPOCH FROM (${range.dateTo}::timestamptz - ${u.createdAt})) / 86400)::int`
```

---

## OK パターン

```ts
const range = resolveDateRange(params);

// ✅ .toISOString() で ISO 8601 文字列に変換してから渡す
sql`CASE WHEN ${p.completed_at} >= ${range.dateFrom.toISOString()} THEN 'current' ELSE 'previous' END`

// ✅
sql`FLOOR(EXTRACT(EPOCH FROM (${range.dateTo.toISOString()}::timestamptz - ${u.createdAt})) / 86400)::int`
```

`.toISOString()` は `"2026-03-01T14:59:59.999Z"` のような形式を返し、PostgreSQL が正しく解析できる。

---

## 判別ルール

| 使い方 | Date をそのまま渡せるか |
|--------|------------------------|
| `eq(column, dateValue)` | ✅ OK（Drizzle が変換） |
| `between(column, from, to)` | ✅ OK（Drizzle が変換） |
| `gt()`, `lt()`, `gte()`, `lte()` | ✅ OK（Drizzle が変換） |
| `` sql`... ${dateValue} ...` `` | ❌ NG（`.toISOString()` 必須） |
| `` sql`... ${dateValue}::timestamptz ...` `` | ❌ NG（キャストしても元の文字列が不正） |

---

## 過去の発生事例

- `purchaseAnalytics.ts` / `userAnalytics.ts` の CASE WHEN 期間比較（コミット: e1a6b7f）
- `purchaseRegistrationAgeAnalytics.ts` の EXTRACT 計算（コミット: 5a69b56 → 修正済み）
