// src/app/api/me/storage/uploads/route.ts
//
// ファイルのアップロード権を発行する（本人の操作）。用途の upload 規則で判定し、台帳に pending の行を作る。

import { parseIssueUploadInput, storageObjectService } from "@/features/core/storageObject/services/server";
import { createMeRoute } from "@/wiring/apiRoute";

export const POST = createMeRoute(
  {
    operation: "POST /api/me/storage/uploads",
    operationType: "write",
    rateLimit: "storageIssue",
  },
  async (req, { user }) => {
    const input = await parseIssueUploadInput(req);
    return storageObjectService.issue(user, { ...input, origin: req.headers.get("origin") });
  },
);
