// src/app/api/debug/ping/route.ts
//
// デバッグ用の疎通確認 API（雛形）。
// ADMIN_OR_DEBUGGER_RULE により admin カテゴリ or debugger ロールのみアクセスできる
// （認可は createApiRoute が強制する。未認証→401 / 権限不足→403）。
// デバッグ用 API を追加する際はこのファイルをコピー元にする。

import { NextResponse } from "next/server";

import { ADMIN_OR_DEBUGGER_RULE } from "@/config/app/domain-api-access.config";
import { createApiRoute } from "@/wiring/apiRoute";

export const GET = createApiRoute(
  {
    operation: "GET /api/debug/ping",
    operationType: "read",
    access: ADMIN_OR_DEBUGGER_RULE,
  },
  async (_req, { user }) => {
    // 認可は factory で強制済み。ctx.user（Factory が DB 同期で解いた利用者）を確認表示用に返すだけ
    return NextResponse.json(
      {
        ok: true,
        userId: user.userId,
        role: user.role,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  },
);
