// src/features/core/pairedDevice/services/server/session/principalGuard.ts
//
// 「登録端末、またはルールに合うログインユーザー」を通すページ側のガード。
// API の createDeviceRoute（kinds + orUser）と同じ語彙で、共有タブレットとスタッフ本人のスマホの
// 両方から開くページ（店舗のスタッフ画面・POS 等）を layout + loader で書けるようにする。
//
// 判定の順: 端末（kinds に合う）→ ユーザー（orUser のルール）→ どちらでもなければ redirect / 404。
// 端末用だけなら deviceGuard、ユーザー用だけならページの守り（guard.ts の createLoader）を使う。

import { cache } from "react";
import { notFound, redirect } from "next/navigation";

import type { SessionUser } from "@/features/core/auth/entities/session";
import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";
import {
  matchesPrincipalUserRule,
  type PrincipalUserRule,
} from "@/features/core/pairedDevice/utils/principalUserRule";
import type { PairedDeviceKind } from "@/features/core/pairedDevice/types/kinds";

import type { SessionDeviceOf } from "./deviceGuard";
import { getSessionDevice } from "./getSessionDevice";

export type SessionPrincipal<K extends PairedDeviceKind> =
  | { principal: "device"; device: SessionDeviceOf<K>; user: null }
  | { principal: "user"; device: null; user: SessionUser };

type PrincipalRule<K extends PairedDeviceKind> = {
  /** 通す端末の種類。省略時は登録済みのすべての種類 */
  kinds?: readonly K[];
  /** 端末でない場合に通すユーザーのルール（必須。端末だけなら deviceGuard を使う） */
  orUser: PrincipalUserRule;
};

async function resolvePrincipal<K extends PairedDeviceKind>(
  rule: PrincipalRule<K>,
): Promise<SessionPrincipal<K> | null> {
  const device = await getSessionDevice();
  if (device && (!rule.kinds || rule.kinds.includes(device.kind as K))) {
    return { principal: "device", device: device as SessionDeviceOf<K>, user: null };
  }
  const user = await getSessionUser();
  if (user && matchesPrincipalUserRule(user, rule.orUser)) {
    return { principal: "user", device: null, user };
  }
  return null;
}

// 同一リクエスト内で layout と loader が同じルールで呼んでも 1 回に圧縮する（ルールは JSON で比較）
const resolvePrincipalCached = cache((ruleKey: string) =>
  resolvePrincipal(JSON.parse(ruleKey) as PrincipalRule<PairedDeviceKind>),
);

const ruleKeyOf = (rule: PrincipalRule<PairedDeviceKind>): string =>
  JSON.stringify({ kinds: rule.kinds ?? null, orUser: rule.orUser });

/**
 * layout 用のガード。登録端末か、orUser のルールに合うログインユーザーだけを通す。
 *
 * @example
 *   // src/app/store/(protected)/layout.tsx
 *   await principalGuard({
 *     kinds: ["staff_tablet"],
 *     orUser: { roles: ["staff"] },
 *     redirectTo: "/store/login",
 *   });
 */
export async function principalGuard<K extends PairedDeviceKind = PairedDeviceKind>(
  options: PrincipalRule<K> & {
    /** どちらでもなかったときの遷移先。省略時は 404 */
    redirectTo?: string;
  },
): Promise<SessionPrincipal<K>> {
  const principal = (await resolvePrincipalCached(
    ruleKeyOf(options as PrincipalRule<PairedDeviceKind>),
  )) as SessionPrincipal<K> | null;
  if (principal) return principal;
  if (options.redirectTo) redirect(options.redirectTo);
  notFound();
}

/**
 * loader 用。端末かユーザーを返す（ctx.principal で分岐する）。
 * principalGuard を置いた layout の配下では、ルールと redirectTo を layout と同じにする。
 */
export async function requireCurrentPrincipal<K extends PairedDeviceKind = PairedDeviceKind>(
  options: PrincipalRule<K> &
    (
      | { behavior: "redirect"; redirectTo: string }
      | { behavior: "notFound" }
      | { behavior?: "throw"; message?: string }
    ),
): Promise<SessionPrincipal<K>> {
  const principal = (await resolvePrincipalCached(
    ruleKeyOf(options as PrincipalRule<PairedDeviceKind>),
  )) as SessionPrincipal<K> | null;
  if (principal) return principal;
  if (options.behavior === "redirect") redirect(options.redirectTo);
  if (options.behavior === "notFound") notFound();
  throw new Error(
    "message" in options && options.message ? options.message : "端末かユーザーの認証が必要です",
  );
}
