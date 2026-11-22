// 生成物・編集不可: pnpm generate extensions が src/lib/googleTag/extensionPoints.ts から生成する
// googleTagChannels: 差す側の <ドメイン>/plugs/googleTagChannels/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const channels(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)
// 結び目: src/lib/googleTag/extensionPoints.ts の wire(一覧を門番で絞って lib の wireGoogleTag に渡す)

import { gate } from "@/featureGate";
import { wireGoogleTag } from "@/lib/googleTag";

import type { GoogleTagChannelSource } from "@/lib/googleTag/points";

import { channels as googleTagChannels_userAcquisition_channels } from "@/domains/core/userAcquisition/plugs/googleTagChannels/channels";

export const googleTagChannels: { domain: string | null; name: string; requires: readonly string[]; plug: GoogleTagChannelSource }[] = [
  { domain: "userAcquisition", name: "channels", requires: [], plug: googleTagChannels_userAcquisition_channels },
];

export const GoogleTag = wireGoogleTag({ googleTagChannels: gate.plugs(googleTagChannels) });
