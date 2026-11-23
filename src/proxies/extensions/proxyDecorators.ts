// 生成物・編集不可: pnpm generate extensions が src/proxies/extensionPoints.ts から生成する
// proxyDecorators: 差す側の <ドメイン>/plugs/proxyDecorators/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const decorator(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { ProxyResponseDecorator } from "@/proxies/points";

import { decorator as proxyDecorators_admin_noindex } from "@/domains/core/admin/plugs/proxyDecorators/noindex";
import { decorator as proxyDecorators_referral_inviteLink } from "@/domains/core/referral/plugs/proxyDecorators/inviteLink";
import { decorator as proxyDecorators_userAcquisition_attribution } from "@/domains/core/userAcquisition/plugs/proxyDecorators/attribution";

export const proxyDecorators: { domain: string | null; name: string; requires: readonly string[]; plug: ProxyResponseDecorator }[] = [
  { domain: "admin", name: "noindex", requires: [], plug: proxyDecorators_admin_noindex },
  { domain: "referral", name: "inviteLink", requires: ["coupon"], plug: proxyDecorators_referral_inviteLink },
  { domain: "userAcquisition", name: "attribution", requires: [], plug: proxyDecorators_userAcquisition_attribution },
];
