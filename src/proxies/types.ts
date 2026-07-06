import type { NextRequest, NextResponse } from 'next/server';

export type ProxyResult = Response | void | Promise<Response | void>;
export type ProxyHandler = (request: NextRequest) => ProxyResult;

/**
 * リクエストを素通しさせつつ、最終レスポンス（NextResponse.next()）に
 * cookie 付与などの副作用を加えるためのデコレーター。
 *
 * ProxyHandler がインターセプト（Response を返却 = チェーン打ち切り）した場合は
 * 実行されない点に注意（リダイレクト・メンテナンス応答等ではスキップされる）。
 */
export type ProxyResponseDecorator = (
  request: NextRequest,
  response: NextResponse,
) => void | Promise<void>;
