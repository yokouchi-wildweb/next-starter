// src/app/api/auth/logout/route.ts

import { NextResponse } from "next/server";

import { clearSessionCookie } from "@/features/auth/services/server/session/clearSessionCookie";

export async function POST() {
  // レスポンスを先に生成し、フロントエンドへログアウト完了を通知する。
  const response = NextResponse.json({ success: true });
  // クッキーに保持されているセッショントークンを強制的に破棄する。
  clearSessionCookie({ cookies: response.cookies });
  return response;
}
