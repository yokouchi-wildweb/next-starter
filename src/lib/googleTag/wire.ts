// src/lib/googleTag/wire.ts
//
// 結び目 wireGoogleTag(宣言 ./extensionPoints.ts の wire)。生成物 src/wiring/googleTag.ts が門番で絞った点 googleTagChannels の一覧を渡し、
// 判別表を結んだ <GoogleTag> を受け取る(root の src/app/layout.tsx が描く。server の部品で、表はシリアライズできる値として client の部品へ prop で渡る)。
// 表は描くたびに項目の definitions() を並びの順につなぐ。項目が無い(閉じて外された)なら空の表 = 経路を送らない

import { createElement, type ComponentProps } from "react";

import { GoogleTag as ClientGoogleTag } from "./GoogleTag";
import type { GoogleTagChannelSource } from "./googleTag";

type Props = Omit<ComponentProps<typeof ClientGoogleTag>, "channels">;

export function wireGoogleTag(lists: { googleTagChannels: readonly { plug: GoogleTagChannelSource }[] }) {
  return function GoogleTag(props: Props) {
    const channels = lists.googleTagChannels.flatMap(({ plug }) => plug.definitions());
    return createElement(ClientGoogleTag, { ...props, channels });
  };
}
