// src/featureGate/tools/server/path.ts
// gate.path(pathname): { open: true } | { open: false; rule, redirectTo? }(閉じていれば一覧の順で最初の閉じた規則の名前と redirectTo)。
// 読み手: proxy の項目 src/proxies/featureGate.ts・demo の loader

import { resolvePath } from "../../evaluate";
import type { GatePathResult } from "../../types";

export const path = (pathname: string): GatePathResult => resolvePath(pathname);
