// src/app/api/admin/fingerprint-challenges/[id]/route.ts
//
// 管理者向け: チャレンジの状態遷移 (レビュー / 取り下げ)。
// 汎用 update ではなく専用アクションで遷移させる (reviewed_by / reviewed_at の
// 自動設定と、submitted → reviewed / pending → canceled の遷移制約を保証するため)。

import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { DomainError } from "@/lib/errors";
import {
  cancelChallenge,
  reviewChallenge,
} from "@/features/core/fingerprintChallenge/services/server";

type Params = { id: string };

const PatchSchema = z.object({
  action: z.enum(["review", "cancel"]),
  note: z.string().max(4000).nullable().optional(),
});

export const PATCH = createApiRoute<Params>(
  {
    operation: "PATCH /api/admin/fingerprint-challenges/[id]",
    operationType: "write",
    access: { roleCategories: ["admin"] },
  },
  async (req, { params, session }) => {
    const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new DomainError("リクエストの形式が不正です", { status: 400 });
    }
    const actorId = session?.userId;
    if (!actorId) {
      throw new DomainError("セッションが不正です", { status: 401 });
    }

    const challenge =
      parsed.data.action === "review"
        ? await reviewChallenge({
            challengeId: params.id,
            reviewedBy: actorId,
            note: parsed.data.note ?? null,
          })
        : await cancelChallenge({
            challengeId: params.id,
            canceledBy: actorId,
            note: parsed.data.note ?? null,
          });

    return { challenge };
  },
);
