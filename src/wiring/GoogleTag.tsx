// src/wiring/GoogleTag.tsx
//
// lib/googleTag の <GoogleTag> に流入経路の判別表(userAcquisition の公開の口 getChannelDefinitions)を結んだ版。
// root の src/app/layout.tsx が描く(server。表はシリアライズできる値で、client の部品へ prop で渡る)。
// lib は features を読まない(lint import-boundaries/lib-no-features)ので、結ぶのはここ。
// 流入経路の機能(規則 userAcquisition)が閉じている間は表を渡さない(閉じた機能は経路を足さない)。

import type { ComponentProps } from "react";

import { gate } from "@/featureGate";
import { getChannelDefinitions } from "@/features/core/userAcquisition/lib/classifyVisit";
import { GoogleTag as LibGoogleTag } from "@/lib/googleTag";

type Props = Omit<ComponentProps<typeof LibGoogleTag>, "channels">;

export function GoogleTag(props: Props) {
  return <LibGoogleTag {...props} channels={gate.enabled("userAcquisition") ? getChannelDefinitions() : []} />;
}
