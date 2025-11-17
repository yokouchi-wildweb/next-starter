
# Firebase Hosting × Next.js App Router における「データが更新されない」問題の対処ガイド

## 🐞 よくある症状

Firebase Hosting にデプロイしたアプリで：

- データベース（例：Neon/PostgreSQL）への操作は成功しているのに
- 画面上には **データ更新（作成・削除・変更）が反映されない**
- ローカル開発環境では正しく動作する

---

## 🎯 主な原因

Next.js（App Router）の仕様により、以下のいずれかで「**静的化されたデータが返され続ける**」状態になっていることが多い。

### 1. サーバーコンポーネントの自動静的最適化（prerender）

```ts
// ❌ このようなコードはデフォルトで静的HTML化される
export default async function Page() {
  const data = await getSomething()
  return <PageComponent data={data} />
}
```

→ デプロイ時に一度だけデータ取得され、その状態が固定される

---

### 2. fetch() のキャッシュ制御が不十分

```ts
// ❌ 明示しないとキャッシュが残る可能性がある
fetch('/api/data')
```

→ CDN やブラウザ、サーバー側で意図せずキャッシュされることがある

---

## ✅ 解決策

### ✅ A. サーバーコンポーネントで「動的レンダリング」を明示する

```ts
export const dynamic = 'force-dynamic'
```

- ファイルのトップスコープに追加する
- ページ単位で常にリアルタイムにサーバーでデータ取得されるようになる

---

### ✅ B. fetch にキャッシュ無効化オプションを追加（必要に応じて）

```ts
fetch('/api/data', { cache: 'no-store' })
```

---

### ✅ C. クライアント側取得（例：SWR）に切り替える方法も有効

```ts
'use client'
const { data } = useSWR('/api/data', fetcher)
```

> ※SSRしない設計になるので、UXやSEO要件に応じて選択

---

## 💡 補足

- Firebase Hosting（特に frameworksBackend 経由）では、**APIレスポンスもCDNキャッシュされる場合がある**ため、
- Cloud Functions の `Cache-Control` ヘッダーも明示するのが望ましい

```ts
res.setHeader('Cache-Control', 'no-store')
```

---

## 📝 まとめ

| 問題 | 原因 | 対策 |
|------|------|------|
| DBに保存されているのにUIに反映されない | 静的化・キャッシュ | `force-dynamic` / `no-store` / SWR対応 |
