// src/app/api/storage/upload/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { storageService } from "@/lib/storage/server/storageService";
import type { UploadResult } from "@/lib/storage/types";

// 暫定で管理者専用（応急封鎖）。旧設定 "authenticated" では、ログインユーザーなら誰でも
// 任意パスへの書き込み・任意オブジェクトの削除ができた（保存先・所有者の検証が無い）。
// 一般ユーザーのアップロードの権限設計は再設計中: council 20261022-121853-storage-authority-policy-redesign
export const POST = createApiRoute(
  {
    operation: "POST /api/storage/upload",
    operationType: "write",
    access: { roleCategories: ["admin"] },
    skipForDemo: true,
  },
  async (req) => {
    const formData = await req.formData();
    const basePath = formData.get("basePath");
    const file = formData.get("file");

    if (typeof basePath !== "string" || !(file instanceof File)) {
      return new NextResponse("Bad Request", { status: 400 });
    }

    const result = await storageService.upload(basePath, file);
    return NextResponse.json<UploadResult>(result);
  },
);
