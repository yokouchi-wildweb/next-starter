import { NextRequest, NextResponse } from 'next/server';
import { createProxyUser } from '@/features/core/auth/services/server/proxyUserDeps';
import { proxyHandlers, proxyResponseDecorators } from './proxies';
import type { ProxyContext } from './proxies';

export default async function proxy(request: NextRequest) {
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
