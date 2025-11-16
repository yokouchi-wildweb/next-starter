import { NextRequest, NextResponse } from 'next/server';
import { proxyHandlers } from './proxies';

export default async function proxy(request: NextRequest) {
  for (const handler of proxyHandlers) {
    const result = await handler(request);
    if (result) {
      return result;
    }
  }

  return NextResponse.next();
}
