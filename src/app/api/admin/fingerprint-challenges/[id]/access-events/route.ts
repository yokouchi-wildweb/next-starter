// src/app/api/admin/fingerprint-challenges/[id]/access-events/route.ts
//
// 管理者向け: チャレンジ別のアクセスイベント (本人が開いた日時 + IP + UA) を新しい順に
// ページネーションで返す。IP を含む PII のため admin 限定。
// FINGERPRINT_CONFIG.challenge.accessLog.enabled が false の環境でも過去分の閲覧は許可する
// (有効期間中に蓄積した行を後から確認できるようにするため。無ければ空)。
//
// GET /api/admin/fingerprint-challenges/[id]/access-events?page=1&limit=50

import { createApiRoute } from "@/lib/routeFactory";
import { DomainError } from "@/lib/errors";
import {
  fingerprintChallengeBase,
  listChallengeAccessEvents,
} from "@/features/core/fingerprintChallenge/services/server";

import { BadRequestError, parsePositiveInteger } from "@/app/api/[domain]/search/utils";

type Params = { id: string };

export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/admin/fingerprint-challenges/[id]/access-events",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req, { params }) => {
    const challenge = await fingerprintChallengeBase.get(params.id);
    if (!challenge) {
      throw new DomainError("チャレンジが見つかりません", { status: 404 });
    }

    let page: number | undefined;
    let limit: number | undefined;
    try {
      const query = req.nextUrl.searchParams;
      page = parsePositiveInteger(query.get("page"), "page");
      limit = parsePositiveInteger(query.get("limit"), "limit");
    } catch (error) {
      if (error instanceof BadRequestError) {
        throw new DomainError(error.message, { status: 400 });
      }
      throw error;
    }

    return listChallengeAccessEvents({ challengeId: params.id, page, limit });
  },
);
