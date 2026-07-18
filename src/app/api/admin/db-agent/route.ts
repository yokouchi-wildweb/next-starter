// src/app/api/admin/db-agent/route.ts
//
// 管理者向け DB調査エージェント (SSE ストリーミング)。
//
// POST body: { messages: AgentChatMessage[] } (クライアントが履歴を全量送る)
// レスポンス: text/event-stream (AgentEvent — 契約は @/lib/ai/agent/types.ts)
//
// 認可: admin ロールカテゴリのみ (createApiRoute が強制)。
// 監査: auditLogger をレコーダとして注入 (SQL 実行ごと + ターン usage)。
//   AuditContext は createApiRoute の ALS がストリーム消費まで伝播する
//   (ReadableStream の start はハンドラ内の構築時に発火するため)。

import { NextResponse } from "next/server";
import { z } from "zod";

import { auditLogger } from "@/features/core/auditLog/services/server";
import { createApiRoute } from "@/lib/routeFactory";
import { createAgentSSEResponse } from "@/lib/ai/agent/sse";
import { isDbAgentEnabled, runDbAgent } from "@/lib/dbAgent/service";

// Vercel 等のサーバーレス環境ではストリーミング中も関数実行時間にカウントされる。
// エージェントの1ターンは数分に及びうるため上限を引き上げる
// (Hobby プランは上限 60。プランに応じて調整すること)。
export const maxDuration = 300;

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(20_000),
      }),
    )
    .min(1)
    .max(50)
    .refine((messages) => messages[messages.length - 1].role === "user", {
      message: "最後のメッセージは user である必要があります",
    }),
});

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/db-agent",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    if (!isDbAgentEnabled()) {
      return NextResponse.json(
        {
          message:
            "DB調査エージェントは無効です。DATABASE_URL_READONLY を構成してください。",
        },
        { status: 503 },
      );
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { message: "リクエスト形式が不正です。" },
        { status: 400 },
      );
    }

    // クライアント切断 (fetch abort / タブクローズ) をエージェント実行へ伝播する
    const abortController = new AbortController();
    req.signal.addEventListener("abort", () => abortController.abort());

    const generator = runDbAgent({
      messages: parsed.data.messages,
      signal: abortController.signal,
      auditRecorder: auditLogger,
    });

    return createAgentSSEResponse(generator, { abortController });
  },
);
