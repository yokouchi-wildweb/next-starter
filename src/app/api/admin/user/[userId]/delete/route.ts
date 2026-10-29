// src/app/api/admin/user/[userId]/delete/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/wiring/apiRoute";
import { userService } from "@/features/core/user/services/server/userService";

const DeletePayloadSchema = z.object({
  reason: z.string().max(500).optional(),
});

type RouteParams = { userId: string };

export const POST = createApiRoute<RouteParams>(
  {
    operation: "POST /api/admin/user/[userId]/delete",
    operationType: "write",
    access: { roleCategories: ["admin"] },
    skipForDemo: false,
  },
  async (req, { params }) => {
    const { userId } = await params;

    const json = await req.json().catch(() => ({}));
    const parsed = DeletePayloadSchema.safeParse(json);

    if (!parsed.success) {
      const errorMessage = parsed.error.errors[0]?.message ?? "入力値が不正です。";
      return NextResponse.json({ message: errorMessage }, { status: 400 });
    }

    await userService.softDelete({
      userId,
      reason: parsed.data.reason,
    });

    return NextResponse.json({ success: true });
  },
);
