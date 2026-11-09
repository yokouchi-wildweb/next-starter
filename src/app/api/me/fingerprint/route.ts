// src/app/api/me/fingerprint/route.ts
//
// 全ページ設置型フィンガープリント収集の ingest。
// クライアントは useFingerprintReport (fire-and-forget) から 1 日 1 回送信する。
// 門番の規則 deviceFingerprint(既定は閉)が閉じていれば proxy が 404 を返す(ここまで届かない)。

import { createMeRoute } from "@/wiring/apiRoute";
import { recordDeviceFingerprint } from "@/features/core/deviceFingerprint/services/server";

export const POST = createMeRoute(
  {
    operation: "POST /api/me/fingerprint",
    operationType: "write",
  },
  async (req, { user }) => {
    const payload = await req.json().catch(() => null);
    const fingerprint = await recordDeviceFingerprint({
      userId: user.userId,
      source: "page",
      payload,
    });

    return { success: true, fingerprintId: fingerprint.id };
  },
);
