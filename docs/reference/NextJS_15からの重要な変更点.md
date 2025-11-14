# NextJS_15からの重要な変更点.md

## 🔁 App Routerの`params`の仕様変更

### 📌 変更内容

- ルートコンポーネントで受け取る引数の変更
- `params` は同期オブジェクトから **非同期 (`Promise`)** に変更された
- `searchParams`, `cookies`, `headers` も同様に非同期化

### ✅ 修正前（Next.js 14 以前）

```ts
export async function POST(req, { params }: { params: { domain: string } }) {
  const { domain } = params;
}
```

### ✅ 修正後（Next.js 15）

```ts
export async function POST(req: NextRequest, { params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
}
```

### ⚠ 注意

- await params を忘れると型エラーになる
- すべての params 使用箇所（API, page, layoutなど）に影響

---

## 🔄 Firebase Hosting × Next.js App Router における「DB変更が反映されない」問題

**症状**：Firebaseにデプロイ後、DB変更（例：作成・削除）がUIに反映されない  
**原因**：App Router の `page.tsx` などが静的最適化（prerender）されるため、**ビルド時点の状態を保持してしまう**

---

### ✅ 対処法（どれかを適用）

1. **動的レンダリングを強制**
   ```ts
   export const dynamic = 'force-dynamic'
   ```

2. **fetchでキャッシュ無効化**
   ```ts
   fetch('/api/data', { cache: 'no-store' })
   ```

3. **クライアント側でSWRなどを使って取得**
   ```ts
   'use client'
   const { data } = useSWR('/api/data', fetcher)
   ```

> Firebase Hosting は CDNキャッシュも関与するため、必要に応じて API レスポンスに `Cache-Control: no-store` を付与

[本件に関する詳細Doc](docs/troubleshooting/FirebaseのHostingにデプロイ後にDBが更新されない問題.md)

---



