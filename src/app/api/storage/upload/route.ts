// src/app/api/storage/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { storageService } from "@/lib/storage/server/storageService";
import type { UploadResult } from "@/lib/storage/types";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const basePath = formData.get("basePath");
    const file = formData.get("file");
    if (typeof basePath !== "string" || !(file instanceof File)) {
      return new NextResponse("Bad Request", { status: 400 });
    }
    const result = await storageService.upload(basePath, file);
    return NextResponse.json<UploadResult>(result);
  } catch (error) {
    console.error("POST /api/storage/upload failed:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
