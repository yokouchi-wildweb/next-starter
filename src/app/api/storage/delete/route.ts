// src/app/api/storage/delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { storageService } from "@/lib/storage/server/storageService";

export async function POST(req: NextRequest) {
  try {
    const { pathOrUrl } = await req.json();
    if (typeof pathOrUrl !== "string") {
      return new NextResponse("Bad Request", { status: 400 });
    }
    await storageService.remove(pathOrUrl);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/storage/delete failed:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
