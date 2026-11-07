// src/featureGate/node/configPath.ts(入口 @/featureGate/node の configPath)
// 住所が規則の値で開いているか(全開スイッチを通さない gate.path。答えの形は gate.path と同じ)。
// コミットされるファイルと照合が env で揺れない道具が使う(cron:generate / cron:check の scripts/cron/discover.ts、L2.3)

import { resolvePath } from "../evaluate";
import { configRules } from "../ruleList";
import type { GatePathResult } from "../types";

export function configPath(pathname: string): GatePathResult {
  return resolvePath(pathname, configRules);
}
