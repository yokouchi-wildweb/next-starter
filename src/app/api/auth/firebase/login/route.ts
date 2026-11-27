// src/app/api/auth/firebase/login/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/wiring/apiRoute";
import { loginAnnouncementMessage } from "@/domains/core/auth/constants/loginAnnouncement";
import { createFirebaseSession } from "@/domains/core/auth/services/server/firebaseSession";
import { issueSessionCookie } from "@/domains/core/auth/services/server/session/issueSessionCookie";
import { getClientIp } from "@/lib/request";
import { setRedirectToastCookie } from "@/lib/toast";

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/firebase/login",
    // ログインはメンテナンス中も通す（管理者・debugger がログインしてメンテナンスを解けるように）
    maintenance: "pass",
    operationType: "write",
    access: "public",
    skipForDemo: false,
  },
  async (req) => {
    const body = await req.json();
    const ip = await getClientIp();
    const { user, session, requiresReactivation } = await createFirebaseSession({ ...body, ip: ip ?? undefined });

    const response = NextResponse.json({
      user,
      session: {
        expiresAt: session.expiresAt.toISOString(),
      },
      requiresReactivation,
    });

    issueSessionCookie({
      cookies: response.cookies,
      token: session.token,
      expiresAt: session.expiresAt,
      maxAge: session.maxAge,
    });

    // ログインの後の知らせ: 呼び手はページを読み直して移る(D139)ので、読み直しの後に出す cookie を積む(休会中は出さない)
    const announcement = loginAnnouncementMessage(body?.announce);
    if (announcement && !requiresReactivation) setRedirectToastCookie(response, { message: announcement, variant: "success" });

    return response;
  },
);
