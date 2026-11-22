// src/featureGate/tools/server/plugs.ts
// gate.plugs(items): plugs の点の生成された一覧(<持ち主>/extensions/<点>.ts・src/wiring/<lib>.ts)から、閉じたドメインの項目を外す(順は保つ)。
// 項目のドメインか、そのドメインの requires の相手のどれかが閉じていれば外す(D26)。domain null(lib の項目)は外さない。
// 使う時に掛ける物で、生成された登録表(serviceRegistry など「どんなドメインがあるか」)には掛けない(D26)。client は useGate().plugs

import type { GatedPlug } from "../../types";
import { domainOpen } from "./domainOpen";

export const plugs = <T extends GatedPlug>(items: readonly T[]): T[] =>
  items.filter((item) => item.domain === null || (domainOpen(item.domain) && item.requires.every(domainOpen)));
