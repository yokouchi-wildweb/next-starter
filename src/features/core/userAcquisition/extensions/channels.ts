// 生成物・編集不可: pnpm generate extensions が src/features/core/userAcquisition/extensionPoints.ts から生成する
// channels: src/features/core/userAcquisition/channels/<名前>.ts(x) か <名前>/index.ts(x) の export const channel(並びはファイル名の順)

import type { AcquisitionChannelItem } from "@/features/core/userAcquisition/types/channel";

import { channel as channels_invite } from "@/features/core/userAcquisition/channels/invite";

const channelsList: AcquisitionChannelItem[] = [
  channels_invite,
];
export const channels: Readonly<Record<string, AcquisitionChannelItem>> = Object.assign(Object.create(null), Object.fromEntries(channelsList.map((item) => [String(item.param), item])));
if (Object.keys(channels).length !== channelsList.length) throw new Error("channels: param が重複している項目がある");
