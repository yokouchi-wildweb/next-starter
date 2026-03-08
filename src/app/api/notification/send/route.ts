// src/app/api/notification/send/route.ts
// お知らせ送信（admin専用、唯一の作成経路）

import { z } from "zod";
import { createApiRoute } from "@/lib/routeFactory";
import { DomainError } from "@/lib/errors";
import { getRoleCategory } from "@/features/core/user/constants";
import { notificationService } from "@/features/core/notification/services/server/notificationService";

const SendSchema = z.object({
  title: z.string().trim().nullish(),
  body: z.string().trim().min(1, { message: "本文は必須です。" }),
  image: z.string().trim().nullish(),
  targetType: z.enum(["all", "role", "individual"]),
  targetUserIds: z.array(z.string().uuid()).nullish(),
  targetRoles: z.array(z.string()).nullish(),
  publishedAt: z.string().datetime().nullish(),
});

export const POST = createApiRoute(
  {
    operation: "POST /api/notification/send",
    operationType: "write",
  },
  async (req, { session }) => {
    if (!session || getRoleCategory(session.role) !== "admin") {
      throw new DomainError("この操作を行う権限がありません。", { status: 403 });
    }

    const json = await req.json();
    const parsed = SendSchema.safeParse(json);
    if (!parsed.success) {
      throw new DomainError(
        parsed.error.errors[0]?.message ?? "入力値が不正です。",
        { status: 400 }
      );
    }

    const { data } = parsed;

    return notificationService.sendDirect({
      title: data.title ?? null,
      body: data.body,
      image: data.image ?? null,
      targetType: data.targetType,
      targetUserIds: data.targetUserIds ?? null,
      targetRoles: data.targetRoles ?? null,
      senderType: "admin",
      createdById: session.userId,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
    });
  }
);
