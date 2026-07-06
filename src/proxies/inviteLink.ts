import type { NextRequest, NextResponse } from 'next/server';

import { APP_FEATURES } from '@/config/app/app-features.config';
import {
  INVITE_LINK_COOKIE_MAX_AGE_DAYS,
  INVITE_LINK_COOKIE_NAME,
  readInviteLinkParam,
} from '@/features/core/referral/lib/inviteLinkCookie';
import { isPageNavigation } from './attribution';
import type { ProxyResponseDecorator } from './types';

/**
 * 紹介リワード: 招待リンク（?invite=CODE）の招待コードを専用 cookie へ保存するデコレーター。
 *
 * ゲートは referral 機能フラグのみ。流入経路解析（ACQUISITION_CONFIG.enabled）とは独立して動く
 * （解析も有効な場合は attributionDecorator が同じパラメータをタッチとしても記録する）。
 * 新しい招待リンクを踏むたびに上書き = last-touch の招待者が優先される。
 * cookie はサインアップ本登録の完了時に削除される。
 */
export const inviteLinkDecorator: ProxyResponseDecorator = (
  request: NextRequest,
  response: NextResponse,
) => {
  if (!APP_FEATURES.marketing.referral.enabled) return;
  if (request.method !== 'GET') return;
  if (!isPageNavigation(request)) return;

  const code = readInviteLinkParam(request.nextUrl);
  if (!code) return;

  response.cookies.set(INVITE_LINK_COOKIE_NAME, code, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: INVITE_LINK_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60,
  });
};
