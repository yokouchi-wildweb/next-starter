// 生成物・編集不可: pnpm extensions:generate が src/wiring/dbAgent/extensionPoints.ts から生成する
// extraTools: src/wiring/dbAgent/extraTools/<名前>[.<fork の名前>].ts(x) か <名前>[.<fork の名前>]/index.ts(x) の export const tool(並びはファイル名の順)
// promptFragments: src/wiring/dbAgent/promptFragments/<名前>[.<fork の名前>].ts(x) か <名前>[.<fork の名前>]/index.ts(x) の export const fragment(並びはファイル名の順)
// suffixProviders: src/wiring/dbAgent/suffixProviders/<名前>[.<fork の名前>].ts(x) か <名前>[.<fork の名前>]/index.ts(x) の export const provider(並びはファイル名の順)

import type { AgentToolDefinition } from "@/lib/ai";
import type { DbAgentPromptFragment, DbAgentSystemSuffixProvider } from "@/lib/dbAgent/prompt";

export const extraTools: AgentToolDefinition[] = [];

export const promptFragments: DbAgentPromptFragment[] = [];

export const suffixProviders: DbAgentSystemSuffixProvider[] = [];
