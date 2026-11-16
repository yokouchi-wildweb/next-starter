// 生成物・編集不可: pnpm generate extensions が src/features/core/messaging/extensionPoints.ts から生成する
// channelPreviews: src/features/core/messaging/channelPreviews/<名前>.ts(x) か <名前>/index.ts(x) の export const preview(並びはファイル名の順)

import type { ChannelPreviewItem } from "@/features/core/messaging/types/channelPreview";

const channelPreviewsList: ChannelPreviewItem[] = [];
export const channelPreviews: Readonly<Record<string, ChannelPreviewItem>> = Object.assign(Object.create(null), Object.fromEntries(channelPreviewsList.map((item) => [String(item.key), item])));
if (Object.keys(channelPreviews).length !== channelPreviewsList.length) throw new Error("channelPreviews: key が重複している項目がある");
