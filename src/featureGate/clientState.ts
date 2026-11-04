// src/featureGate/clientState.ts
// clientGateState(area): client に渡す値を server で計算する(L1.7: 配線用の公開名。使える場所は lint で 4 ファイル)。
// { 規則名: 開閉 }(全規則)と、範囲(枠)で絞った閉じた住所の並び。client は規則を評価せずこれだけを読む(D5)。
// 呼び手: root の src/app/layout.tsx → src/wiring/AppProviders.tsx(user)、admin の守りの layout 2 つ(admin、guard の後)

import { isPatternInArea } from "./area";
import { closedPathEntries } from "./evaluate";
import { rules } from "./extensions/rules";
import type { ClientGateArea, ClientGateState, FeatureName } from "./types";

export function clientGateState(area: ClientGateArea): ClientGateState {
  const enabled = Object.fromEntries(rules.map((rule) => [rule.name, rule.enabled()])) as Record<FeatureName, boolean>;
  const closed = closedPathEntries().filter((entry) => isPatternInArea(entry.pattern, area));
  return { area, enabled, closed };
}
