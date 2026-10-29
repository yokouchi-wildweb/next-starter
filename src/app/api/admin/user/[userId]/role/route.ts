// src/app/api/admin/user/[userId]/role/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/wiring/apiRoute";
import { userService } from "@/features/core/user/services/server/userService";
import { USER_ROLES } from "@/features/core/user/constants/role";

const ChangeRolePayloadSchema = z.object({
  role: z.enum(USER_ROLES),
  reason: z.string().max(500).optional(),
  deleteOldProfile: z.boolean().optional(),
});

type RouteParams = { userId: string };

export const PATCH = createApiRoute<RouteParams>(
  {
    operation: "PATCH /api/admin/user/[userId]/role",
    operationType: "write",
    access: { roleCategories: ["admin"] },
    skipForDemo: false,
  },
  async (req, { params }) => {
    const { userId } = await params;

    const json = await req.json();
    const parsed = ChangeRolePayloadSchema.safeParse(json);

    if (!parsed.success) {
      const errorMessage = parsed.error.errors[0]?.message ?? "入力値が不正です。";
      return NextResponse.json({ message: errorMessage }, { status: 400 });
    }

    const user = await userService.changeRole({
      userId,
      newRole: parsed.data.role,
      reason: parsed.data.reason,
      deleteOldProfile: parsed.data.deleteOldProfile,
    });

    return NextResponse.json(user);
  },
);
