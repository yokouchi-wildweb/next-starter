// src/app/api/me/fingerprint-challenges/[token]/route.ts
//
// 回答者本人向けのチャレンジ取得 (質問・状態・期限)。
// トークン一致 + セッションユーザー一致の二重検証はサービス側で行う。
// 門番の規則 fingerprintChallenge(既定は閉)が閉じていれば proxy が 404 を返す(ここまで届かない)。
// allowStatuses: チャレンジの主対象は suspended ユーザーのため
// fingerprintChallengeConfig.challenge.answerableStatuses (既定 active + suspended) を通す。

import { createMeRoute } from "@/wiring/apiRoute";
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
    const challenge = await getChallengeForUser(params.token, user.userId);
    return { challenge };
  },
);
