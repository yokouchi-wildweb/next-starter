// src/app/api/me/fingerprint-challenges/[token]/route.ts
//
// 回答者本人向けのチャレンジ取得 (質問・状態・期限)。
// トークン一致 + セッションユーザー一致の二重検証はサービス側で行う。
// FINGERPRINT_CONFIG.challenge.enabled が false の環境では 404 (fail-closed)。

import { createMeRoute } from "@/lib/routeFactory";
import { DomainError } from "@/lib/errors";
import { FINGERPRINT_CONFIG } from "@/config/app/fingerprint.config";
import { getChallengeForUser } from "@/features/core/fingerprintChallenge/services/server";

type Params = { token: string };

export const GET = createMeRoute<Params>(
  {
    operation: "GET /api/me/fingerprint-challenges/[token]",
    operationType: "read",
  },
  async (_req, { params, user }) => {
    if (!FINGERPRINT_CONFIG.challenge.enabled) {
      throw new DomainError("Not Found", { status: 404 });
    }

    const challenge = await getChallengeForUser(params.token, user.userId);
    return { challenge };
  },
);
