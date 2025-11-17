import type { NextRequest } from 'next/server';

export type ProxyResult = Response | void | Promise<Response | void>;
export type ProxyHandler = (request: NextRequest) => ProxyResult;
