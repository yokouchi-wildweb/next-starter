// src/features/core/pairedDevice/services/server/session/deviceGuard.ts
//
// ページ側のガード。layout では deviceGuard、loader では requireCurrentDevice を使う
// （ページの守り guard.ts の端末版）。

import { notFound, redirect } from "next/navigation";

import type { SessionDevice } from "@/features/core/pairedDevice/entities/model";
import type { PairedDeviceKind, PairedDeviceScopeOf } from "@/registry/pairedDeviceKindRegistry";

import { getSessionDevice } from "./getSessionDevice";

/** kinds で絞ったときの端末の型（kind ごとに scope の型が付く） */
export type SessionDeviceOf<K extends string> = [K] extends [never]
  ? SessionDevice
  : K extends PairedDeviceKind
    ? SessionDevice<K, PairedDeviceScopeOf<K>>
    : SessionDevice<K>;

type DeviceGuardOptions<K extends PairedDeviceKind> = {
  /** 通す端末の種類。省略時は登録済みのすべての種類 */
  kinds?: readonly K[];
  /**
   * 端末として認証できなかったときの遷移先（例: ペアリング画面）。
   * 省略時は 404（端末向けページの存在を明かさない）
   */
  redirectTo?: string;
};

const matchesKinds = (device: SessionDevice, kinds: readonly string[] | undefined): boolean =>
  !kinds || kinds.includes(device.kind);

/**
 * layout 用のガード。登録端末からのアクセスだけを通す。
 *
 * @example
 *   // src/app/terminal/layout.tsx
 *   await deviceGuard({ kinds: ["table_terminal"], redirectTo: "/device-pair" });
 */
export async function deviceGuard<K extends PairedDeviceKind = PairedDeviceKind>(
  options: DeviceGuardOptions<K> = {},
): Promise<SessionDeviceOf<K>> {
  const device = await getSessionDevice();
  if (device && matchesKinds(device, options.kinds)) {
    return device as SessionDeviceOf<K>;
  }
  if (options.redirectTo) redirect(options.redirectTo);
  notFound();
}

type RequireCurrentDeviceOptions<K extends PairedDeviceKind> = {
  kinds?: readonly K[];
} & (
  | { behavior: "redirect"; redirectTo: string }
  | { behavior: "notFound" }
  | { behavior?: "throw"; message?: string }
);

/**
 * loader 用。認証済みの端末を返す。kind が合わない場合も認証できなかったものとして扱う。
 * deviceGuard を置いた layout の配下では、redirectTo を layout と同じ値にする。
 */
export async function requireCurrentDevice<K extends PairedDeviceKind = PairedDeviceKind>(
  options: RequireCurrentDeviceOptions<K> = {},
): Promise<SessionDeviceOf<K>> {
  const device = await getSessionDevice();
  if (device && matchesKinds(device, options.kinds)) {
    return device as SessionDeviceOf<K>;
  }
  if (options.behavior === "redirect") redirect(options.redirectTo);
  if (options.behavior === "notFound") notFound();
  throw new Error(
    "message" in options && options.message ? options.message : "端末の認証が必要です",
  );
}
