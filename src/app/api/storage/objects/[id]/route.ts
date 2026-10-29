// src/app/api/storage/objects/[id]/route.ts
//
// GET: 非公開ファイルの固定 URL。用途の read（allow AND check）を都度判定し、照合済みの世代の
//      短期署名 URL へ 302 する。認可は用途ごとに違うため factory では "public" とし、
//      判定は storageObjectService.resolveRead が行う（未登録・規則なしは 404 = fail-closed）。
//      302 と失敗応答は private, no-store + Vary。失敗応答に Location は付けない。
//      判定中の例外（DB・判定先の障害）でも署名 URL は返さない。
// DELETE: 用途の delete 規則で、業務行に紐付いていないファイルを削除する（規則が無い用途は削除不可）。

import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";
import { requireAuthenticated } from "@/features/core/auth/services/server/requireRole";
import {
  parseObjectId,
  readFailureResponse,
  readResolutionResponse,
  storageObjectService,
} from "@/features/core/storageObject/services/server";
import { isDomainError } from "@/lib/errors";
import { createApiRoute } from "@/wiring/apiRoute";

export const GET = createApiRoute<{ id: string }>(
  {
    operation: "GET /api/storage/objects/[id]",
    operationType: "read",
    access: "public",
  },
  async (_req, { params }) => {
    try {
      const resolution = await storageObjectService.resolveRead(parseObjectId(params.id), {
        loadUser: getSessionUser,
      });
      return readResolutionResponse(resolution);
    } catch (error) {
      if (isDomainError(error) && error.status === 404) {
        return readResolutionResponse({ kind: "not_found" });
      }
      console.error("GET /api/storage/objects/[id] failed:", error);
      return readFailureResponse();
    }
  },
);

export const DELETE = createApiRoute<{ id: string }>(
  {
    operation: "DELETE /api/storage/objects/[id]",
    operationType: "write",
    access: "authenticated",
  },
  async (_req, { params }) => {
    // ロールの判定は DB と同期したセッションで行う（ctx.session は token のみ）
    const user = await requireAuthenticated();
    return storageObjectService.remove(user, parseObjectId(params.id));
  },
);
