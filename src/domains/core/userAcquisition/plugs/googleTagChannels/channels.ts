// src/domains/core/userAcquisition/plugs/googleTagChannels/channels.ts
//
// 点 googleTagChannels(GA4 へ渡す流入経路の判別表、宣言 src/lib/googleTag/extensionPoints.ts)の項目。
// 表は公開の口 getChannelDefinitions(clickIdParams + 点 userAcquisitionChannels の項目)。root layout が描くたびに読む。
// 流入経路のドメインが閉じている間は門番が項目を外し、表は空(閉じた機能は経路を足さない)

import { getChannelDefinitions } from "@/domains/core/userAcquisition/lib/classifyVisit";
import type { GoogleTagChannelSource } from "@/lib/googleTag/points";

export const channels: GoogleTagChannelSource = {
  definitions: getChannelDefinitions,
};
