import { NextResponse } from 'next/server';

import { resolveSessionUser } from '@/features/auth/services/server/session/token';
import { parseSessionCookie } from '@/lib/jwt';

import type { ProxyHandler } from './types';

const LOGIN_ONLY_PATHS = new Set(['/login', '/signup']);
const TOAST_COOKIE_NAME = 'app.toast';
const TOAST_COOKIE_MAX_AGE_SECONDS = 10;

const ALREADY_AUTHENTICATED_TOAST = {
  message: 'すでにログイン済みです。',
  variant: 'info' as const,
};

export const redirectProxy: ProxyHandler = async (request) => {
  const pathname = request.nextUrl.pathname;

  if (!LOGIN_ONLY_PATHS.has(pathname)) {
    return;
  }

  const token = parseSessionCookie(request.cookies);

  if (!token) {
    return;
  }

  const sessionUser = await resolveSessionUser(token);

  if (!sessionUser) {
    return;
  }

  const response = NextResponse.redirect(new URL('/', request.url));

  response.cookies.set(TOAST_COOKIE_NAME, JSON.stringify(ALREADY_AUTHENTICATED_TOAST), {
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    maxAge: TOAST_COOKIE_MAX_AGE_SECONDS,
  });

  return response;
};
