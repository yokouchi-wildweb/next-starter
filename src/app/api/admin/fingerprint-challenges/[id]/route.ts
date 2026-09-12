// src/app/api/admin/fingerprint-challenges/[id]/route.ts
//
// 管理者向け: チャレンジの状態遷移 (レビュー / 取り下げ) と通知スタンプ。
// 汎用 update ではなく専用アクションで遷移させる (reviewed_by / reviewed_at の
// 自動設定と、submitted → reviewed / pending → canceled の遷移制約を保証するため)。
// mark_notified は状態遷移ではなく「本人へ案内を送った」記録 (notified_at 初回のみ +
// notified_channels 和集合 + 監査 fingerprint.challenge.notified 毎回)。

import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { DomainError } from "@/lib/errors";
import { MarkChallengeNotifiedSchema } from "@/features/core/fingerprintChallenge/entities/schema";
import {
  cancelChallenge,
  markChallengeNotified,
  reviewChallenge,
} from "@/features/core/fingerprintChallenge/services/server";

type Params = { id: string };

const PatchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("review"),
    note: z.string().max(4000).nullable().optional(),
  }),
  z.object({
    action: z.literal("cancel"),
    note: z.string().max(4000).nullable().optional(),
  }),
  MarkChallengeNotifiedSchema.extend({ action: z.literal("mark_notified") }),
]);

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

    const input = parsed.data;
    switch (input.action) {
      case "review": {
        const challenge = await reviewChallenge({
          challengeId: params.id,
          reviewedBy: actorId,
          note: input.note ?? null,
        });
        return { challenge };
      }
      case "cancel": {
        const challenge = await cancelChallenge({
          challengeId: params.id,
          canceledBy: actorId,
          note: input.note ?? null,
        });
        return { challenge };
      }
      case "mark_notified": {
        const challenge = await markChallengeNotified({
          challengeId: params.id,
          notifiedBy: actorId,
          channels: input.channels,
          notifiedAt: input.notifiedAt,
          note: input.note ?? null,
        });
        return { challenge };
      }
    }
  },
);
