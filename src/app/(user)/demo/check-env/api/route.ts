// src/app/(user)/demo/check-env/api/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { buildEnvSummary, createEmptySummary } from "./envSummary";

export const GET = createApiRoute(
  {
    operation: "GET /demo/check-env/api",
    operationType: "read",
    // 公開: /demo 配下のデモツール（本番では featureGate proxy が遮断する）
    access: "public",
  },
  async () => {
    try {
      const result = buildEnvSummary();
      return result;
    } catch (error) {
      const fallbackError = error instanceof Error ? error.message : String(error);
      return NextResponse.json({
        data: createEmptySummary(),
        errors: [
          {
            section: "api",
            message: "環境変数の収集中に予期せぬエラーが発生しました。",
            detail: fallbackError,
          },
        ],
      });
    }
  },
);
