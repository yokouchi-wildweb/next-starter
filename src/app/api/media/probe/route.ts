// src/app/api/media/probe/route.ts
//
// サーバーサイド メディア解析（probe）の内部 API アダプタ。
// 共有ライブラリ関数 probeMedia() の薄いラッパ。別ランタイム/クライアントからの事前検証用。
// 管理ツール用途のため admin 限定（access: "custom" + requireAdmin の自前ガード）。

import { NextResponse } from "next/server";

import { requireAdmin } from "@/features/core/auth/services/server/requireRole";
import { probeMedia } from "@/lib/mediaProbe";
import type { MediaRef, ProbeErrorCode } from "@/lib/mediaProbe";
import { createApiRoute } from "@/lib/routeFactory";

/** リクエストボディから MediaRef を取り出す。 */
function parseRef(body: unknown): MediaRef | null {
  if (!body || typeof body !== "object") return null;
  const obj = body as Record<string, unknown>;
  if (typeof obj.storagePath === "string" && obj.storagePath.trim() !== "") {
    return { storagePath: obj.storagePath };
  }
  if (typeof obj.downloadUrl === "string" && obj.downloadUrl.trim() !== "") {
    return { downloadUrl: obj.downloadUrl };
  }
  return null;
}

/** probe の失敗コード → HTTP ステータス。 */
const ERROR_STATUS: Record<ProbeErrorCode, number> = {
  fetch_failed: 404,
  unsupported_container: 415,
  probe_failed: 422,
  timeout: 504,
};

export const POST = createApiRoute(
  {
    operation: "POST /api/media/probe",
    operationType: "read",
    access: "custom", // ハンドラ内で requireAdmin により認可
  },
  async (req) => {
    await requireAdmin();

    const body = await req.json().catch(() => null);
    const ref = parseRef(body);
    if (!ref) {
      return NextResponse.json(
        { message: "storagePath または downloadUrl を指定してください。" },
        { status: 400 },
      );
    }

    const result = await probeMedia(ref);
    if (!result.ok) {
      return NextResponse.json(
        { message: result.error.message, code: result.error.code },
        { status: ERROR_STATUS[result.error.code] },
      );
    }

    return NextResponse.json(result);
  },
);
