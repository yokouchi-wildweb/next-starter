// src/app/_providers/ForkProviders.default.tsx
//
// fork が自分の Provider を足す口(D30 K8)の上流の既定 = 空の素通し(children をそのまま返す)。
// src/wiring/AppProviders.tsx が一番内側で 1 行スイッチ ./ForkProviders を包む。このファイルは編集しない。
// fork の差し替え = 隣に ForkProviders.replace.tsx を書き(同じ名前 ForkProviders を export、props は { children })、
// スイッチ ForkProviders.tsx をそちらへ向ける(丸ごとの置き換え。書き方: ./README.md)。
// 多段の Tier も .replace を書き換える(fork ID は付けない。親の Tier の Provider を残すかは下の Tier が決める)。

import type { ReactNode } from "react";

export type ForkProvidersProps = Readonly<{ children: ReactNode }>;

export function ForkProviders({ children }: ForkProvidersProps) {
  return children;
}
