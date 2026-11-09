// src/app/api/me/fingerprint-challenges/[token]/submit/route.ts
//
// チャレンジ回答の提出。デバイスフィンガープリントの強制添付と状態遷移は
// submitChallenge (同一トランザクション) が行う。
// 門番の規則 fingerprintChallenge(既定は閉)が閉じていれば proxy が 404 を返す(ここまで届かない)。
//
// skipForDemo: false — デモユーザーにチャレンジを発行する運用は想定しないが、
// 誤発行時に「成功したように見えて何も記録されない」より明示エラーの方が安全なため
// デモスキップに乗せず実処理に到達させる (所有者検証で 404 になる)。
// allowStatuses: fingerprintChallengeConfig.challenge.answerableStatuses (既定 active + suspended)。

import { createMeRoute } from "@/wiring/apiRoute";
import { fingerprintChallengeConfig } from "@/features/fingerprintChallenge/config";
import { submitChallenge } from "@/features/core/fingerprintChallenge/services/server";

type Params = { token: string };

export const POST = createMeRoute<Params>(
  {
    operation: "POST /api/me/fingerprint-challenges/[token]/submit",
    operationType: "write",
    skipForDemo: false,
    allowStatuses: fingerprintChallengeConfig.challenge.answerableStatuses,
  },
  async (req, { params, user }) => {
    const body = await req.json().catch(() => null);
    const challenge = await submitChallenge({
      token: params.token,
      userId: user.userId,
      body,
    });

    return { challenge };
  },
);
