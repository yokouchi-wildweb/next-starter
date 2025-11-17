# Next.js バージョンごとの重要な変更点

## Next.js 16（2024年10月）

### Cache Components と `"use cache"` ディレクティブ
- App Router のキャッシュ戦略が **明示的 opt-in** モデルに刷新。`"use cache"` ディレクティブを付けたコンポーネント／関数単位でキャッシュキーが自動生成される。
- 既存の `experimental.ppr` / `experimental_ppr` 設定は削除。`next.config.ts` で `cacheComponents: true` を有効化して新モデルへ移行する。

```ts
// next.config.ts
const nextConfig = {
  cacheComponents: true,
};
export default nextConfig;
```

> PPR を利用していたページは Suspense 境界を保ったまま自動的に Cache Components へ移行する。旧フラグは削除すること。

### キャッシュ API の刷新
- **`revalidateTag(tag, cacheLife)` 形式に変更**。SWR を成立させるため `cacheLife` プロファイル（`'max' | 'days' | 'hours'` など）または `{ expire: number }` を第2引数に渡す必要がある。
- Server Actions 専用の **`updateTag(tag)`**（即時読み直し）と **`refresh()`**（非キャッシュ領域のみ更新）が追加。フォーム送信後の即時反映やバッジ数の更新など、`router.refresh()` のサーバー側代替として利用する。

```ts
import { revalidateTag, updateTag, refresh } from 'next/cache';

export async function updateUserProfile(id: string, profile: Profile) {
  await db.users.update(id, profile);
  updateTag(`user-${id}`); // 変更を即座に反映
}

export async function revalidateListing() {
  revalidateTag('listings', 'max'); // 背景で再検証
}

export async function markNotificationAsRead(id: string) {
  await db.notifications.markAsRead(id);
  refresh(); // キャッシュされていない表示だけを更新
}
```

### `proxy.ts` へのリネーム（旧 `middleware.ts`）
- ネットワーク境界を明示するため Node.js ランタイム専用の `proxy.ts` が導入。既存のミドルウェアはファイル名とエクスポートをリネームする。
- Edge Runtime での `middleware.ts` は当面互換だが将来的に削除予定。

```ts
// 変更前: middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  return NextResponse.redirect(new URL('/home', request.url));
}

// 変更後: proxy.ts
import { NextRequest, NextResponse } from 'next/server';

export default function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL('/home', request.url));
}
```

### Turbopack と開発体験の更新
- Turbopack が開発・本番ともに Stable。新規プロジェクトではデフォルトバンドラー。Webpack を使い続けたい場合は `next dev --webpack` / `next build --webpack` を明示する。
- ファイルシステムキャッシュ（β）で再起動時のビルドを高速化可能。

```ts
// next.config.ts（一部抜粋）
const nextConfig = {
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
};
export default nextConfig;
```

- `create-next-app` の初期テンプレートが刷新（App Router + TypeScript + Tailwind CSS）。

### Build Adapter / React Compiler
- Build Adapter API が α 版で追加。独自ビルド手順を挟む場合は `experimental.adapterPath` にアダプターを指定。

```ts
const nextConfig = {
  experimental: {
    adapterPath: require.resolve('./my-adapter.js'),
  },
};
export default nextConfig;
```

- React Compiler が stable オプションに昇格。`next.config.ts` の `reactCompiler: true` と `babel-plugin-react-compiler` の導入でゼロ記述のメモ化が可能（ビルド時間増に留意）。

### ルーティングとプリフェッチの改善
- レイアウトの重複ダウンロード削減とインクリメンタルプリフェッチでネットワークコストが低下。コード変更は不要だが、リクエスト数の増加が問題になる場合は監視推奨。

### 主要な互換性・削除項目
- Node.js 20.9 以上 / TypeScript 5.1 以上が必須。ブラウザの最小バージョンは Chrome 111 / Safari 16.4 などに更新。
- 削除済み項目：AMP サポート、`next lint` コマンド、`devIndicators` 設定、`serverRuntimeConfig` / `publicRuntimeConfig`、`experimental.ppr` など。
- CSS の `scroll-behavior: smooth` 自動付与が廃止。必要な場合は `<html data-scroll-behavior="smooth">` を付与。

### その他のトピック
- Next.js DevTools MCP（AI 連携デバッグ）、ログ出力の粒度改善など開発サポート機能が追加。直接のコード修正は不要だが、導入時は権限やプライバシー設定を確認する。

---

## Next.js 16 で継続確認すべき互換ポイント（Next.js 15 で導入済み）

Next.js 15 で導入された変更のうち、Next.js 16 でも引き続き必要となる対応をまとめています。15 以前のプロジェクトを 16 にアップグレードする際は、以下の事項を満たしているかを再確認してください。

### App Router の `params` 非同期化
- ルートハンドラー／ページの第2引数が `Promise` 化。`await params` で展開する（Next.js 16 でも同様）。

```ts
// 修正前（Next.js 14 以前）
export async function POST(req, { params }: { params: { domain: string } }) {
  const { domain } = params;
}

// 修正後（Next.js 16 / Next.js 15 以降）
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ domain: string }> },
) {
  const { domain } = await params;
}
```

- `searchParams`, `cookies`, `headers` なども同様に非同期オブジェクトになるため、参照前に `await` を挟む（Next.js 16 でも同様）。

### Firebase Hosting × App Router のキャッシュ問題
- ビルド時に静的化されるページは DB 更新が反映されないことがある。
- 対応案
  1. `export const dynamic = 'force-dynamic'`
  2. `fetch(..., { cache: 'no-store' })`
  3. クライアント側で SWR などを利用
- Firebase Hosting の CDN キャッシュも考慮し、必要に応じて API に `Cache-Control: no-store` を付与する。

> 詳細: [`docs/troubleshooting/FirebaseのHostingにデプロイ後にDBが更新されない問題.md`](../troubleshooting/FirebaseのHostingにデプロイ後にDBが更新されない問題.md)
