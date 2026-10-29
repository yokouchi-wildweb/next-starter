// src/app/api/storage/purposes/[purpose]/route.ts
//
// GET: 用途の方針（metadata: strip / keep）を返す。端末はこれで HEIC などを JPEG に変えるかと、
//      写真選択の accept を受け付ける画像の型に狭めるかを決める（呼び出し側に strip / keep の指定を課さない）。
//      誰が聞いても同じ答えなので /api/me/ には置かない。アップロードはログイン必須なので authenticated。
//      未登録は 404（fail-closed）。用途表はデプロイ単位でしか変わらないので、端末に短時間キャッシュさせる。

import { NextResponse } from "next/server";

import { storageObjectService } from "@/features/core/storageObject/services/server";
import { createApiRoute } from "@/wiring/apiRoute";

export const GET = createApiRoute<{ purpose: string }>(
  {
    operation: "GET /api/storage/purposes/[purpose]",
    operationType: "read",
    access: "authenticated",
  },
  async (_req, { params }) => {
    const policy = storageObjectService.describePurpose(params.purpose);
    return NextResponse.json(policy, { headers: { "Cache-Control": "private, max-age=300" } });
  },
);
