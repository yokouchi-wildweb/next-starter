// src/app/api/me/profile/route.ts

import { createApiRoute } from "@/lib/routeFactory";
import { userService } from "@/features/core/user/services/server/userService";
import { DomainError } from "@/lib/errors";

export const PATCH = createApiRoute(
  {
    operation: "PATCH /api/me/profile",
    operationType: "write",
  },
  async (req, { session }) => {
    if (!session) {
      throw new DomainError("認証が必要です", { status: 401 });
    }

    const body = await req.json();

    // 名前のみを更新可能とする
    const updateData = {
      name: body.name,
    };

    const updatedUser = await userService.update(session.userId, updateData);
    return updatedUser;
  },
);
