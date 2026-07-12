// src/app/api/debug/ping/route.ts
//
// デバッグ用の疎通確認 API（雛形）。
// ADMIN_OR_DEBUGGER_RULE により admin カテゴリ or debugger ロールのみアクセスできる
// （認可は createApiRoute が強制する。未認証→401 / 権限不足→403）。
// デバッグ用 API を追加する際はこのファイルをコピー元にする。

import { NextResponse } from "next/server";

import { ADMIN_OR_DEBUGGER_RULE } from "@/config/app/domain-api-access.config";
import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";
import { createApiRoute } from "@/lib/routeFactory";

export const GET = createApiRoute(
  {
    operation: "GET /api/debug/ping",
    operationType: "read",
    access: ADMIN_OR_DEBUGGER_RULE,
  },
  async () => {
    // 認可は factory で強制済み。ここでは確認表示用に DB 同期済みユーザーを返すだけ
    const user = await getSessionUser();

    return NextResponse.json(
      {
        ok: true,
        userId: user?.userId,
        role: user?.role,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  },
);
