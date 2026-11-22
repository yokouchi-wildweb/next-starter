// 生成物・編集不可: pnpm generate extensions が src/domains/core/userAcquisition/extensionPoints.ts から生成する
// userAcquisitionChannels: 差す側の <ドメイン>/plugs/userAcquisitionChannels/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const channel(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { AcquisitionChannelItem } from "@/domains/core/userAcquisition/types/channel";

import { channel as userAcquisitionChannels_userAcquisition_invite } from "@/domains/core/userAcquisition/plugs/userAcquisitionChannels/invite";

export const userAcquisitionChannels: { domain: string | null; name: string; requires: readonly string[]; plug: AcquisitionChannelItem }[] = [
  { domain: "userAcquisition", name: "invite", requires: [], plug: userAcquisitionChannels_userAcquisition_invite },
];
