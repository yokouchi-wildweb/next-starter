// src/app/api/admin/user/[userId]/hard-delete/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/wiring/apiRoute";
import { userService } from "@/features/core/user/services/server/userService";

const HardDeletePayloadSchema = z.object({
  reason: z.string().max(500).optional(),
});

type RouteParams = { userId: string };

export const DELETE = createApiRoute<RouteParams>(
  {
    operation: "DELETE /api/admin/user/[userId]/hard-delete",
    operationType: "write",
    access: { roleCategories: ["admin"] },
    skipForDemo: false,
  },
  async (req, { params }) => {
    const { userId } = await params;

    const json = await req.json().catch(() => ({}));
    const parsed = HardDeletePayloadSchema.safeParse(json);

    if (!parsed.success) {
      const errorMessage = parsed.error.errors[0]?.message ?? "入力値が不正です。";
      return NextResponse.json({ message: errorMessage }, { status: 400 });
    }

    await userService.hardDelete({
      userId,
      reason: parsed.data.reason,
    });

    return new NextResponse(null, { status: 204 });
  },
);
