// src/features/core/auth/services/server/session/sessionToken.ts
//
// セッションの部品 2 つ(公開の口 establishSession と上流の 5 か所が使う。userService を読まない = token.ts からも循環なしで使える)。
// - assertSessionStatus: 状態の分岐(上流の既定)
// - issueSessionToken: SessionUser の組み立てと署名(cookie は書かない)
// 詳細: ./establishSession.ts、src/features/core/auth/README.md「セッション」

import { APP_FEATURES } from "@/config/app/app-features.config";
import { SessionUserSchema, type SessionUser } from "@/features/core/auth/entities/session";
import { DomainError } from "@/lib/errors";
import { SESSION_DEFAULT_MAX_AGE_SECONDS, signUserToken } from "@/lib/jwt";

/** セッションを出す利用者(DB の現在値の行。古いトークンのクレームから組み立てない) */
export type SessionSubject = {
  id: string;
  role: string;
  status: string;
  isDemo: boolean;
  providerType: string;
  providerUid: string;
  name: string | null;
};

/** 署名したセッション(route が cookie を書くときの値) */
export type IssuedSessionToken = {
  sessionUser: SessionUser;
  token: string;
  expiresAt: Date;
  maxAge: number;
};

/**
 * 状態の分岐(上流の既定)。許可なら inactive のときだけ requiresReactivation: true(セッションは出し、復帰の画面へ)。
 * suspended・banned はセッションを出し、画面側で /restricted へ。
 */
export function assertSessionStatus(user: Pick<SessionSubject, "status">): { requiresReactivation: boolean } {
  // security_locked はログイン自体をブロックする(不正試行対策)
  if (user.status === "security_locked") {
    throw new DomainError("アカウントがロックされています。", { status: 403 });
  }
  // pending, withdrawn は利用不可
  if (user.status === "pending" || user.status === "withdrawn") {
    throw new DomainError("このアカウントは利用できません", { status: 403 });
  }
  return { requiresReactivation: user.status === "inactive" };
}

/**
 * SessionUser を組み立ててトークンを署名する。cookie は書かない(書くのは呼び手 = route か establishSession)。
 * maxAge の既定: isDemo ならデモの短い時間(APP_FEATURES.auth.session.demoMaxAgeSeconds)、他は通常
 */
export async function issueSessionToken(
  user: SessionSubject,
  options: { maxAge?: number } = {},
): Promise<IssuedSessionToken> {
  const sessionUser = SessionUserSchema.parse({
    userId: user.id,
    role: user.role,
    status: user.status,
    isDemo: user.isDemo,
    providerType: user.providerType,
    providerUid: user.providerUid,
    name: user.name,
  });
  const maxAge =
    options.maxAge ??
    (sessionUser.isDemo ? APP_FEATURES.auth.session.demoMaxAgeSeconds : SESSION_DEFAULT_MAX_AGE_SECONDS);
  const { token, expiresAt } = await signUserToken({
    subject: sessionUser.userId,
    claims: {
      role: sessionUser.role,
      status: sessionUser.status,
      isDemo: sessionUser.isDemo,
      providerType: sessionUser.providerType,
      providerUid: sessionUser.providerUid,
      name: sessionUser.name,
    },
    options: { maxAge },
  });
  return { sessionUser, token, expiresAt, maxAge };
}
