// src/domains/core/pairedDevice/plugs/routeFactoryDevice/pairedDevice.ts
//
// 点 routeFactoryDevice(API ルートの Factory の登録端末、0〜1 個、宣言 src/lib/routeFactory/extensionPoints.ts)に差す登録端末の束。
// pairedDevice は閉じられるドメイン: 閉じている間は門番(gate.plugs)が項目を外し、Factory は lib の「端末なし」で動く(D53)。
// 端末の種類 → ハンドラに渡す端末の型は値を持たない型だけの欄 types で一覧へ運ぶ(src/wiring/apiRoute.ts が取り出す)

import type { RateLimitCategory } from "@/domains/rateLimit/config";

import type { SessionDevice } from "../../entities/model";
import type { AuthenticatedDevice } from "../../services/server/deviceToken";
import { checkPairedDeviceRateLimit, pairedDeviceErrorResponse } from "../../services/server/http";
import { authenticateRequestDevice, syncPairedDeviceCookie, type SessionDeviceOf } from "../../services/server/session";
import type { PairedDeviceKind } from "../../types/kinds";
import type { RouteDevicePlug } from "@/lib/routeFactory/points";

/** 端末の種類 → ハンドラに渡す端末の型 */
type DevicesByKind = { [K in PairedDeviceKind]: SessionDeviceOf<K> };

export const plug: RouteDevicePlug<AuthenticatedDevice, RateLimitCategory, DevicesByKind, SessionDevice> = {
  deps: {
    authenticateRequestDevice,
    syncPairedDeviceCookie,
    checkPairedDeviceRateLimit,
    pairedDeviceErrorResponse,
  },
};
