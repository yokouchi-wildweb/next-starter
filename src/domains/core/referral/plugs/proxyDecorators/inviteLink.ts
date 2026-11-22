// src/domains/core/referral/plugs/proxyDecorators/inviteLink.ts
// 点 proxyDecorators(src/proxies/extensionPoints.ts)の項目: 招待コードの cookie 保存(機能 referral で閉じる、解析とは独立)
import { isDevelopment } from "@/lib/appEnv";
import { isPageNavigation } from "@/lib/request";
import type { NextRequest, NextResponse } from 'next/server';

import {
  INVITE_LINK_COOKIE_MAX_AGE_DAYS,
  INVITE_LINK_COOKIE_NAME,
  readInviteLinkParam,
} from '@/domains/core/referral/lib/inviteLinkCookie';
import { gate } from "@/featureGate";
import type { ProxyResponseDecorator } from "@/proxies/points";

/**
 * 紹介リワード: 招待リンク（?invite=CODE）の招待コードを専用 cookie へ保存するデコレーター。
 *
 * ゲートは referral 機能フラグのみ。流入経路解析（記録の opt-in）とは独立して動く
 * （解析も有効な場合は userAcquisition の proxy の項目 attribution が同じパラメータをタッチとしても記録する）。
 * 新しい招待リンクを踏むたびに上書き = last-touch の招待者が優先される。
 * cookie はサインアップ本登録の完了時に削除される。
 */
export const decorator: ProxyResponseDecorator = (
  request: NextRequest,
  response: NextResponse,
) => {
  if (!gate.enabled("referral")) return;
  if (request.method !== 'GET') return;
  if (!isPageNavigation(request)) return;

  const code = readInviteLinkParam(request.nextUrl);
  if (!code) return;

  response.cookies.set(INVITE_LINK_COOKIE_NAME, code, {
    httpOnly: true,
    sameSite: 'lax',
    secure: !isDevelopment(),
    path: '/',
    maxAge: INVITE_LINK_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60,
  });
};
