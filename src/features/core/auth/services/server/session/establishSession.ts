// src/features/core/auth/services/server/session/establishSession.ts
//
// セッションを出す公開の口と、その部品 2 つ。新しい認証手段(fork の LINE ログインなど)の route は establishSession だけを呼ぶ
// (状態の分岐・SessionUser・署名・cookie を写さない。写しは D37 で禁止)。
//
// - establishSession: 状態の分岐 → 最終ログインの更新(ip・ログインの記録)→ SessionUser → 署名 → cookie の順。
//   cookie は分岐を通った後でしか出ないので、守りを迂回できない
// - assertSessionStatus: 状態の分岐(上流の既定)。security_locked・pending・withdrawn は 403、inactive は復帰の印
//   (退会者 withdrawn は 403 = 上流の既定。再登録は仮登録 → 本登録の道。さらに拒否を足すのは fork の呼び手)
// - issueSessionToken: DB の現在値の利用者から SessionUser を組み立て、トークンを署名する(既定の maxAge は isDemo で
//   デモの短い時間 / 通常)。上流の 5 か所(firebaseSession・localLogin・demoLogin・registration・refreshSessionCookie)もこれを使う
// 詳細: src/features/core/auth/README.md「セッション」

import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";

import type { SessionUser } from "@/features/core/auth/entities/session";
import { userService } from "@/features/core/user/services/server/userService";

import { issueSessionCookie } from "./issueSessionCookie";
import { assertSessionStatus, issueSessionToken, type SessionSubject } from "./sessionToken";

export { assertSessionStatus, issueSessionToken, type IssuedSessionToken, type SessionSubject } from "./sessionToken";

export type EstablishSessionParams = {
  /** 応答の cookie(NextResponse の response.cookies) */
  cookies: ResponseCookies;
  /** DB の現在値の利用者(createFromProvider・findByProvider などで引いた行) */
  user: SessionSubject;
  /** ログインの記録(users.metadata.loginHistory・user_login_events)に残す IP */
  ip?: string;
};

export type EstablishSessionResult = {
  sessionUser: SessionUser;
  /** inactive(休会中)。セッションは出ている。画面は復帰の手続きへ */
  requiresReactivation: boolean;
  expiresAt: Date;
};

/**
 * 状態を確かめてからセッションを出す(新しい認証手段の route の入口)。
 * 拒否(403)なら何も書かない(最終ログインも cookie も)。
 */
export async function establishSession(params: EstablishSessionParams): Promise<EstablishSessionResult> {
  const { requiresReactivation } = assertSessionStatus(params.user);
  await userService.updateLastAuthenticated(params.user.id, { ip: params.ip });
  const issued = await issueSessionToken(params.user);
  issueSessionCookie({
    cookies: params.cookies,
    token: issued.token,
    expiresAt: issued.expiresAt,
    maxAge: issued.maxAge,
  });
  return { sessionUser: issued.sessionUser, requiresReactivation, expiresAt: issued.expiresAt };
}
