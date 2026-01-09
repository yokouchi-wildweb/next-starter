// src/app/api/admin/user/[userId]/status/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { userService } from "@/features/core/user/services/server/userService";
import { USER_STATUSES } from "@/features/core/user/constants/status";

const ChangeStatusPayloadSchema = z.object({
  status: z.enum(USER_STATUSES),
  reason: z.string().max(500).optional(),
});

type RouteParams = { userId: string };

export const PATCH = createApiRoute<RouteParams>(
  {
    operation: "PATCH /api/admin/user/[userId]/status",
    operationType: "write",
    skipForDemo: false,
  },
  async (req, { session, params }) => {
    if (!session || session.role !== "admin") {
      return NextResponse.json({ message: "この操作を行う権限がありません。" }, { status: 403 });
    }

    const { userId } = await params;

    const json = await req.json();
    const parsed = ChangeStatusPayloadSchema.safeParse(json);

    if (!parsed.success) {
      const errorMessage = parsed.error.errors[0]?.message ?? "入力値が不正です。";
      return NextResponse.json({ message: errorMessage }, { status: 400 });
    }

    const user = await userService.changeStatus({
      userId,
      newStatus: parsed.data.status,
      actorId: session.userId,
      reason: parsed.data.reason,
    });

    return NextResponse.json(user);
  },
);
