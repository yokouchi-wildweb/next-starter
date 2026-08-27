// src/app/api/admin/device-fingerprint/similar/route.ts
//
// 管理者向け: デバイスフィンガープリント類似ユーザー照会。
// userId 指定 = 成分一致スコアによる類似検索 / compositeHash 指定 = 完全一致検索。
// 結果は「参考証拠」であり単独での断定材料にしないこと
// (詳細: src/features/core/deviceFingerprint/README.md の脅威モデル)。
// ダッシュボード画面は downstream 所有 (同 README のレシピ参照)。

import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { DomainError } from "@/lib/errors";
import {
  findUsersByExactFingerprint,
  findUsersBySimilarFingerprint,
} from "@/features/core/deviceFingerprint/services/server";

const BodySchema = z.union([
  z.object({
    userId: z.string().uuid(),
    minScore: z.number().int().min(1).max(15).optional(),
    limit: z.number().int().min(1).max(200).optional(),
    excludeDemo: z.boolean().optional(),
  }),
  z.object({
    compositeHash: z.string().min(1).max(128),
    excludeUserId: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(200).optional(),
  }),
]);

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/device-fingerprint/similar",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new DomainError("リクエストの形式が不正です", { status: 400 });
    }

    if ("userId" in parsed.data) {
      const { userId, ...options } = parsed.data;
      const results = await findUsersBySimilarFingerprint(userId, options);
      return { mode: "similar", results };
    }

    const { compositeHash, ...options } = parsed.data;
    const results = await findUsersByExactFingerprint(compositeHash, options);
    return { mode: "exact", results };
  },
);
