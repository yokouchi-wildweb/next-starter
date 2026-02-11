import { NextRequest, NextResponse } from 'next/server';
import { proxyHandlers } from './proxies';

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

  return NextResponse.next({ request: { headers: requestHeaders } });
}
