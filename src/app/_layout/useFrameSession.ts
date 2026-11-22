// src/app/_layout/useFrameSession.ts
// 枠(根・利用者・管理)がログインの状態とログアウトを読む口。点 frameSession の項目(ちょうど 1 つ、上流は auth)を門番で絞って返す。
// 枠はドメインを読まない(D22・D25)。項目は固定なので、返した hook(useSession・useLogout)は毎回同じ順で呼べる

"use client";

import { useGate } from "@/featureGate/client";

import { frameSession } from "./extensions/frameSession";
import type { FrameSessionPlug } from "./types";

export function useFrameSession(): FrameSessionPlug {
  const [entry] = useGate().plugs(frameSession);
  if (!entry) throw new Error("frameSession: 項目がありません(常設のドメインの項目がちょうど 1 つ要る。pnpm generate extensions)");
  return entry.plug;
}
