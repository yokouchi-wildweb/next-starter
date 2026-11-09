// src/app/api/me/fingerprint-challenges/pending/route.ts
//
// ログイン本人の「未回答かつ期限内」の最新チャレンジを返す (無ければ challenge: null)。
// 生トークンを持たない本人向け経路 (メール紛失時や /restricted 着地ページの CTA から、
// トークン無しの回答ページへ誘導する用途)。user_id でのみ絞るため他人の行は返らない。
//
// ルーティング: 静的セグメント pending は動的 [token] より優先されるため、
// "pending" という生トークンが来ても衝突しない (トークンは base64url 43 文字)。
// 門番の規則 fingerprintChallenge(既定は閉)が閉じていれば proxy が 404 を返す(ここまで届かない)。
// allowStatuses: fingerprintChallengeConfig.challenge.answerableStatuses (既定 active + suspended)。

import { createMeRoute } from "@/wiring/apiRoute";
import { fingerprintChallengeConfig } from "@/features/fingerprintChallenge/config";
import { getPendingChallengeForUser } from "@/features/core/fingerprintChallenge/services/server";

export const GET = createMeRoute(
  {
    operation: "GET /api/me/fingerprint-challenges/pending",
    operationType: "read",
    allowStatuses: fingerprintChallengeConfig.challenge.answerableStatuses,
  },
  async (_req, { user }) => {
    const challenge = await getPendingChallengeForUser(user.userId);
    return { challenge };
  },
);
