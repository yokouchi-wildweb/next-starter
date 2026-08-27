// src/app/api/admin/device-fingerprint/compare/route.ts
//
// 管理者向け: 2 ユーザー間のフィンガープリント総当たり比較 (成分別一致の内訳)。
// similar で候補を出した後のドリルダウン調査用。

import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { DomainError } from "@/lib/errors";
import { compareUsersFingerprints } from "@/features/core/deviceFingerprint/services/server";

const BodySchema = z.object({
  userIdA: z.string().uuid(),
  userIdB: z.string().uuid(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/device-fingerprint/compare",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new DomainError("リクエストの形式が不正です", { status: 400 });
    }

    const { userIdA, userIdB, limit } = parsed.data;
    const pairs = await compareUsersFingerprints(userIdA, userIdB, { limit });
    return { pairs };
  },
);
