// src/lib/routeFactory/noDevice.ts
//
// 「端末なし」の束: 点 routeFactoryDevice が空(端末を差すドメインが無い・閉じて門番が外した)ときの lib の既定(D53)。
// 端末を認証しないので、端末だけのルートは端末として通らず 401 で失敗し(素通りしない)、orUser のルートは利用者の枝だけが動く。
// 認証しない以上ほかの 3 つは呼ばれない(呼ばれても何もしない)。テスト: ./noDevice.test.mts

import type { RouteAuthenticatedDevice, RouteDeviceDeps } from "./deps";

export function noDeviceDeps<TAuthenticated extends RouteAuthenticatedDevice, TCategory extends string>(): RouteDeviceDeps<TAuthenticated, TCategory> {
  return {
    authenticateRequestDevice: async () => null,
    syncPairedDeviceCookie: (response) => response,
    checkPairedDeviceRateLimit: async () => null,
    pairedDeviceErrorResponse: () => null,
  };
}
