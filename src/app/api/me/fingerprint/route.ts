// src/app/api/me/fingerprint/route.ts
//
// 全ページ設置型フィンガープリント収集の ingest。
// クライアントは useFingerprintReport (fire-and-forget) から 1 日 1 回送信する。
// deviceFingerprintConfig.collection.enabled が false の環境では 404 (fail-closed)。

import { createMeRoute } from "@/wiring/apiRoute";
import { DomainError } from "@/lib/errors";
import { deviceFingerprintConfig } from "@/features/deviceFingerprint/config";
import { recordDeviceFingerprint } from "@/features/core/deviceFingerprint/services/server";

export const POST = createMeRoute(
  {
    operation: "POST /api/me/fingerprint",
    operationType: "write",
  },
  async (req, { user }) => {
    if (!deviceFingerprintConfig.collection.enabled) {
      throw new DomainError("Not Found", { status: 404 });
    }

    const payload = await req.json().catch(() => null);
    const fingerprint = await recordDeviceFingerprint({
      userId: user.userId,
      source: "page",
      payload,
    });

    return { success: true, fingerprintId: fingerprint.id };
  },
);
