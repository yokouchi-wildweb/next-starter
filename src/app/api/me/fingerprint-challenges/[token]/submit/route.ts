// src/app/api/me/fingerprint-challenges/[token]/submit/route.ts
//
// チャレンジ回答の提出。デバイスフィンガープリントの強制添付と状態遷移は
// submitChallenge (同一トランザクション) が行う。
// FINGERPRINT_CONFIG.challenge.enabled が false の環境では 404 (fail-closed)。
//
// skipForDemo: false — デモユーザーにチャレンジを発行する運用は想定しないが、
// 誤発行時に「成功したように見えて何も記録されない」より明示エラーの方が安全なため
// デモスキップに乗せず実処理に到達させる (所有者検証で 404 になる)。

import { createMeRoute } from "@/lib/routeFactory";
import { DomainError } from "@/lib/errors";
import { FINGERPRINT_CONFIG } from "@/config/app/fingerprint.config";
import { submitChallenge } from "@/features/core/fingerprintChallenge/services/server";

type Params = { token: string };

export const POST = createMeRoute<Params>(
  {
    operation: "POST /api/me/fingerprint-challenges/[token]/submit",
    operationType: "write",
    skipForDemo: false,
  },
  async (req, { params, user }) => {
    if (!FINGERPRINT_CONFIG.challenge.enabled) {
      throw new DomainError("Not Found", { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const challenge = await submitChallenge({
      token: params.token,
      userId: user.userId,
      body,
    });

    return { challenge };
  },
);
