// src/app/api/demo/seamless-av/manifest/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { parseReelManifest } from "@/lib/seamlessVideo/manifest";
import { saveLatestManifest } from "@/lib/seamlessVideo/server/reelManifestStore";

/** 連結リールの最新マニフェストを固定キーに保存する(実機テスト用の共有)。認証必須。 */
export const POST = createApiRoute(
  {
    operation: "POST /api/demo/seamless-av/manifest",
    operationType: "write",
    access: "authenticated",
  },
  async (req) => {
    const body = await req.json();
    const manifest = parseReelManifest(body);
    if (!manifest) {
      return new NextResponse("Bad Request: invalid manifest", { status: 400 });
    }
    await saveLatestManifest(manifest);
    return { success: true };
  },
);
