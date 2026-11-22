// 生成物・編集不可: pnpm generate extensions が src/proxies/extensionPoints.ts から生成する
// proxyRedirects: 差す側の <ドメイン>/plugs/proxyRedirects/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const redirects(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { RedirectRuleGroup } from "@/proxies/points";

import { redirects as proxyRedirects_user_signupMode } from "@/domains/core/user/plugs/proxyRedirects/signupMode";

export const proxyRedirects: { domain: string | null; name: string; requires: readonly string[]; plug: RedirectRuleGroup }[] = [
  { domain: "user", name: "signupMode", requires: [], plug: proxyRedirects_user_signupMode },
];
