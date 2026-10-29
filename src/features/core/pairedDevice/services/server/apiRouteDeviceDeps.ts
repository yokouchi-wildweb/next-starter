// src/features/core/pairedDevice/services/server/apiRouteDeviceDeps.ts
//
// API ルートの Factory（lib/routeFactory の createDeviceRoute）に差し込む登録端末の束。端末の持ち主がここで 1 つだけ出す。
// 結ぶのは src/wiring/apiRoute.ts。

import type { RouteDeviceDeps } from "@/lib/routeFactory";

import type { AuthenticatedDevice } from "./deviceToken";
import { checkPairedDeviceRateLimit, pairedDeviceErrorResponse } from "./http";
import { authenticateRequestDevice, syncPairedDeviceCookie } from "./session";

export const apiRouteDeviceDeps: RouteDeviceDeps<AuthenticatedDevice> = {
  authenticateRequestDevice,
  syncPairedDeviceCookie,
  checkPairedDeviceRateLimit,
  pairedDeviceErrorResponse,
};
