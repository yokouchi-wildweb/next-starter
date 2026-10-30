// src/app/(user)/demo/check-env/api/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/wiring/apiRoute";
import { buildEnvSummary, createEmptySummary } from "./envSummary";

export const GET = createApiRoute(
  {
    operation: "GET /demo/check-env/api",
    operationType: "read",
    // 管理者だけ: 環境変数とサービスアカウントの要約を返すため(L1.19。/demo 自体も featureGate proxy が既定で遮断する)
    access: { roleCategories: ["admin"] },
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
