// 生成物・編集不可: pnpm generate extensions が src/app/_layout/extensionPoints.ts から生成する
// rootProviders: 差す側の <ドメイン>/plugs/rootProviders/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const provider と段 export const stage(並びは段(outer → session → domain → inner → project。骨組みだけの段 outer・inner)→ <差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { RootProvider } from "@/app/_layout/points";

import { provider as rootProviders_auth_authSession } from "@/domains/core/auth/plugs/rootProviders/authSession";
import { provider as rootProviders_adminCommand_adminCommand } from "@/domains/core/adminCommand/plugs/rootProviders/adminCommand";

export const rootProviders: { domain: string | null; name: string; requires: readonly string[]; stage: "outer" | "session" | "domain" | "inner" | "project"; plug: RootProvider }[] = [
  { domain: "auth", name: "authSession", requires: [], stage: "session", plug: rootProviders_auth_authSession },
  { domain: "adminCommand", name: "adminCommand", requires: [], stage: "domain", plug: rootProviders_adminCommand_adminCommand },
];
