import { NextRequest, NextResponse } from 'next/server';
import { createProxyUser } from '@/domains/core/auth/services/server/proxyUserDeps';
import { proxyHandlers, proxyResponseDecorators } from './proxies';
import type { ProxyContext } from './proxies';
import { serverErrorReport } from '@/wiring/serverErrors';

// proxy を走らせる住所の絞り込み(Next.js の matcher。ビルド時に読むのでリテラルだけで書く。fork は変えない)。
// 外すのは、どの項目(メンテナンス・デモ・門番・転送・cookie)も要らない静的なファイルだけ:
// ビルドの出力 /_next/static・画像の最適化 /_next/image・public の素材 /assets/(utils/assets の置き場)・favicon.ico・robots.txt・sitemap.xml。
// 「拡張子つきの住所を全部外す」はしない: 点を含むページや /api の住所まで門番を素通りするため。説明: src/proxies/README.md Internals「対象の住所(matcher)」
export const config = {
  matcher: ["/((?!_next/static/|_next/image|assets/|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$).*)"],
};

export default async function proxy(request: NextRequest) {
  try {
    return await runProxy(request);
  } catch (error) {
    // proxy の throw は Next の onRequestError に届かない。サーバーの失敗の記録へ渡してから同じ失敗を投げ直す(Next の 500 は今のまま)
    await serverErrorReport.report(error, {
      scope: 'proxy',
      path: request.nextUrl.pathname,
      method: request.method,
      headers: Object.fromEntries(request.headers),
    });
    throw error;
  }
}

async function runProxy(request: NextRequest) {
  // 利用者は項目が ctx.user() を呼んだときだけ 1 回解決する(呼ばれなければ DB を引かない)
  const ctx: ProxyContext = { user: createProxyUser(request.cookies) };

  for (const handler of proxyHandlers) {
    const result = await handler(request, ctx);
    if (result) {
      return result;
    }
  }

  // サーバーコンポーネントから現在のパスを参照できるようヘッダーに付与
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // 素通しレスポンスへの副作用（cookie 付与等）。ハンドラーがインターセプトした場合は実行されない
  for (const decorator of proxyResponseDecorators) {
    await decorator(request, response, ctx);
  }

  return response;
}
