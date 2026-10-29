// src/features/core/auth/services/server/session/refreshSessionResponse.ts
//
// GET /api/auth/session の応答を作る（セッションの確認とトークンの再発行）。
// 利用者はルートの Factory が解いた ctx.user を受け取り、解き直さない（同じ解決結果を使い回す）。
// Cookie の有無の判定・トークンの再発行・失効した Cookie の消去はここが持ち、ルートは呼ぶだけ。

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import type { SessionUser } from "@/features/core/auth/entities/session";
import { parseSessionCookie } from "@/lib/jwt";

import { clearSessionCookie } from "./clearSessionCookie";
import { refreshSessionCookie } from "./token";

function unauthorized(message: string): NextResponse {
  const response = NextResponse.json({ message }, { status: 401 });
  clearSessionCookie({ cookies: response.cookies });
  return response;
}

/**
 * セッションを確かめ、有効なら DB の現在値でトークンを再発行した応答を返す。無効なら 401 + Cookie の消去。
 *
 * @param user ルートの Factory が解いた利用者。JWT 検証 + DB 照合（ユーザー存在・sessions_invalidated_at による
 *   強制失効）を通った DB の現在値。旧トークンのクレームで再署名すると失効済みトークンを新しい有効トークンへ
 *   洗浄できてしまうため、必ずこの解決結果から再発行する。status は問わない（ルートは全 status を通す宣言）
 */
export async function refreshSessionResponse(user: SessionUser | null): Promise<NextResponse> {
  if (!user) {
    const hasToken = parseSessionCookie(await cookies()) !== null;
    return unauthorized(hasToken ? "セッションの検証に失敗しました" : "セッションが見つかりません");
  }

  // レスポンス本文に新トークンの expiresAt を含めるため、先に Cookie を書いた
  // ヘッダーを作ってから本文付きレスポンスへ引き継ぐ。
  const cookieCarrier = new NextResponse(null);
  const { expiresAt } = await refreshSessionCookie(cookieCarrier.cookies, user);

  return NextResponse.json(
    {
      user,
      session: {
        expiresAt: expiresAt.toISOString(),
      },
    },
    { headers: cookieCarrier.headers },
  );
}
