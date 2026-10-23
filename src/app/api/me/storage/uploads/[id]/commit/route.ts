// src/app/api/me/storage/uploads/[id]/commit/route.ts
//
// アップロードの完了を確定する。HEAD で size・申告 MIME・generation を照合して ready にし、ref を返す
// （ファイルの中身は検査しない）。再送・並行実行には同じ ref を返す。

import { parseObjectId, storageObjectService } from "@/features/core/storageObject/services/server";
import { createMeRoute } from "@/lib/routeFactory";

export const POST = createMeRoute<{ id: string }>(
  {
    operation: "POST /api/me/storage/uploads/[id]/commit",
    operationType: "write",
  },
  async (_req, { params, user }) => storageObjectService.commit(user, parseObjectId(params.id)),
);
