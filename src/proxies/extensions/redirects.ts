// 生成物・編集不可: pnpm generate extensions が src/proxies/extensionPoints.ts から生成する
// redirects: src/proxies/redirects/<名前>.ts(x) か <名前>/index.ts(x) の export const redirects(並びはファイル名の順)

import type { RedirectRuleGroup } from "@/proxies/types";

export const redirects: RedirectRuleGroup[] = [];
