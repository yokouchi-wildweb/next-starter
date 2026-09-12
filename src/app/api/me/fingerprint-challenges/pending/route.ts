// src/app/api/me/fingerprint-challenges/pending/route.ts
//
// ログイン本人の「未回答かつ期限内」の最新チャレンジを返す (無ければ challenge: null)。
// 生トークンを持たない本人向け経路 (メール紛失時や /restricted 着地ページの CTA から、
// トークン無しの回答ページへ誘導する用途)。user_id でのみ絞るため他人の行は返らない。
//
// ルーティング: 静的セグメント pending は動的 [token] より優先されるため、
// "pending" という生トークンが来ても衝突しない (トークンは base64url 43 文字)。
// FINGERPRINT_CONFIG.challenge.enabled が false の環境では 404 (fail-closed)。
// allowStatuses: FINGERPRINT_CONFIG.challenge.answerableStatuses (既定 active + suspended)。

import { createMeRoute } from "@/lib/routeFactory";
import { DomainError } from "@/lib/errors";
import { FINGERPRINT_CONFIG } from "@/config/app/fingerprint.config";
import { getPendingChallengeForUser } from "@/features/core/fingerprintChallenge/services/server";

export const GET = createMeRoute(
  {
    operation: "GET /api/me/fingerprint-challenges/pending",
    operationType: "read",
    allowStatuses: FINGERPRINT_CONFIG.challenge.answerableStatuses,
  },
  async (_req, { user }) => {
    if (!FINGERPRINT_CONFIG.challenge.enabled) {
      throw new DomainError("Not Found", { status: 404 });
    }

    const challenge = await getPendingChallengeForUser(user.userId);
    return { challenge };
  },
);
