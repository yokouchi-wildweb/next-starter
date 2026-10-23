// src/app/api/me/storage/uploads/[id]/route.ts
//
// 本人の未採用ファイル（pending / 業務行に紐付いていない ready）を取り消す。再送しても安全。

import { parseObjectId, storageObjectService } from "@/features/core/storageObject/services/server";
import { createMeRoute } from "@/lib/routeFactory";

export const DELETE = createMeRoute<{ id: string }>(
  {
    operation: "DELETE /api/me/storage/uploads/[id]",
    operationType: "write",
  },
  async (_req, { params, user }) => storageObjectService.discard(user, parseObjectId(params.id)),
);
