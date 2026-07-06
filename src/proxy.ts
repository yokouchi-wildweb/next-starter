import { NextRequest, NextResponse } from 'next/server';
import { proxyHandlers, proxyResponseDecorators } from './proxies';

export default async function proxy(request: NextRequest) {
  for (const handler of proxyHandlers) {
    const result = await handler(request);
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
    await decorator(request, response);
  }

  return response;
}
