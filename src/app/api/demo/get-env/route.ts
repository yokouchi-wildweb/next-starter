import { NextResponse } from "next/server";

import { buildEnvSummary, createEmptySummary } from "./envSummary";

export async function GET(): Promise<Response> {
  try {
    const result = buildEnvSummary();
    return NextResponse.json(result);
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
}
