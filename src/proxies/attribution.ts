import type { NextRequest, NextResponse } from 'next/server';

import { ACQUISITION_CONFIG } from '@/config/app/acquisition.config';
import { ACQUISITION_COOKIE_NAME } from '@/features/core/userAcquisition/constants';
import {
  appendTouch,
  buildTouchFromNavigation,
  parseAttributionCookie,
  serializeAttributionCookie,
} from '@/features/core/userAcquisition/lib/attributionCookie';
import type { ProxyResponseDecorator } from './types';

/** アセット配信など、ページナビゲーションでないパスの拡張子 (.js / .png / .ico 等) */
const FILE_EXTENSION_PATTERN = /\.[^/]+$/;

/**
 * サインアップ流入経路計測: 流入タッチを cookie へ蓄積するデコレーター。
 *
 * UTM パラメータ / 広告クリック ID / 外部リファラーを伴うページ閲覧を
 * 「タッチ」として httpOnly cookie に追記する。DB への書き込みは行わず、
 * サインアップ本登録時（/api/auth/register）に cookie を読み取って確定保存する。
 *
 * インターセプト系ハンドラー（redirect 等）が応答した場合は実行されないため、
 * リダイレクト元 URL に付いた UTM は拾えないことがある（許容する）。
 */
export const attributionDecorator: ProxyResponseDecorator = (
  request: NextRequest,
  response: NextResponse,
) => {
  if (!ACQUISITION_CONFIG.enabled) return;
  if (request.method !== 'GET') return;
  if (!isPageNavigation(request)) return;

  const touch = buildTouchFromNavigation({
    url: request.nextUrl,
    referrer: request.headers.get('referer'),
    now: new Date(),
  });
  if (!touch) return;

  const touches = parseAttributionCookie(request.cookies.get(ACQUISITION_COOKIE_NAME)?.value);
  const appended = appendTouch(touches, touch);
  if (!appended) return; // 直前タッチと同一チャンネル（重複）

  response.cookies.set(ACQUISITION_COOKIE_NAME, serializeAttributionCookie(appended), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    // 追記のたびにリフレッシュ = 最終タッチから cookieMaxAgeDays 日有効
    maxAge: ACQUISITION_CONFIG.cookieMaxAgeDays * 24 * 60 * 60,
  });
};

/** ページナビゲーション（HTML ドキュメント要求）のみ対象にする（inviteLink デコレーターと共用） */
export function isPageNavigation(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/')) return false;
  if (FILE_EXTENSION_PATTERN.test(pathname)) return false;

  // sec-fetch-dest が送られてくる環境ではそれを信頼し、
  // 無い環境（古いブラウザ等）は Accept ヘッダーで代替判定する
  const secFetchDest = request.headers.get('sec-fetch-dest');
  if (secFetchDest) return secFetchDest === 'document';

  return request.headers.get('accept')?.includes('text/html') ?? false;
}
