// src/app/api/admin/user/[userId]/delete/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { userService } from "@/features/core/user/services/server/userService";

const DeletePayloadSchema = z.object({
  reason: z.string().max(500).optional(),
});

type RouteParams = { userId: string };

export const POST = createApiRoute<RouteParams>(
  {
    operation: "POST /api/admin/user/[userId]/delete",
    operationType: "write",
    skipForDemo: false,
  },
  async (req, { session, params }) => {
    if (!session || getRoleCategory(session.role) !== "admin") {
      return NextResponse.json({ message: "この操作を行う権限がありません。" }, { status: 403 });
    }

    const { userId } = await params;

    const json = await req.json().catch(() => ({}));
    const parsed = DeletePayloadSchema.safeParse(json);

    if (!parsed.success) {
      const errorMessage = parsed.error.errors[0]?.message ?? "入力値が不正です。";
      return NextResponse.json({ message: errorMessage }, { status: 400 });
    }

    await userService.softDelete({
      userId,
      actorId: session.userId,
      reason: parsed.data.reason,
    });

    return NextResponse.json({ success: true });
  },
);
