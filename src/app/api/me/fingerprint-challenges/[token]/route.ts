// src/app/api/me/fingerprint-challenges/[token]/route.ts
//
// 回答者本人向けのチャレンジ取得 (質問・状態・期限)。
// トークン一致 + セッションユーザー一致の二重検証はサービス側で行う。
// fingerprintChallengeConfig.challenge.enabled が false の環境では 404 (fail-closed)。
// allowStatuses: チャレンジの主対象は suspended ユーザーのため
// fingerprintChallengeConfig.challenge.answerableStatuses (既定 active + suspended) を通す。

import { createMeRoute } from "@/wiring/apiRoute";
import { DomainError } from "@/lib/errors";
import { fingerprintChallengeConfig } from "@/features/fingerprintChallenge/config";
import { getChallengeForUser } from "@/features/core/fingerprintChallenge/services/server";

type Params = { token: string };

export const GET = createMeRoute<Params>(
  {
    operation: "GET /api/me/fingerprint-challenges/[token]",
    operationType: "read",
    allowStatuses: fingerprintChallengeConfig.challenge.answerableStatuses,
  },
  async (_req, { params, user }) => {
    if (!fingerprintChallengeConfig.challenge.enabled) {
      throw new DomainError("Not Found", { status: 404 });
    }

    const challenge = await getChallengeForUser(params.token, user.userId);
    return { challenge };
  },
);
