// src/app/api/demo/seamless-av/manifest/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { parseReelManifest } from "@/lib/seamlessVideo/manifest";
import { normalizeManifestKey, saveManifest } from "@/lib/seamlessVideo/server/reelManifestStore";

/**
 * 連結リールのマニフェストを保存する(実機テスト用の共有)。認証必須。
 * クエリ ?key=<英数_-> で任意キーに保存(省略時は最新スロット）。
 */
export const POST = createApiRoute(
  {
    operation: "POST /api/demo/seamless-av/manifest",
    operationType: "write",
    access: "authenticated",
  },
  async (req) => {
    const key = normalizeManifestKey(req.nextUrl.searchParams.get("key"));
    if (key == null) {
      return new NextResponse("Bad Request: invalid key", { status: 400 });
    }
    const body = await req.json();
    const manifest = parseReelManifest(body);
    if (!manifest) {
      return new NextResponse("Bad Request: invalid manifest", { status: 400 });
    }
    await saveManifest(manifest, key);
    return { success: true };
  },
);
