// src/app/api/gacha/draw/route.ts
// ガチャを引くAPIエンドポイント
import { NextRequest, NextResponse } from "next/server";
import { gachaService } from "@/features/gacha/services/server/gachaService";

export async function POST(req: NextRequest) {
  try {
    // リクエストボディから抽選回数を取得（デフォルト5回）
    const { count } = await req.json();
    const n = typeof count === "number" ? count : 5;

    // サービスに抽選を依頼
    const cards = await gachaService.draw(n);
    return NextResponse.json(cards);

  } catch (error) {
    console.error("POST /api/gacha/draw failed:", error);
    // エラーレスポンスを返す
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
