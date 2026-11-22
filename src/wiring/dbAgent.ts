// 生成物・編集不可: pnpm generate extensions が src/lib/dbAgent/extensionPoints.ts から生成する
// dbAgentPromptFragments: 差す側の <ドメイン>/plugs/dbAgentPromptFragments/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const fragment(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)
// dbAgentSuffixProviders: 差す側の <ドメイン>/plugs/dbAgentSuffixProviders/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const provider(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)
// dbAgentTools: 差す側の <ドメイン>/plugs/dbAgentTools/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const tool(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { AgentToolDefinition, DbAgentPromptFragment, DbAgentSystemSuffixProvider } from "@/lib/dbAgent/points";

export const dbAgentPromptFragments: { domain: string | null; name: string; requires: readonly string[]; plug: DbAgentPromptFragment }[] = [];

export const dbAgentSuffixProviders: { domain: string | null; name: string; requires: readonly string[]; plug: DbAgentSystemSuffixProvider }[] = [];

export const dbAgentTools: { domain: string | null; name: string; requires: readonly string[]; plug: AgentToolDefinition }[] = [];
