// src/app/api/storage/delete/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { storageService } from "@/lib/storage/server/storageService";

// 暫定で管理者専用（応急封鎖）。旧設定 "authenticated" では、ログインユーザーなら誰でも
// 任意パスへの書き込み・任意オブジェクトの削除ができた（保存先・所有者の検証が無い）。
// 一般ユーザーのアップロードの権限設計は再設計中: council 20261022-121853-storage-authority-policy-redesign
export const POST = createApiRoute(
  {
    operation: "POST /api/storage/delete",
    operationType: "write",
    access: { roleCategories: ["admin"] },
    skipForDemo: true,
  },
  async (req) => {
    const { pathOrUrl } = await req.json();

    if (typeof pathOrUrl !== "string") {
      return new NextResponse("Bad Request", { status: 400 });
    }

    await storageService.remove(pathOrUrl);
    return { success: true };
  },
);
