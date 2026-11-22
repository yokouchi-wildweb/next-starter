import { isDevelopment } from "@/lib/appEnv";
import { isPageNavigation } from "@/lib/request";
import type { NextRequest, NextResponse } from 'next/server';

import { gate } from '@/featureGate';

import { ACQUISITION_COOKIE_NAME } from '@/domains/core/userAcquisition/constants';
import {
  appendTouch,
  parseAttributionCookie,
  serializeAttributionCookie,
} from '@/domains/core/userAcquisition/lib/attributionCookie';
import {
  classifyVisit,
  getAttributionCookieMaxAgeSeconds,
} from '@/domains/core/userAcquisition/lib/classifyVisit';
import type { ProxyResponseDecorator } from './types';

/**
 * サインアップ流入経路計測: 流入タッチを cookie へ蓄積するデコレーター。
 *
 * UTM パラメータ / 判別表の行(広告クリック ID・招待など) / 外部リファラーを伴うページ閲覧を
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
  // 記録するかは門番の規則 userAcquisition の入切だけ(設定 L1.56)。閉なら何もしない
  if (!gate.enabled("userAcquisition")) return;
  if (request.method !== 'GET') return;
  if (!isPageNavigation(request)) return;

  const touch = classifyVisit({
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
    secure: !isDevelopment(),
    path: '/',
    // 追記のたびにリフレッシュ = 最終タッチから cookieMaxAgeDays 日有効
    maxAge: getAttributionCookieMaxAgeSeconds(),
  });
};
