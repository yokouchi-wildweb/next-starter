// src/app/api/me/fingerprint-challenges/by-id/[id]/submit/route.ts
//
// チャレンジ id ベースの回答提出 (本人スコープ経路)。
// GET /api/me/fingerprint-challenges/pending で得た id に対して提出する。
// 所有者検証 (row.userId === user.userId)・状態検証・フィンガープリント強制添付は
// トークン経路と同じ submitChallenge が行う (行の引き方だけが異なる)。
//
// パスに by-id/ を挟む理由: Next.js は同一階層に [token] と [id] のような
// 異なる名前の動的セグメントを共存させられない。トークン経路 /[token]/submit を
// 据え置くため、id 経路は静的プレフィックスで分離する。
// FINGERPRINT_CONFIG.challenge.enabled が false の環境では 404 (fail-closed)。
// skipForDemo / allowStatuses はトークン経路と同じ。

import { createMeRoute } from "@/lib/routeFactory";
import { DomainError } from "@/lib/errors";
import { FINGERPRINT_CONFIG } from "@/config/app/fingerprint.config";
import { submitChallenge } from "@/features/core/fingerprintChallenge/services/server";

type Params = { id: string };

export const POST = createMeRoute<Params>(
  {
    operation: "POST /api/me/fingerprint-challenges/by-id/[id]/submit",
    operationType: "write",
    skipForDemo: false,
    allowStatuses: FINGERPRINT_CONFIG.challenge.answerableStatuses,
  },
  async (req, { params, user }) => {
    if (!FINGERPRINT_CONFIG.challenge.enabled) {
      throw new DomainError("Not Found", { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const challenge = await submitChallenge({
      id: params.id,
      userId: user.userId,
      body,
    });

    return { challenge };
  },
);
